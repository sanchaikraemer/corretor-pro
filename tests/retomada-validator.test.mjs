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
// v1331 — a análise em duas etapas existe, mas entra DESLIGADA (só liga com etapas=2). No modo
// padrão continua valendo o de sempre: uma chamada só, e nenhuma segunda chamada reescrevendo o
// texto que a IA já escreveu. O modo novo tem teste próprio (v1331).
// v1332 — o modo de duas etapas passou a ser o PADRÃO: a IA entende primeiro (chamada 1) e
// escreve as três depois (chamada 2). O que este teste sempre guardou continua: nenhuma chamada
// REESCREVE texto já escrito — a segunda recebe o diagnóstico, nunca as mensagens da primeira.
assert.equal(chamadas.length, 2, "a análise usa duas chamadas: a leitura e a redação das três");
const pedidoDaRedacao = chamadas[1].messages.find(m => m.role === "user")?.content || "";
for (const jaEscrita of [resposta.mensagens.recomendada, resposta.mensagens.maisSuave, resposta.mensagens.maisDireta]) {
  assert.ok(!pedidoDaRedacao.includes(jaEscrita),
    "a etapa de redação não pode receber mensagem pronta pra reescrever");
}
const system = chamadas[0].messages.find(m => m.role === "system")?.content || "";
// v1291 — o dono reescreveu o texto das instruções: o Cérebro passou de "única autoridade" para
// "autoridade máxima sobre método, análise, estratégia, tom, objeções e condução". A garantia
// checada aqui é a mesma de sempre: o Cérebro manda, e nada monta um segundo manual por fora dele.
assert.match(system, /autoridade máxima/i);
assert.match(system, /Não crie um segundo playbook por fora dele/i);
assert.match(system, /Não use "faz x dias que conversamos"; então diga "faz alguns dias que conversamos"\./);
assert.equal(resultado.messages.a, resposta.mensagens.recomendada);
assert.equal(resultado.messages.b, resposta.mensagens.maisSuave);
assert.equal(resultado.messages.c, resposta.mensagens.maisDireta);
assert.equal(resultado.sugestoesPendentes, false);

console.log("retomada-validator: ok");
