import fs from "node:fs";
import assert from "node:assert/strict";
import { estimarCustoUsd, chavePrecoDoModelo, modeloTemPrecoConhecido } from "../api/_iaCusto.js";

// v1362 — O PAINEL MOSTRAVA O CUSTO DA ANÁLISE CINCO VEZES MAIOR DO QUE É.
//
// O dono trouxe (22/08/2026) uma análise de custo de outra fonte, com os preços públicos:
// gpt-5.6-terra US$ 1 / US$ 6 por milhão de tokens (entrada/saída), luna US$ 0,10 / US$ 0,60.
//
// Conferindo no código: a análise principal usa gpt-5.6-terra desde a v1308, e esse nome NUNCA
// entrou no mapa de preços. Sem a linha, toda análise — a chamada mais cara e mais frequente do
// app — caía no "_padrao" ($5/$15), que existe de propósito pra ser exagero. Ou seja: quem olhasse
// o painel pra decidir preço, ou pra decidir cortar qualidade em nome de economia, estava olhando
// um número inflado em ~5x. Decisão cara tomada em cima de número errado.
//
// Este teste tranca o preço real e, principalmente, a REGRA: modelo em uso pelo app precisa estar
// no mapa. Modelo sem preço conferido continua no "_padrao" de propósito — subestimar é o único
// erro que engana de verdade quem está definindo preço.

// ── 1. O modelo da análise tem preço próprio ─────────────────────────────────────────────────
assert.equal(chavePrecoDoModelo("gpt-5.6-terra"), "gpt-5.6-terra");
assert.equal(modeloTemPrecoConhecido({ kind: "chat", model: "gpt-5.6-terra" }), true);
assert.equal(modeloTemPrecoConhecido({ kind: "chat", model: "gpt-5.6-luna" }), true);
// E o sufixo de data que a OpenAI devolve continua sendo tratado (v1288).
assert.equal(chavePrecoDoModelo("gpt-5.6-terra-2026-07-01"), "gpt-5.6-terra");

// ── 2. O número, conferido na conta ──────────────────────────────────────────────────────────
{
  const um = (n) => Number(n.toFixed(4));
  // 1 milhão de entrada = US$ 1; 1 milhão de saída = US$ 6.
  assert.equal(um(estimarCustoUsd({ kind: "chat", model: "gpt-5.6-terra", promptTokens: 1e6, completionTokens: 0 })), 1);
  assert.equal(um(estimarCustoUsd({ kind: "chat", model: "gpt-5.6-terra", promptTokens: 0, completionTokens: 1e6 })), 6);
  assert.equal(um(estimarCustoUsd({ kind: "chat", model: "gpt-5.6-luna", promptTokens: 1e6, completionTokens: 0 })), 0.1);
  assert.equal(um(estimarCustoUsd({ kind: "chat", model: "gpt-5.6-luna", promptTokens: 0, completionTokens: 1e6 })), 0.6);
}
// Uma análise de verdade: o painel mostrava quase 4x isso.
{
  const real = estimarCustoUsd({ kind: "chat", model: "gpt-5.6-terra", promptTokens: 10000, completionTokens: 2000 });
  const antes = estimarCustoUsd({ kind: "chat", model: "modelo-que-nao-existe", promptTokens: 10000, completionTokens: 2000 });
  assert.ok(real < antes / 3, `o exagero do "_padrao" precisa ter saído da conta (real ${real}, antes ${antes})`);
  assert.ok(real > 0.02 && real < 0.025, `análise normal fica em torno de 2 centavos de dólar (deu ${real})`);
}

// ── 3. A REGRA: todo modelo que o app usa por padrão precisa ter preço ──────────────────────
// É esta conferência que impede o furo de voltar quando alguém trocar o modelo da análise.
{
  const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  const bloco = pipeline.slice(pipeline.indexOf("const MODELOS_PADRAO = {"), pipeline.indexOf("export const ARQUITETURA_MENSAGENS_ATUAL"));
  const usados = [...bloco.matchAll(/:\s*"([a-z0-9.\-]+)"/gi)].map(m => m[1]);
  assert.ok(usados.length >= 5, `sanidade: achei os modelos padrão (${usados.join(", ")})`);
  for (const modelo of usados) {
    const kind = /whisper/i.test(modelo) ? "whisper" : "chat";
    assert.equal(modeloTemPrecoConhecido({ kind, model: modelo }), true,
      `"${modelo}" é usado pelo app e não tem preço no mapa — o painel vai inflar o custo dele`);
  }
}

// ── 4. Modelo desconhecido continua superestimado, de propósito ─────────────────────────────
// Chutar preço pra baixo é o único erro que engana de verdade: faria o custo parecer menor do que é.
assert.equal(modeloTemPrecoConhecido({ kind: "chat", model: "gpt-5.6-sol" }), false,
  "sol não tem preço conferido: fica no _padrao e aparece nomeado como aviso no painel");
{
  const desconhecido = estimarCustoUsd({ kind: "chat", model: "gpt-9-turbo", promptTokens: 1e6, completionTokens: 0 });
  assert.equal(desconhecido, 5, "modelo fora do mapa segue no exagero deliberado");
}

console.log("v1362-preco-real-da-analise-no-painel: ok");
