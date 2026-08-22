import fs from "node:fs";
import assert from "node:assert/strict";
import { escolherVisuaisDoZip, VISUAL_KEEP_RE, MAX_VISUAIS_NO_ENVIO, MAX_BYTES_VISUAIS_NO_ENVIO, LIMITE_ENVIO_BYTES, MARGEM_ENVIO_BYTES } from "../js/enxugar-zip.js";

// v1353 — A LEITURA DE IMAGEM E PDF NUNCA TEVE CHANCE: O CELULAR APAGAVA OS ARQUIVOS ANTES DE ENVIAR.
//
// "eu mandei botar leitura de imagem, link e PDF" (dono, 21/08/2026). Ele mandou, e o servidor
// aprendeu — a v1306 lê foto e PDF, a v1307 abre link. Só que o aparelho enxuga o ZIP antes de
// mandar, e a regra dele era de antes disso tudo: "imagem, vídeo e documento saem sempre (nunca
// entram na análise)". Estava escrito assim no código, com essas palavras.
//
// Ou seja: o servidor sabia ler, e os arquivos nunca chegavam nele. Em TODA importação feita pelo
// celular — que são todas — a leitura de imagem e PDF estava morta. Não era o Cérebro, não era o
// prompt, não era teto de custo: os arquivos eram apagados no caminho.
//
// Vídeo continua de fora de propósito: o app não lê vídeo, por decisão do dono.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const importacao = fs.readFileSync(new URL("../js/importacao.js", import.meta.url), "utf8");

// ── 1. Foto e PDF param de ser apagados no envio ─────────────────────────────────────────────
const KEEP_RE = new RegExp(app.match(/export const KEEP_RE = \/([^/]+)\/i;/)[1], "i");
for (const nome of ["conversa.txt", "PTT-1.opus", "AUD-2.m4a", "IMG-20260821-WA0003.jpg",
                    "FOTO.jpeg", "planta.PNG", "tabela.pdf", "arte.webp", "recibo.heic"]) {
  assert.ok(KEEP_RE.test(nome), `${nome} precisa viajar no envio — é isso que o servidor lê`);
}
for (const nome of ["VID-20260821-WA0001.mp4", "clipe.mov", "video.3gp"]) {
  assert.ok(!KEEP_RE.test(nome), `${nome} continua fora: o app não lê vídeo`);
}
assert.ok(!/Imagem, vídeo e documento saem sempre/.test(importacao),
  "a regra antiga (e o comentário que a justificava) não pode continuar no código");
assert.match(importacao, /const visuais = uteis\.filter\(\(\[path\]\) => VISUAL_KEEP_RE\.test\(path\)\);/);
assert.match(importacao, /audiosQueVao\.has\(path\) \|\| visuaisQueVao\.has\(path\)/,
  "e o ZIP enviado precisa de fato incluir os arquivos escolhidos");

// ── 2. O texto e o áudio continuam mandando — foto/PDF entram no que sobrar ──────────────────
// Regra de ouro: o que já funcionava não pode perder espaço pro que está sendo consertado.
assert.match(importacao, /bytesJaUsados: plano\.resumo\?\.bytesEstimados \|\| 0/,
  "a conta das fotos começa de onde a do texto+áudio parou");
{
  const ordemPlano = importacao.indexOf("const plano = planejarConteudoDoZip(");
  const ordemVisuais = importacao.indexOf("const planoVisuais = escolherVisuaisDoZip(");
  assert.ok(ordemPlano > -1 && ordemVisuais > ordemPlano, "o áudio é decidido antes da foto");
}

// ── 3. A escolha, rodando ────────────────────────────────────────────────────────────────────
const TXT = [
  "[21/08/2026 14:50] Gordo: IMG-20260821-WA0001.jpg (arquivo anexado)",
  "[21/08/2026 14:52] Gordo: IMG-20260821-WA0002.jpg (arquivo anexado)",
  "[21/08/2026 14:53] Gordo: tabela-de-precos.pdf (arquivo anexado)",
  "[21/08/2026 15:01] Miguel: Perfeito, te mando a simulação hoje"
].join("\n");
const MB = 1024 * 1024;
{
  const r = escolherVisuaisDoZip({
    txt: TXT,
    visuais: [
      { caminho: "IMG-20260821-WA0001.jpg", bytes: 2 * MB },
      { caminho: "IMG-20260821-WA0002.jpg", bytes: 2 * MB },
      { caminho: "tabela-de-precos.pdf", bytes: 1 * MB }
    ]
  });
  assert.deepEqual(r.manter.slice().sort(),
    ["IMG-20260821-WA0001.jpg", "IMG-20260821-WA0002.jpg", "tabela-de-precos.pdf"],
    "conversa normal: tudo que foi citado no texto viaja junto");
  assert.equal(r.fora.length, 0);
}

// Quando não cabe tudo, ficam os MAIS RECENTES — os que a conversa citou por último.
{
  const r = escolherVisuaisDoZip({
    txt: TXT,
    visuais: [
      { caminho: "IMG-20260821-WA0001.jpg", bytes: 3 * MB },
      { caminho: "IMG-20260821-WA0002.jpg", bytes: 3 * MB },
      { caminho: "tabela-de-precos.pdf", bytes: 3 * MB }
    ],
    maxBytesTotal: 7 * MB
  });
  assert.equal(r.manter.length, 2, "só cabem dois");
  assert.ok(!r.manter.includes("IMG-20260821-WA0001.jpg"),
    "o que sai é o mais antigo — o citado primeiro na conversa");
  assert.ok(r.manter.includes("tabela-de-precos.pdf"), "o mais recente fica");
}

// ── v1355 — O TETO PRÓPRIO DAS FOTOS ─────────────────────────────────────────────────────────
// A v1353 deixou foto e PDF entrarem "no que sobrar do envio", e o resultado foi um ZIP de 56,5 MB
// RECUSADO pelo armazenamento: a importação do dono morreu no envio, com uma conversa que antes
// subia. Peso novo não pode empurrar pra fora o que já funcionava.
{
  const pesadas = Array.from({ length: 12 }, (_, i) => `IMG-20260821-WA00${String(i).padStart(2, "0")}.jpg`);
  const txtPesadas = pesadas.map((n, i) => `[21/08/2026 1${i % 9}:00] Gordo: ${n} (arquivo anexado)`).join("\n");
  const r = escolherVisuaisDoZip({
    txt: txtPesadas,
    visuais: pesadas.map(n => ({ caminho: n, bytes: 2 * MB }))
  });
  assert.ok(r.resumo.bytesVisuais <= MAX_BYTES_VISUAIS_NO_ENVIO,
    `as fotos não podem passar do teto delas (${Math.round(r.resumo.bytesVisuais / MB)} MB)`);
  assert.ok(r.manter.length < pesadas.length, "o que não coube no teto fica de fora");
  assert.equal(r.resumo.tetoVisuais, MAX_BYTES_VISUAIS_NO_ENVIO);
}
// Um arquivo gigante sozinho não come o teto inteiro nem entra.
{
  const r = escolherVisuaisDoZip({
    txt: TXT,
    visuais: [
      { caminho: "tabela-de-precos.pdf", bytes: 30 * MB },
      { caminho: "IMG-20260821-WA0002.jpg", bytes: 400 * 1024 }
    ]
  });
  assert.deepEqual(r.manter, ["IMG-20260821-WA0002.jpg"],
    "o PDF gigante fica de fora e não impede a foto de ir");
}
// E o teto das fotos NUNCA pode empurrar pra fora o texto e o áudio, que já estavam no envio.
{
  const r = escolherVisuaisDoZip({
    txt: TXT,
    visuais: [{ caminho: "IMG-20260821-WA0002.jpg", bytes: MB }],
    bytesJaUsados: LIMITE_ENVIO_BYTES - MARGEM_ENVIO_BYTES - 1000
  });
  assert.deepEqual(r.manter, [], "sem espaço no envio, foto nenhuma entra — mesmo cabendo no teto delas");
}

// Arquivo que o texto não cita não viaja: o servidor não teria como ligar ele a mensagem nenhuma.
{
  const r = escolherVisuaisDoZip({
    txt: TXT,
    visuais: [{ caminho: "IMG-20260821-WA0002.jpg", bytes: MB }, { caminho: "sticker-aleatorio.webp", bytes: MB }]
  });
  assert.deepEqual(r.manter, ["IMG-20260821-WA0002.jpg"]);
  assert.deepEqual(r.fora, ["sticker-aleatorio.webp"]);
}

// Teto de quantidade: mandar mais do que o servidor lê por importação é gastar internet do
// corretor à toa.
{
  const muitos = Array.from({ length: 30 }, (_, i) => `IMG-2026082${i % 10}-WA00${String(i).padStart(2, "0")}.jpg`);
  const txtMuitos = muitos.map((n, i) => `[21/08/2026 1${i % 9}:00] Gordo: ${n} (arquivo anexado)`).join("\n");
  const r = escolherVisuaisDoZip({ txt: txtMuitos, visuais: muitos.map(n => ({ caminho: n, bytes: 100 * 1024 })) });
  assert.equal(r.manter.length, MAX_VISUAIS_NO_ENVIO, `no máximo ${MAX_VISUAIS_NO_ENVIO} por envio`);
  assert.equal(r.resumo.total, 30);
  assert.equal(r.resumo.cortados, 30 - MAX_VISUAIS_NO_ENVIO);
}

// Vídeo nunca entra, nem se for citado no texto.
{
  const r = escolherVisuaisDoZip({
    txt: "[21/08/2026 14:52] Gordo: VID-20260821-WA0001.mp4 (arquivo anexado)",
    visuais: [{ caminho: "VID-20260821-WA0001.mp4", bytes: MB }]
  });
  assert.deepEqual(r.manter, [], "vídeo continua fora do envio");
  assert.ok(!VISUAL_KEEP_RE.test("VID-20260821-WA0001.mp4"));
}

// E nada quebra sem foto nenhuma, nem com entrada vazia.
assert.deepEqual(escolherVisuaisDoZip({ txt: TXT, visuais: [] }).manter, []);
assert.deepEqual(escolherVisuaisDoZip().manter, []);

// ── 4. O limite do envio continua sendo respeitado ───────────────────────────────────────────
// Se o texto e o áudio já ocuparam tudo, nenhuma foto entra — a conversa não pode voltar a ser
// recusada por tamanho, que foi o beco sem saída da v1270.
{
  const r = escolherVisuaisDoZip({
    txt: TXT,
    visuais: [{ caminho: "IMG-20260821-WA0002.jpg", bytes: 10 * MB }],
    bytesJaUsados: LIMITE_ENVIO_BYTES - MARGEM_ENVIO_BYTES
  });
  assert.deepEqual(r.manter, [], "sem espaço, foto nenhuma entra");
}

console.log("v1353-foto-e-pdf-chegam-no-servidor: ok");
