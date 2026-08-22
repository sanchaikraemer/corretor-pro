import fs from "node:fs";
import assert from "node:assert/strict";
import { planejarConteudoDoZip, escolherVisuaisDoZip, LIMITE_ENVIO_BYTES, MARGEM_ENVIO_BYTES,
         MAX_BYTES_VISUAIS_NO_ENVIO, MAX_BYTES_POR_VISUAL } from "../js/enxugar-zip.js";

// v1355 — O ENVIO MORRIA COM 56,5 MB, E EU TINHA ENGORDADO O ENVIO NA VERSÃO ANTERIOR.
//
// Print do dono (22/08/2026, 01h37): "O envio da conversa não foi aceito (o arquivo pode estar
// grande demais — 56.5 MB)". A barra tinha ido até 100%, esperou, e morreu no fim.
//
// Duas coisas erradas, uma minha e uma antiga:
//
//   1. MINHA (v1353): as fotos e os PDFs passaram a entrar "no que sobrar do envio". Sobrar era
//      muito espaço, e o ZIP engordou até ser recusado. Peso novo não pode empurrar pra fora o que
//      já funcionava — agora as fotos têm um teto só delas, pequeno.
//
//   2. ANTIGA: o aparelho achava que podia mandar 150 MB. O armazenamento recusa bem antes disso.
//      Toda conversa entre ~50 e 150 MB era montada, subida por minutos e recusada no fim — o
//      mesmo beco sem saída que a v1270 tratou, só que mais tarde no caminho. Com o número real,
//      o corte de áudio acontece ANTES de enviar e a conversa entra.

const MB = 1024 * 1024;

// ── 1. O teto do envio passou a ser o de verdade ─────────────────────────────────────────────
assert.equal(LIMITE_ENVIO_BYTES, 45 * MB, "o aparelho precisa mirar no teto que o armazenamento aceita");
{
  const rota = fs.readFileSync(new URL("../api/processar-storage.js", import.meta.url), "utf8");
  const achado = rota.match(/DEFAULT_MAX_ZIP_BYTES\s*=\s*(\d+)\s*\*\s*1024\s*\*\s*1024/);
  assert.ok(achado, "sanidade: achei o teto do servidor");
  assert.equal(Number(achado[1]) * MB, LIMITE_ENVIO_BYTES,
    "aparelho e servidor precisam mirar no MESMO número — foi a diferença entre eles que criou o beco sem saída");
}

// ── 2. A conversa de 56 MB do print agora CABE, em vez de morrer no envio ────────────────────
// Reproduz o caso: conversa com muito áudio, que antes era montada com ~56 MB e recusada.
{
  const audios = Array.from({ length: 60 }, (_, i) => ({
    caminho: `PTT-2026081${i % 9}-WA${String(i).padStart(4, "0")}.opus`,
    bytes: 950 * 1024
  }));
  const txt = audios.map((a, i) => `[${String(1 + (i % 28)).padStart(2, "0")}/08/2026 1${i % 9}:00] Gordo: ${a.caminho} (arquivo anexado)`).join("\n");
  const plano = planejarConteudoDoZip({ txt, audios, bytesTexto: 200 * 1024 });
  const totalCru = audios.reduce((s, a) => s + a.bytes, 0);
  assert.ok(totalCru > LIMITE_ENVIO_BYTES, `sanidade: sem corte o envio teria ${Math.round(totalCru / MB)} MB`);
  assert.ok(plano.resumo.bytesEstimados <= LIMITE_ENVIO_BYTES - MARGEM_ENVIO_BYTES,
    `o envio precisa caber depois do corte (ficou ${Math.round(plano.resumo.bytesEstimados / MB)} MB)`);
  assert.ok(plano.manter.length > 0, "e não pode cortar tudo: os áudios mais recentes vão");
  assert.ok(plano.resumo.cortouPorTamanho, "o corte fica registrado, pra a tela poder avisar");
}

// ── 3. As fotos não engordam mais o envio ────────────────────────────────────────────────────
{
  const nomes = Array.from({ length: 20 }, (_, i) => `IMG-20260821-WA00${String(i).padStart(2, "0")}.jpg`);
  const txt = nomes.map((n, i) => `[21/08/2026 1${i % 9}:00] Gordo: ${n} (arquivo anexado)`).join("\n");
  const r = escolherVisuaisDoZip({ txt, visuais: nomes.map(n => ({ caminho: n, bytes: 3 * MB })) });
  assert.ok(r.resumo.bytesVisuais <= MAX_BYTES_VISUAIS_NO_ENVIO,
    `foto e PDF juntos não passam de ${Math.round(MAX_BYTES_VISUAIS_NO_ENVIO / MB)} MB (ficaram ${Math.round(r.resumo.bytesVisuais / MB)} MB)`);
  assert.ok(MAX_BYTES_VISUAIS_NO_ENVIO < LIMITE_ENVIO_BYTES / 4,
    "o teto das fotos tem que ser uma fração pequena do envio — elas são o acréscimo, não o principal");
}
// Arquivo único acima do teto por item não entra (senão come sozinho o espaço de todas).
{
  const r = escolherVisuaisDoZip({
    txt: "[21/08/2026 14:52] Gordo: digitalizacao.pdf (arquivo anexado)",
    visuais: [{ caminho: "digitalizacao.pdf", bytes: MAX_BYTES_POR_VISUAL + 1 }]
  });
  assert.deepEqual(r.manter, []);
}

// ── 4. A ordem de prioridade continua: texto > áudio > foto ──────────────────────────────────
// Esta é a regra que impede a correção de virar um novo problema: o que já subia continua subindo.
{
  const audios = Array.from({ length: 40 }, (_, i) => ({ caminho: `PTT-${i}.opus`, bytes: 1000 * 1024 }));
  const txt = audios.map((a, i) => `[2${i % 9}/08/2026 10:00] Gordo: ${a.caminho} (arquivo anexado)`).join("\n")
    + "\n[21/08/2026 15:00] Gordo: ARTE.jpg (arquivo anexado)";
  const plano = planejarConteudoDoZip({ txt, audios, bytesTexto: 100 * 1024 });
  const visuais = escolherVisuaisDoZip({
    txt, visuais: [{ caminho: "ARTE.jpg", bytes: 2 * MB }],
    bytesJaUsados: plano.resumo.bytesEstimados
  });
  const total = plano.resumo.bytesEstimados + (visuais.resumo.bytesVisuais || 0);
  assert.ok(total <= LIMITE_ENVIO_BYTES - MARGEM_ENVIO_BYTES,
    `texto + áudio + foto precisa caber no envio (deu ${Math.round(total / MB)} MB)`);
}

console.log("v1355-envio-nao-morre-por-tamanho: ok");
