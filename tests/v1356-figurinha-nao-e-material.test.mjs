import fs from "node:fs";
import assert from "node:assert/strict";
import { parseWhatsappTxt, contarMaterialNaoLido, ehFigurinha, arquivoVisualLegivel } from "../api/_pipeline.js";
import { escolherVisuaisDoZip } from "../js/enxugar-zip.js";

// v1356 — FIGURINHA É REAÇÃO, NÃO É MATERIAL PRA ANALISAR.
//
// Prints do dono (22/08/2026, 01h54). O cliente Vande respondeu com o joinha da Scania — uma
// figurinha, o "ok, combinado" dele. O app registrou "Foto enviada — a IA não leu o conteúdo",
// contou como foto pendente, e a ANÁLISE montou o plano do dia em cima disso:
//
//   Fazer agora: "Esclarecer o conteúdo e a intenção da imagem enviada por Vande."
//   Mensagem 1:  "Ontem você me mandou uma imagem... Ela é para eu olhar algum horário ou alguma
//                 informação do apartamento?"
//
// Ou seja: o app ia fazer o corretor perguntar ao cliente o que ele quis dizer com um joinha.
// Passar vergonha com o cliente é pior do que não analisar.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// ── 1. O nome que o WhatsApp dá pra figurinha é reconhecido ──────────────────────────────────
for (const nome of ["STK-20260821-WA0012.webp", "stk-20260821-wa0012.webp", "WhatsApp/Media/STK-20260101-WA0001.webp"]) {
  assert.equal(ehFigurinha(nome), true, `${nome} é figurinha`);
}
for (const nome of ["IMG-20260821-WA0009.jpg", "ARTE-PROMO.webp", "tabela.pdf", "PTT-1.opus", "foto-do-apartamento.png"]) {
  assert.equal(ehFigurinha(nome), false, `${nome} NÃO é figurinha — não pode ser engolido pela regra`);
}

// ── 2. Na conversa, ela aparece pelo que é ───────────────────────────────────────────────────
{
  const timeline = parseWhatsappTxt([
    "[21/08/2026 11:59] Miguel: Vamos falando por whats tambem",
    "[21/08/2026 12:24] Vande: STK-20260821-WA0012.webp (arquivo anexado)",
    "[21/08/2026 12:30] Vande: figurinha omitida",
    "[21/08/2026 12:31] Vande: IMG-20260821-WA0009.jpg (arquivo anexado)"
  ].join("\n"));
  const figurinhas = timeline.filter(m => /Figurinha enviada/.test(m.text));
  assert.equal(figurinhas.length, 2, "as duas formas (arquivo STK e linha 'figurinha omitida') viram figurinha");
  assert.match(figurinhas[0].text, /é uma reação, não tem texto pra ler/,
    "a conversa precisa DIZER que é reação — é assim que a IA para de inventar intenção");
  assert.ok(!figurinhas.some(m => /conteúdo não analisado/.test(m.text)),
    "figurinha não pode mais ser anunciada como arquivo não lido");
  // A foto de verdade continua sendo foto.
  assert.ok(timeline.some(m => /imagem — conteúdo não analisado/.test(m.text)), "foto de verdade não muda");
}

// ── 3. Não conta como material pendente, não vai pra leitura, não viaja no envio ─────────────
{
  const timeline = parseWhatsappTxt([
    "[21/08/2026 12:24] Vande: STK-20260821-WA0012.webp (arquivo anexado)",
    "[21/08/2026 12:31] Vande: IMG-20260821-WA0009.jpg (arquivo anexado)"
  ].join("\n"));
  const c = contarMaterialNaoLido(timeline);
  assert.equal(c.imagens, 1, "só a foto de verdade conta — a figurinha não tem o que ler");
  assert.equal(c.total, 1, "era isso que fazia a tela dizer 'a IA ainda não leu 1 foto' por causa de um joinha");
}
assert.equal(arquivoVisualLegivel("STK-20260821-WA0012.webp"), false,
  "figurinha não vai pra leitura de imagem: não tem texto comercial e a chamada é paga");
assert.equal(arquivoVisualLegivel("IMG-20260821-WA0009.jpg"), true);
assert.equal(arquivoVisualLegivel("tabela.pdf"), true);
{
  const txt = [
    "[21/08/2026 12:24] Vande: STK-20260821-WA0012.webp (arquivo anexado)",
    "[21/08/2026 12:31] Vande: IMG-20260821-WA0009.jpg (arquivo anexado)"
  ].join("\n");
  const r = escolherVisuaisDoZip({ txt, visuais: [
    { caminho: "STK-20260821-WA0012.webp", bytes: 60 * 1024 },
    { caminho: "IMG-20260821-WA0009.jpg", bytes: 300 * 1024 }
  ] });
  assert.deepEqual(r.manter, ["IMG-20260821-WA0009.jpg"],
    "a figurinha não ocupa o espaço apertado das fotos que têm conteúdo");
}

// ── 4. Na tela, uma linha que o corretor entende ─────────────────────────────────────────────
{
  const fonte = [
    app.match(/const CP1348_MARCADOR = [\s\S]*?\n  \};/)[0],
    app.match(/const CP1356_FIGURINHA = [\s\S]*?;/)[0],
    app.match(/function cp1348TextoNaTela\(texto\)\{[\s\S]*?\n  \}/)[0]
  ].join("\n");
  const curto = new Function(`${fonte}\nreturn cp1348TextoNaTela;`)();
  assert.equal(curto("[Figurinha enviada — é uma reação, não tem texto pra ler]"),
    "👍 Figurinha (reação do cliente)");
  // As outras linhas continuam como estavam.
  assert.equal(curto("[Arquivo enviado nesta mensagem: imagem — conteúdo não analisado pela IA]"),
    "📎 Foto enviada — a IA não leu o conteúdo");
  assert.equal(curto("Bom dia fica melhor, estou em visita ao cliente"),
    "Bom dia fica melhor, estou em visita ao cliente");
}

console.log("v1356-figurinha-nao-e-material: ok");
