import fs from "node:fs";
import assert from "node:assert/strict";
import { mesclarTimelineIncremental } from "../api/_pipeline.js";

// v1349 — "REIMPORTAR A CONVERSA E MESMA MERDA / CADÊ A TRANSCRIÇÃO DE ÁUDIO????"
//
// Dono, 21/08/2026, depois de reimportar a conversa que tinha vindo sem os arquivos. Ele estava
// certo: reimportar NÃO consertava, e nunca ia consertar.
//
// A mesclagem da reimportação compara mensagem por mensagem usando data + hora + autor + TEXTO.
// Na primeira importação, sem os arquivos, a mensagem ficou guardada como "[Arquivo enviado nesta
// mensagem: … — conteúdo não analisado pela IA]" ou "[Áudio: … — não transcrito]". Reimportando a
// MESMA conversa COM os arquivos, aquela mesma mensagem chega com outro texto — a foto lida, a
// transcrição do áudio. Texto diferente = assinatura diferente = "mensagem nova": a linha vazia
// ficava, a nova entrava do lado, no mesmo minuto e do mesmo autor. A linha inútil era eterna.
//
// A regra desta versão é estreita: some SÓ a linha antiga que não carrega informação nenhuma (é
// apenas marcador de arquivo/áudio não lido) E que tem exatamente a mesma data, hora e autor de
// uma mensagem que a importação nova trouxe COM conteúdo. Nunca o contrário.

const HORA = { date: "21/08/2026", time: "14:52", author: "Gordo" };
const marcador = (t) => ({ ...HORA, text: t, iso: "2026-08-21T17:52:00.000Z" });

// ── 1. O caso do dono: a foto que não veio, depois veio ──────────────────────────────────────
{
  const antiga = [
    { date: "21/08/2026", time: "14:51", author: "Miguel", text: "Ele teria alguma entrada? Ou ate permuta, carro, moto...", iso: "2026-08-21T17:51:00.000Z" },
    marcador("[Arquivo enviado nesta mensagem: arquivo — conteúdo não analisado pela IA]")
  ];
  const nova = [
    { date: "21/08/2026", time: "14:51", author: "Miguel", text: "Ele teria alguma entrada? Ou ate permuta, carro, moto...", iso: "2026-08-21T17:51:00.000Z" },
    marcador("[Arquivo enviado nesta mensagem: imagem]\nNa imagem: tabela com valor de entrada e parcelas.")
  ];
  const junto = mesclarTimelineIncremental(antiga, nova);
  const textos = junto.map(m => m.text);
  assert.ok(!textos.some(t => /conteúdo não analisado/.test(t)),
    "a linha vazia precisa sumir quando a reimportação trouxe o conteúdo daquele mesmo momento");
  assert.ok(textos.some(t => /tabela com valor de entrada/.test(t)),
    "e o que foi lido precisa ficar");
  assert.equal(junto.length, 2, "sem duplicar a conversa: uma fala + um arquivo lido");
}

// ── 2. O áudio: era o que ele estava procurando ──────────────────────────────────────────────
{
  const antiga = [marcador("[Áudio: PTT-20260821-WA0003.opus — não transcrito por estar fora do período escolhido]")];
  const nova = [{ ...HORA, text: "[Áudio: PTT-20260821-WA0003.opus] Fala Miguel, consegui juntar a entrada, me manda a proposta", iso: "2026-08-21T17:52:00.000Z" }];
  const junto = mesclarTimelineIncremental(antiga, nova);
  assert.equal(junto.length, 1, "a linha 'não transcrito' não pode continuar do lado da transcrição");
  assert.match(junto[0].text, /consegui juntar a entrada/, "a transcrição é o que fica");
}

// ── 3. O contrário NUNCA acontece: marcador novo não apaga conteúdo velho ────────────────────
// Se a reimportação vier PIOR que o que já estava guardado (sem os arquivos de novo), o que já
// tinha sido lido não pode ser perdido. Perder conteúdo seria muito pior que a linha repetida.
{
  const antiga = [{ ...HORA, text: "[Arquivo enviado nesta mensagem: imagem]\nNa imagem: tabela com valor de entrada.", iso: "2026-08-21T17:52:00.000Z" }];
  const nova = [marcador("[Arquivo enviado nesta mensagem: arquivo — conteúdo não analisado pela IA]")];
  const junto = mesclarTimelineIncremental(antiga, nova);
  assert.ok(junto.some(m => /tabela com valor de entrada/.test(m.text)),
    "o que já tinha sido lido não pode ser apagado por uma reimportação sem os arquivos");
}

// ── 4. Fala de gente nunca é descartada ──────────────────────────────────────────────────────
// A regra só descarta linha que é APENAS marcador. Mensagem com texto de verdade — mesmo curta,
// mesmo no mesmo minuto e do mesmo autor — fica sempre.
{
  const antiga = [
    { ...HORA, text: "Segue a tabela", iso: "2026-08-21T17:52:00.000Z" },
    marcador("[Arquivo enviado nesta mensagem: documento/PDF — conteúdo não analisado pela IA]")
  ];
  const nova = [{ ...HORA, text: "[Arquivo enviado nesta mensagem: documento/PDF]\nNo PDF: tabela de preços.", iso: "2026-08-21T17:52:00.000Z" }];
  const junto = mesclarTimelineIncremental(antiga, nova);
  assert.ok(junto.some(m => m.text === "Segue a tabela"), "fala do corretor fica, sempre");
  assert.ok(!junto.some(m => /conteúdo não analisado/.test(m.text)), "só o marcador vazio sai");
  assert.equal(junto.length, 2);
}

// ── 5. Momento diferente não se mistura ──────────────────────────────────────────────────────
// Arquivo não lido às 14h52 não pode sumir porque veio conteúdo às 14h53. Data, hora e autor têm
// que bater exatamente — senão a regra viraria uma peneira que come mensagem.
{
  const antiga = [marcador("[Arquivo enviado nesta mensagem: arquivo — conteúdo não analisado pela IA]")];
  const nova = [{ date: "21/08/2026", time: "14:53", author: "Gordo", text: "[Arquivo enviado nesta mensagem: imagem]\nNa imagem: planta do apartamento.", iso: "2026-08-21T17:53:00.000Z" }];
  const junto = mesclarTimelineIncremental(antiga, nova);
  assert.equal(junto.length, 2, "são dois envios diferentes — nenhum dos dois some");
  // E o mesmo vale pro autor: o arquivo do cliente não some porque o corretor mandou um no mesmo minuto.
  const outroAutor = mesclarTimelineIncremental(
    [marcador("[Arquivo enviado nesta mensagem: arquivo — conteúdo não analisado pela IA]")],
    [{ ...HORA, author: "Miguel", text: "[Arquivo enviado nesta mensagem: imagem]\nNa imagem: planta.", iso: "2026-08-21T17:52:00.000Z" }]
  );
  assert.equal(outroAutor.length, 2, "autor diferente é envio diferente");
}

// ── 6. Sem reimportação nada muda, e nada quebra com lista vazia ─────────────────────────────
{
  assert.deepEqual(mesclarTimelineIncremental([], []), []);
  const so = mesclarTimelineIncremental([], [marcador("[Arquivo enviado nesta mensagem: arquivo — conteúdo não analisado pela IA]")]);
  assert.equal(so.length, 1, "primeira importação sem arquivo continua registrando que houve um envio");
}

// ── 7. E o corretor consegue mandar os arquivos sem reexportar a conversa ────────────────────
// A outra metade do conserto: um botão na tela do cliente que lê foto, PDF e áudio na hora, com o
// MESMO leitor da importação e o MESMO Whisper. Sem isso, conversa que veio sem os arquivos só
// tinha uma saída: exportar tudo de novo no WhatsApp.
{
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const rota = fs.readFileSync(new URL("../api/cerebro-config.js", import.meta.url), "utf8");

  assert.match(app, /id="cp1349ArquivosInput"[^>]*multiple/, "o seletor aceita vários arquivos de uma vez");
  assert.match(app, /accept="[^"]*application\/pdf[^"]*audio\/\*/, "aceita PDF e áudio, não só foto");
  assert.match(app, /Ler fotos, PDFs e áudios<\/button>/, "e o botão está na tela do cliente");
  assert.match(app, /action:"ler-arquivos"/, "que chama a ação nova");
  {
    const fn = app.match(/async function cp1349LerArquivos\(input\)\{[\s\S]*?\n\}/)[0];
    assert.match(fn, /TETO_ENVIO/, "o envio respeita um teto de tamanho — senão a hospedagem recusa tudo de uma vez");
    assert.match(fn, /Confira o texto acima/, "o texto lido volta pra conferência, como na leitura de print: nada é gravado sozinho");
  }
  const acao = rota.slice(rota.indexOf('if (body.action === "ler-arquivos")'));
  const fimAcao = acao.indexOf('// AÇÃO: aprender de TODA a carteira');
  const bloco = acao.slice(0, fimAcao > 0 ? fimAcao : 6000);
  assert.match(bloco, /lerArquivosVisuais\(entradas, organizationId/, "usa o mesmo leitor da importação");
  assert.match(bloco, /transcreverBuffer\(a\.buffer, a\.ext, openai, organizationId\)/, "e o mesmo transcritor de áudio");
  assert.match(bloco, /verificarLimiteLeituraVisual\(organizationId\)/, "com o teto do dia de leitura");
  assert.match(bloco, /verificarLimiteDiario\(organizationId, "cerebro-transcricao-voz"/, "e o teto do dia de transcrição");
  assert.match(bloco, /arquivos\.slice\(0, 10\)/, "no máximo 10 por vez, pra caber no tempo da função");
  assert.match(bloco, /buffer\.length > 12 \* 1024 \* 1024/, "e um teto por arquivo");
}

console.log("v1349-reimportar-conserta-a-conversa: ok");
