import fs from "node:fs";
import assert from "node:assert/strict";
import { planejarConteudoDoZip, LIMITE_ENVIO_BYTES, MARGEM_ENVIO_BYTES } from "../js/enxugar-zip.js";

// v1358 — "SOMENTE TEXTO E ÁUDIO DEVE SER ACEITO NA IMPORTAÇÃO" (dono, 22/08/2026).
//
// Ordem direta, e ela desfaz a v1353. O histórico, pra ninguém reabrir isso sem contexto:
//
//   - até a v1352 o celular apagava foto, PDF e vídeo antes de enviar. Como o servidor tinha
//     aprendido a ler foto e PDF (v1306), eles nunca chegavam nele — a leitura não rodava;
//   - a v1353 fez foto e PDF viajarem. O envio engordou e a importação do dono foi RECUSADA com
//     56,5 MB (print de 01h37). A v1355 apertou o teto delas, mas o dono decidiu cortar a raiz;
//   - a v1358 volta ao envio de texto + áudio, por ordem dele.
//
// O que o servidor sabe fazer não foi mexido: se um dia um arquivo visual chegar por outro
// caminho, ele continua sendo lido. O que mudou é o que sai do aparelho.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const importacao = fs.readFileSync(new URL("../js/importacao.js", import.meta.url), "utf8");
const enxugar = fs.readFileSync(new URL("../js/enxugar-zip.js", import.meta.url), "utf8");

// ── 1. Só texto e áudio sobem ────────────────────────────────────────────────────────────────
const KEEP_RE = new RegExp(app.match(/export const KEEP_RE = \/([^/]+)\/i;/)[1], "i");
for (const nome of ["conversa.txt", "PTT-1.opus", "AUD-2.m4a", "voz.mp3", "audio.ogg", "gravacao.wav", "x.aac"]) {
  assert.ok(KEEP_RE.test(nome), `${nome} precisa continuar subindo`);
}
for (const nome of ["IMG-20260821-WA0003.jpg", "foto.jpeg", "planta.PNG", "arte.webp", "recibo.heic",
                    "tabela.pdf", "STK-20260821-WA0012.webp", "VID-20260821-WA0001.mp4", "clipe.mov"]) {
  assert.ok(!KEEP_RE.test(nome), `${nome} NÃO pode ser enviado — ordem do dono`);
}

// ── 2. Nada de foto/PDF sobrou no caminho do envio ───────────────────────────────────────────
for (const [nome, fonte] of [["js/importacao.js", importacao], ["js/enxugar-zip.js", enxugar]]) {
  assert.ok(!/VISUAL_KEEP_RE|escolherVisuaisDoZip|planoVisuais|MAX_VISUAIS_NO_ENVIO/.test(fonte),
    `${nome} ainda tem restos da escolha de foto/PDF — código morto é o que o dono mandou aparar na v1347`);
}
assert.match(importacao, /const selecionadas = uteis\.filter\(\(\[path\]\) => \/\\\.txt\$\/i\.test\(path\) \|\| audiosQueVao\.has\(path\)\);/,
  "o ZIP enviado leva só o texto e os áudios escolhidos");
assert.ok(!/const visuais = /.test(importacao), "e nem separa arquivo visual, porque nenhum viaja");

// ── 3. O que a v1355 consertou no envio CONTINUA de pé ───────────────────────────────────────
// O teto real do armazenamento não tem nada a ver com foto: era o aparelho mirando em 150 MB e
// tomando recusa. Reverter a foto não pode trazer de volta o beco sem saída.
assert.equal(LIMITE_ENVIO_BYTES, 45 * 1024 * 1024, "o teto real do envio continua valendo");
{
  const rota = fs.readFileSync(new URL("../api/processar-storage.js", import.meta.url), "utf8");
  const achado = rota.match(/DEFAULT_MAX_ZIP_BYTES\s*=\s*(\d+)\s*\*\s*1024\s*\*\s*1024/);
  assert.equal(Number(achado[1]) * 1024 * 1024, LIMITE_ENVIO_BYTES, "aparelho e servidor no mesmo número");
}
{
  // Conversa grande de áudio continua cabendo, com o corte do mais antigo.
  const audios = Array.from({ length: 60 }, (_, i) => ({ caminho: `PTT-${i}.opus`, bytes: 950 * 1024 }));
  const txt = audios.map((a, i) => `[${String(1 + (i % 28)).padStart(2, "0")}/08/2026 1${i % 9}:00] Gordo: ${a.caminho} (arquivo anexado)`).join("\n");
  const plano = planejarConteudoDoZip({ txt, audios, bytesTexto: 200 * 1024 });
  assert.ok(plano.resumo.bytesEstimados <= LIMITE_ENVIO_BYTES - MARGEM_ENVIO_BYTES, "cabe no envio");
  assert.ok(plano.manter.length > 0, "e os áudios mais recentes continuam indo");
}

// ── 4. O servidor não foi mexido ─────────────────────────────────────────────────────────────
// Se um arquivo visual chegar por outro caminho, a leitura continua existindo. Reverter o ENVIO
// não é apagar a capacidade — é o dono decidindo o que sai do aparelho dele.
{
  const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  assert.match(pipeline, /export function arquivoVisualLegivel\(nome\)/, "o servidor continua sabendo ler foto e PDF");
  assert.match(pipeline, /export async function lerArquivosVisuais\(/);
}

console.log("v1358-so-texto-e-audio-na-importacao: ok");
