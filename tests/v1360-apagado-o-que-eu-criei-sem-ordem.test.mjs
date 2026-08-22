import fs from "node:fs";
import assert from "node:assert/strict";
import { parseWhatsappTxt, contarMaterialNaoLido, ehFigurinha } from "../api/_pipeline.js";

// v1360 — APAGADO O QUE EU CRIEI SEM ORDEM DO DONO (22/08/2026).
//
// Ele apontou quatro coisas, uma por print, e confirmou que todas eram minhas, sem pedido dele:
//
//   1. "quero saber de figurinha de reação, suma com isso e apague do código essas linhas
//      desnecessárias" — a linha "👍 Figurinha (reação do cliente)" (v1356);
//   2. "como assim a IA não leu um PDF se não importa PDF?" — o aviso de material não lido
//      (v1323/v1348), que virou aviso de algo impossível depois que foto e PDF pararam de ser
//      enviados (v1358, ordem dele);
//   3. o botão "Ler fotos, PDFs e áudios" no card de observação (v1349);
//   4. a linha vermelha clicável do histórico, "Toque para mandar este arquivo" (v1350).
//
// Os três últimos existiam só pra contornar as fotos e PDFs que não chegavam no servidor. Como
// eles não são mais enviados, tudo aquilo virou remendo de um problema que não existe.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const importacao = fs.readFileSync(new URL("../js/importacao.js", import.meta.url), "utf8");
const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const cerebro = fs.readFileSync(new URL("../api/cerebro-config.js", import.meta.url), "utf8");
const lead = fs.readFileSync(new URL("../api/reanalisar-lead.js", import.meta.url), "utf8");

// ── 1. Figurinha não aparece mais na conversa ────────────────────────────────────────────────
{
  const timeline = parseWhatsappTxt([
    "[21/08/2026 11:59] Miguel: Vamos falando por whats tambem",
    "[21/08/2026 12:24] Vande: STK-20260821-WA0012.webp (arquivo anexado)",
    "[21/08/2026 12:30] Vande: figurinha omitida",
    "[21/08/2026 12:31] Vande: Beleza"
  ].join("\n"));
  assert.equal(timeline.length, 2, "as duas figurinhas somem — sobram as duas falas de verdade");
  assert.deepEqual(timeline.map(m => m.text), ["Vamos falando por whats tambem", "Beleza"]);
  assert.ok(!/Figurinha/i.test(app), "e nada de figurinha sobrou na tela");
}
// O reconhecimento continua existindo — é ele que faz a figurinha sumir em vez de virar "foto".
assert.equal(ehFigurinha("STK-20260821-WA0012.webp"), true);
assert.equal(ehFigurinha("IMG-20260821-WA0009.jpg"), false, "foto de verdade não pode ser engolida");

// ── 2. O aviso de "material não lido" sumiu das duas telas ──────────────────────────────────
assert.match(app, /function cp1323MaterialNaoLido\(\)\{ return ""; \}/,
  "a linha de prova não avisa mais sobre foto/PDF que a IA não leu — eles não são enviados");
assert.ok(!/a IA ainda não leu/.test(app), "nem em outro canto da tela");
assert.match(importacao, /const materialNaoLidoHtml = "";/, "e a tela da importação também não");
// A conta agora é só de áudio, que é o único que continua sendo enviado e transcrito.
{
  const timeline = parseWhatsappTxt([
    "[21/08/2026 12:24] Vande: IMG-1.jpg (arquivo anexado)",
    "[21/08/2026 12:25] Vande: tabela.pdf (arquivo anexado)",
    "[21/08/2026 12:26] Vande: audio omitted"
  ].join("\n"));
  const c = contarMaterialNaoLido(timeline);
  assert.deepEqual(c, { audios: 1, total: 1 }, "só áudio conta — foto e PDF não são enviados, não há o que contar");
}

// ── 3 e 4. O botão e a linha clicável não existem mais, nem o que os servia ──────────────────
// O comentário que EXPLICA a remoção cita os nomes removidos, de propósito, pra quem abrir o
// arquivo depois. As conferências olham só o código.
const semComentarios = (t) => t.replace(/^\s*\/\/.*$/gm, "");
for (const [nome, fonte] of [["app.js", semComentarios(app)], ["js/importacao.js", semComentarios(importacao)]]) {
  assert.ok(!/cp1349|cp1350|cp1352|Ler fotos, PDFs e áudios|Toque para mandar este arquivo/.test(fonte),
    `${nome} ainda tem restos do botão/linha que eu criei sem ordem`);
}
assert.ok(!/ler-arquivos/.test(cerebro), "a rota que lia os arquivos avulsos saiu junto");
assert.ok(!/preencher-arquivo/.test(lead), "e a que escrevia o texto dentro da mensagem também");
assert.ok(!/lerArquivosVisuais|verificarLimiteLeituraVisual/.test(cerebro),
  "sem a ação, os imports dela viravam peso morto");

// ── O que NÃO podia ser levado junto ─────────────────────────────────────────────────────────
// "Ler print da resposta" (v1250) é do dono, pedido por ele, e continua. O servidor também
// continua sabendo ler foto/PDF — o que mudou foi o que o aparelho envia, não a capacidade.
assert.match(app, /Ler print da resposta<\/button>/, "o botão de ler print é do dono e fica");
assert.match(app, /id="cp1250PrintInput"/);
assert.match(pipeline, /export function arquivoVisualLegivel\(nome\)/, "o servidor não foi mexido");
assert.match(pipeline, /export async function lerArquivosVisuais\(/);

// ── 5. "FAZ 7 DIAS?" — o número errado, e o jeito errado de abrir ───────────────────────────
// Print do dono: as três sugestões abriam com "Faz 7 dias que deixamos a visita...". A última
// mensagem tinha sido no dia anterior. Os 7 dias são o PRAZO DE RETOMADA configurado por ele — um
// prazo pra frente. Os dois números chegavam lado a lado no pedido e a IA somou tudo numa frase.
{
  const { montarFicharioDaConversa } = await import("../api/_pipeline.js");
  const timeline = parseWhatsappTxt([
    "[20/08/2026 21:07] Construtora Senger: As 14h fica bom?",
    "[21/08/2026 12:24] Vande: Bom dia fica melhor, estou em visita ao cliente"
  ].join("\n"));
  const f = montarFicharioDaConversa(timeline, "Sanchai", { clientName: "Vande" }, new Date("2026-08-22T14:00:00Z"));
  assert.match(f, /HÁ QUANTO TEMPO ESTA CONVERSA ESTÁ PARADA/, "o app precisa dizer o número de verdade");
  assert.match(f, /Última mensagem: 21\/08\/2026 — ONTEM — 1 dia parado/, "1 dia, não 7");
  assert.match(f, /é tempo pra frente, não tempo parado/, "e separar o prazo de retomada do tempo parado");
  assert.match(f, /não abra mensagem contando dia parado/, "abrir contando dia é cobrança — o app já reprova isso");
}
// Hoje mesmo e conversa antiga: o texto acompanha, sem inventar número.
{
  const { montarFicharioDaConversa } = await import("../api/_pipeline.js");
  const hoje = montarFicharioDaConversa(
    parseWhatsappTxt("[22/08/2026 09:00] Vande: bom dia, tudo certo?"),
    "Sanchai", { clientName: "Vande" }, new Date("2026-08-22T14:00:00Z"));
  assert.match(hoje, /HOJE MESMO/);
  const velha = montarFicharioDaConversa(
    parseWhatsappTxt("[01/08/2026 09:00] Vande: bom dia, tudo certo?"),
    "Sanchai", { clientName: "Vande" }, new Date("2026-08-22T14:00:00Z"));
  assert.match(velha, /há 21 dias/);
}

// ── 6. O "Sr" em toda frase — estrago da minha própria correção de ontem ────────────────────
// Print do dono: "sr. sr. sr sr sr, quantas mil vez isso?". Pra tirar o "vocês" (v1357) eu mandei
// "mantenha esse tratamento", e a IA passou a enfiar "o Sr" em cada frase. Um defeito trocado por
// outro. A instrução agora limita a UMA vez por mensagem e manda usar o nome.
{
  const { montarFicharioDaConversa } = await import("../api/_pipeline.js");
  const f = montarFicharioDaConversa(
    parseWhatsappTxt([
      "[20/08/2026 21:07] Construtora Senger: As 14h fica bom para o Sr?",
      "[21/08/2026 12:24] Vande: Bom dia fica melhor, estou em visita ao cliente"
    ].join("\n")), "Sanchai", { clientName: "Vande" }, new Date("2026-08-22T14:00:00Z"));
  assert.match(f, /NO MÁXIMO UMA VEZ por mensagem/, "o tratamento não pode voltar a ser repetido em toda frase");
  assert.match(f, /chamar a pessoa pelo NOME na abertura/);
  assert.ok(!/mantenha esse tratamento/.test(f), "a frase que causou o estrago não pode continuar");
  // E o conserto do "vocês" continua de pé — não é pra trocar um defeito pelo outro de novo.
  assert.match(f, /Não use "vocês"/);
}

console.log("v1360-apagado-o-que-eu-criei-sem-ordem: ok");
