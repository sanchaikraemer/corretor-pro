import fs from "node:fs";
import assert from "node:assert/strict";
import * as pipe from "../api/_pipeline.js";
import { calcularContextoTemporalMensagens } from "../api/_pipeline.js";

// v850 — O Cérebro Comercial (no prompt) passou a ser a ÚNICA autoridade sobre as três
// mensagens. Todo o motor de regras do código (parser de proibidas, validação, correção,
// fallback determinístico) foi REMOVIDO — ele estava estragando as regras do corretor
// (proibia a própria alternativa que o corretor mandava usar) e injetando regras
// concorrentes. Este teste garante que essa camada não volte a existir no código.

// 1. As funções do antigo motor de regras não podem mais existir/ser exportadas.
for (const nome of [
  "compilarRegrasObjetivasCerebro",
  "validarMensagensCerebro",
  "aplicarCorrecoesDeterministicasCerebro",
  "construirMensagensDeterministicasCerebro",
  "sanitizarMensagemDeterministica",
]) {
  assert.equal(pipe[nome], undefined, `${nome} deveria ter sido removida — o Cérebro é a única autoridade`);
}

const src = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");

// 2. analyzeWithBrain não pode mais chamar nenhuma dessas funções.
for (const nome of [
  "validarMensagensCerebro",
  "aplicarCorrecoesDeterministicasCerebro",
  "corrigirMensagensPelasRegras",
  "construirMensagensDeterministicasCerebro",
  "sanitizarMensagemDeterministica",
]) {
  assert.ok(!src.includes(nome), `o código não pode mais mencionar ${nome}`);
}

// 3. Não pode sobrar fallback genérico nem lista de proibidas cravada.
assert.ok(!src.includes("PADROES_GENERICOS_RETOMADA"), "o padrão genérico de retomada foi removido");
assert.ok(!src.includes("mensagensGeradasPorFallback = true"), "não pode existir caminho que marque fallback gerado");

// 4. O prompt do sistema precisa afirmar que o Cérebro é autoridade absoluta.
assert.ok(/AUTORIDADE ABSOLUTA/.test(src), "o system prompt precisa declarar o Cérebro como autoridade absoluta");
assert.ok(/autoridade máxima/i.test(src), "o prompt precisa reforçar que o Cérebro é a autoridade máxima");

// 5. A função factual de tempo (usada para alimentar o prompt) continua existindo e viva.
const ctx = calcularContextoTemporalMensagens([
  { date: "01/01/2026", time: "10:00", author: "Cliente", text: "oi", iso: "2026-01-01T13:00:00.000Z" }
], {}, new Date("2026-01-20T13:00:00.000Z"));
assert.equal(typeof ctx.dias, "number", "o contexto temporal ainda calcula os dias corridos (fato para o prompt)");
assert.ok(ctx.dias >= 18 && ctx.dias <= 20, `dias corridos esperados ~19, veio ${ctx.dias}`);

console.log("v850-cerebro-autoridade: ok");
