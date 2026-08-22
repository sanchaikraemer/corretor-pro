import fs from "node:fs";
import assert from "node:assert/strict";
import { planejarConteudoDoZip, LIMITE_ENVIO_BYTES, MARGEM_ENVIO_BYTES } from "../js/enxugar-zip.js";

// v1361 — "VOCÊ ESTÁ REIMPORTANDO TODO O HISTÓRICO E NÃO SÓ AS ATUALIZAÇÕES" (dono, 22/08/2026).
//
// Ele separou duas coisas que eu tinha misturado:
//
//   - A ANÁLISE tem que ser sobre o histórico inteiro — e continua sendo. A conversa vai completa
//     pra IA, o que já estava salvo é comparado com o que chegou. Nada disso muda aqui.
//   - O ENVIO não: mandar de novo, toda vez, os áudios que o servidor já transformou em texto é
//     desperdício puro. Numa conversa de meses são dezenas de MB subindo à toa — e é isso que faz
//     a importação demorar.
//
// O servidor já reaproveitava a transcrição desde a v1141, mas só DEPOIS que o arquivo inteiro
// tinha subido. Agora o aparelho pergunta antes o que já está salvo e deixa esses áudios de fora.

const MB = 1024 * 1024;
const importacao = fs.readFileSync(new URL("../js/importacao.js", import.meta.url), "utf8");
const storage = fs.readFileSync(new URL("../api/processar-storage.js", import.meta.url), "utf8");

const audios = Array.from({ length: 10 }, (_, i) => ({ caminho: `PTT-${i}.opus`, bytes: 900 * 1024 }));
const TXT = audios.map((a, i) => `[2${i % 9}/08/2026 10:00] Gordo: ${a.caminho} (arquivo anexado)`).join("\n");

// ── 1. O que já virou texto não sobe de novo ─────────────────────────────────────────────────
{
  const semCache = planejarConteudoDoZip({ txt: TXT, audios, bytesTexto: 50 * 1024 });
  const comCache = planejarConteudoDoZip({
    txt: TXT, audios, bytesTexto: 50 * 1024,
    jaTranscritos: audios.slice(0, 7).map(a => a.caminho)
  });
  assert.equal(semCache.manter.length, 10, "primeira importação: sobe tudo");
  assert.equal(comCache.manter.length, 3, "reimportação: sobem só os 3 áudios novos");
  assert.equal(comCache.resumo.jaSalvos, 7, "e fica registrado quantos foram poupados");
  assert.ok(comCache.resumo.bytesEstimados < semCache.resumo.bytesEstimados / 2,
    "o envio precisa encolher de verdade, não só no papel");
  assert.ok(comCache.resumo.bytesPoupados > 6 * MB - 1, "com o tamanho do que deixou de subir");
}

// ── 2. O nome bate por arquivo, não por caminho nem por caixa ───────────────────────────────
// O ZIP do WhatsApp às vezes traz o áudio dentro de pasta, e o nome salvo pode vir em outra caixa.
// Errar isso significaria mandar tudo de novo (o bug que a v1027 já pegou em outro ponto).
{
  const comPasta = planejarConteudoDoZip({
    txt: "[21/08/2026 10:00] Gordo: PTT-0.opus (arquivo anexado)",
    audios: [{ caminho: "WhatsApp/Media/PTT-0.opus", bytes: MB }],
    bytesTexto: 10 * 1024,
    jaTranscritos: ["ptt-0.opus"]
  });
  assert.equal(comPasta.manter.length, 0, "mesmo arquivo, com pasta e em outra caixa: não sobe");
}

// ── 3. Nada de perder áudio que o servidor NÃO tem ──────────────────────────────────────────
{
  const r = planejarConteudoDoZip({
    txt: TXT, audios, bytesTexto: 50 * 1024,
    jaTranscritos: ["PTT-99.opus", "outro-cliente.opus"]
  });
  assert.equal(r.manter.length, 10, "lista que não casa com nada não pode tirar áudio nenhum do envio");
}
// E lista vazia/ausente se comporta como antes desta versão.
assert.equal(planejarConteudoDoZip({ txt: TXT, audios, bytesTexto: 50 * 1024, jaTranscritos: [] }).manter.length, 10);
assert.equal(planejarConteudoDoZip({ txt: TXT, audios, bytesTexto: 50 * 1024 }).manter.length, 10);

// ── 4. O TEXTO continua indo inteiro — é o histórico ────────────────────────────────────────
// Esta é a linha que separa as duas coisas que o dono separou: o envio encolhe, a conversa não.
{
  const r = planejarConteudoDoZip({
    txt: TXT, audios, bytesTexto: 50 * 1024, jaTranscritos: audios.map(a => a.caminho)
  });
  assert.equal(r.manter.length, 0, "todos os áudios já salvos: nenhum sobe");
  assert.ok(!r.resumo.naoCabeNemSoTexto, "e o texto continua sempre no envio");
  assert.ok(r.resumo.bytesEstimados <= LIMITE_ENVIO_BYTES - MARGEM_ENVIO_BYTES);
}

// ── 5. As pontas ligadas: o aparelho pergunta antes, o servidor responde ────────────────────
assert.match(importacao, /body: JSON\.stringify\(\{ probe: true, fileName: file\.name \}\)/,
  "o aparelho precisa perguntar o que já está salvo ANTES de montar o envio");
assert.match(importacao, /if\(Array\.isArray\(d\?\.audiosJaTranscritos\)\) jaTranscritos = d\.audiosJaTranscritos;/);
assert.match(importacao, /jaTranscritos: opcoes\.jaTranscritos \|\| \[\]/, "e passar a lista pro plano do envio");
assert.match(importacao, /catch\(_\)\{ \}/, "falha na pergunta não pode travar a importação — sobe tudo, como antes");
assert.match(importacao, /áudios já salvos não subiram de novo/, "e a tela diz o que foi poupado");
{
  const bloco = storage.slice(storage.indexOf("if (body && body.probe) {"), storage.indexOf("// Caminho idempotente"));
  assert.match(bloco, /transcricoesDoLeadAnterior\(match\.row\.timeline_json\)/,
    "a lista vem da MESMA fonte que o servidor usa pra reaproveitar (v1141) — não pode divergir");
  assert.match(bloco, /_buscarProcessamentoExistenteV681/, "e do mesmo jeito de achar o cliente");
  assert.match(bloco, /catch \(_\) \{/, "fail-open no servidor também");
  assert.match(bloco, /audiosJaTranscritos \}\);/);
}

console.log("v1361-so-sobe-o-que-e-novo: ok");
