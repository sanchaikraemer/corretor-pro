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
// v1330 — a análise passou a ter DUAS etapas: ler (chamada 1) e escrever as três mensagens
// (chamada 2), cada uma fazendo uma coisa só. O que este teste sempre guardou continua de pé, e
// agora está escrito com todas as letras: nenhuma chamada REESCREVE texto já escrito pela IA — a
// segunda recebe o diagnóstico, não as mensagens da primeira.
assert.equal(chamadas.length, 2, "a análise usa duas chamadas: a leitura e a redação das três");
const pedidoDaRedacao = chamadas[1].messages.find(m => m.role === "user")?.content || "";
for (const jaEscrita of [resposta.mensagens.recomendada, resposta.mensagens.maisSuave, resposta.mensagens.maisDireta]) {
  assert.ok(!pedidoDaRedacao.includes(jaEscrita),
    "a etapa de redação não pode receber mensagem pronta pra reescrever — ela escreve, não conserta");
}
const system = chamadas[0].messages.find(m => m.role === "system")?.content || "";
const systemDaRedacao = chamadas[1].messages.find(m => m.role === "system")?.content || "";
assert.equal(systemDaRedacao, system, "o Cérebro manda igual nas duas etapas");
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
