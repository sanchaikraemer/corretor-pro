import fs from "node:fs";
import assert from "node:assert/strict";
import { contarCerebroEnviado } from "../api/_pipeline.js";

// v1304 — pedido do dono (18/08/2026, com o print da linha embaixo das sugestões): "mude esses
// números para percentual, verde 100% e quando não conclui vermelho".
//
// A linha mostrava seis contagens de caracteres ("método 6.577, tom 1.892, diferenciais 2.519, o
// que evitar 3.115, regras 6.037, objeções 6.319 — 26.459 caracteres") e ele tinha que somar de
// cabeça pra saber se estava tudo lá. Agora é uma porcentagem só, e ela responde a pergunta certa:
// quanto do Cérebro SALVO chegou na IA nesta análise.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// ── 1. Cérebro inteiro dentro dos tetos = 100% ────────────────────────────────────────────────
{
  const cheio = {
    metodo: "a".repeat(6577), tom: "b".repeat(1892), diferenciais: "c".repeat(2519),
    evitar: "d".repeat(3115), regrasTexto: "e".repeat(6037), objecoesTexto: "f".repeat(6319)
  };
  const r = contarCerebroEnviado(cheio);
  assert.equal(r.total, 26459, "o total enviado continua sendo contado");
  assert.equal(r.salvo, 26459, "e agora também o que estava salvo");
  assert.equal(r.percentual, 100, "nada cortado = 100%");
}

// ── 2. Campo acima do teto = menos de 100% (o corte era invisível) ────────────────────────────
{
  // O teto por campo livre é 20.000 caracteres (sanitizeCerebroConfig).
  const estourado = { metodo: "a".repeat(30000), tom: "b".repeat(1000) };
  const r = contarCerebroEnviado(estourado);
  assert.equal(r.total, 21000, "só o que coube foi enviado");
  assert.equal(r.salvo, 31000, "o salvo é maior que o enviado");
  assert.ok(r.percentual < 100 && r.percentual > 0, `precisa acusar corte (veio ${r.percentual}%)`);
  assert.equal(r.percentual, 68, "e a conta é enviado ÷ salvo");
}

// ── 3. Sem Cérebro nenhum: 0%, não 100% ───────────────────────────────────────────────────────
{
  const r = contarCerebroEnviado({});
  assert.equal(r.total, 0);
  assert.equal(r.percentual, 0, "conta zerada não pode aparecer como 100% na tela");
}

// ── 4. A tela mostra porcentagem colorida e não mostra mais contagem de caracteres ────────────
{
  assert.ok(app.includes("function cp1304Pct("), "a tela precisa da função que pinta a porcentagem");
  assert.match(app, /n >= 100 \? "var\(--green\)" : "var\(--risco\)"/,
    "100% verde, menos que isso vermelho — foi o pedido do dono");
  assert.ok(app.includes("` · seu Cérebro: ${cp1304Pct(pct)}`"), "a linha do Cérebro passa a ser porcentagem");
  assert.ok(!app.includes('rot = { metodo:"método", tom:"tom", diferenciais:"diferenciais"'),
    "a lista de contagens de caracteres não pode voltar pra linha");
  assert.ok(app.includes("cp1304Pct(100)"), "conversa lida inteira também aparece como 100%");
}

console.log("v1304-cerebro-em-porcentagem: ok");
