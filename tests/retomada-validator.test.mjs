import assert from "node:assert/strict";
import { analyzeWithBrain, calcularContextoTemporalMensagens, validarFormatoMensagens } from "../api/_pipeline.js";

const timeline = [
  { date: "09/05/2026", time: "18:30", author: "Daniele", text: "Gostei do apartamento e quero entender as condições." }
];
const agora = new Date("2026-07-13T15:00:00-03:00");
const contexto = calcularContextoTemporalMensagens(timeline, { metodo: "qualquer regra" }, agora);
assert.equal(contexto.dias, 65);
assert.equal(contexto.ultimaData, "09/05/2026");
assert.equal("modo" in contexto, false, "o código não deve classificar continuidade/retomada");
assert.equal("limiar" in contexto, false, "o código não deve extrair limiar comercial do Cérebro");

assert.equal(validarFormatoMensagens({ a: "A", b: "B", c: "C" }).ok, true);
assert.equal(validarFormatoMensagens({ a: "A", b: "", c: "C" }).ok, false);

const chamadas = [];
const resposta = {
  summary: "Resumo",
  diagnostico: { produtoPrincipal: "Produto", etapaFunil: "Atendimento" },
  mensagens: {
    recomendada: "Bom dia, Daniele, mensagem um?",
    maisSuave: "Bom dia, Daniele, mensagem dois?",
    maisDireta: "Bom dia, Daniele, mensagem três?"
  },
  produtoInteresse: "Produto",
  produtosInteresse: ["Produto"],
  etapaSugerida: "Atendimento",
  clientProfile: "Perfil",
  nextAction: "Ação"
};
const openaiMock = {
  chat: { completions: { create: async payload => {
    chamadas.push(payload);
    return { model: "mock-gpt", choices: [{ message: { content: JSON.stringify(resposta) } }] };
  } } }
};
const cerebro = {
  metodo: 'Não use "faz x dias que conversamos"; então diga "faz alguns dias que conversamos".',
  tom: "Tom definido pelo corretor.",
  regras: [{ texto: "Regra editável de teste." }]
};
const resultado = await analyzeWithBrain({
  lead: { clientName: "Daniele" }, timeline, openai: openaiMock, cerebroConfig: cerebro
});
assert.equal(chamadas.length, 1, "a análise deve usar uma única chamada à IA");
const system = chamadas[0].messages.find(m => m.role === "system")?.content || "";
assert.match(system, /única autoridade/i);
assert.match(system, /Respeite integralmente todas as regras do Cérebro Comercial/i);
assert.match(system, /Não use "faz x dias que conversamos"; então diga "faz alguns dias que conversamos"\./);
assert.equal(resultado.messages.a, resposta.mensagens.recomendada);
assert.equal(resultado.messages.b, resposta.mensagens.maisSuave);
assert.equal(resultado.messages.c, resposta.mensagens.maisDireta);
assert.equal(resultado.sugestoesPendentes, false);

console.log("retomada-validator: ok");
