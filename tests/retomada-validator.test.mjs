import assert from "node:assert/strict";
import { calcularContextoTemporalMensagens, validarMensagensCerebro } from "../api/_pipeline.js";

const cfg = { metodo: "Retome de forma natural o assunto após 7 dias desde a última mensagem." };
const timeline = [
  { date: "09/05/2026", time: "18:30", author: "Daniele", text: "Gostei do Renaissance, mas não tenho entrada agora. Queria entender o apartamento 604 e as condições." }
];
const agora = new Date("2026-07-13T15:00:00-03:00");
const contexto = calcularContextoTemporalMensagens(timeline, cfg, agora);
assert.equal(contexto.limiar, 7);
assert.equal(contexto.dias, 65);
assert.equal(contexto.modo, "retomada");

const ruins = validarMensagensCerebro({
  a: "Oi Daniele, tudo certo? Passando pra saber se pensou com carinho no Renaissance. Só me chamar!",
  b: "Olá Daniele! Espero que esteja bem. Fico à disposição se quiser retomar a conversa sobre o 604.",
  c: "Daniele, conseguiu analisar as condições do Renaissance? Posso tentar negociar algo especial pra você."
}, contexto, timeline);
assert.equal(ruins.ok, false);
assert.ok(ruins.motivos.some(x => /genérica/.test(x)));
assert.ok(ruins.motivos.some(x => /não termina com pergunta/.test(x)));

const boas = validarMensagensCerebro({
  a: "Daniele, naquela condição do Renaissance sem entrada, o ponto principal era deixar a parcela confortável. Qual valor mensal ficaria viável para você hoje?",
  b: "Daniele, sobre o apartamento 604 que você tinha gostado, vale eu recalcular uma condição sem entrada para você comparar?",
  c: "Daniele, a dificuldade no Renaissance era a entrada. Você quer que eu tente uma composição priorizando parcelas menores?"
}, contexto, timeline);
assert.equal(boas.ok, true);

const recente = calcularContextoTemporalMensagens([
  { date: "12/07/2026", time: "10:00", text: "Pode me mandar a planta do 604?" }
], cfg, agora);
assert.equal(recente.modo, "continuidade");
assert.equal(recente.dias, 1);

console.log("retomada-validator: ok");

// Teste integrado: a primeira resposta viola o Cérebro; o motor deve chamar a
// correção dedicada e só liberar o trio após a segunda validação.
const chamadas = [];
const respostas = [
  {
    summary: "Daniele quer o Renaissance 604, mas não tem entrada.",
    diagnostico: {
      ultimaPessoaFalar: "Cliente",
      produtoPrincipal: "Renaissance 604",
      objecaoPrincipal: "Sem entrada",
      quemDeveAgirAgora: "Corretor",
      etapaFunil: "Negociação"
    },
    mensagens: {
      recomendada: "Oi Daniele, passando pra saber se pensou com carinho no Renaissance. Só me chamar!",
      maisSuave: "Olá Daniele, fico à disposição se quiser retomar a conversa sobre o 604.",
      maisDireta: "Daniele, conseguiu analisar o Renaissance? Posso negociar algo especial pra você."
    },
    produtoInteresse: "Renaissance 604",
    produtosInteresse: ["Renaissance 604"],
    etapaSugerida: "Negociação",
    clientProfile: "Busca apartamento sem entrada",
    nextAction: "Reabrir a negociação"
  },
  {
    mensagens: {
      recomendada: "Daniele, naquela condição do Renaissance sem entrada, qual parcela ficaria confortável para você hoje?",
      maisSuave: "Daniele, sobre o apartamento 604 que você tinha gostado, vale eu recalcular uma condição sem entrada para você comparar?",
      maisDireta: "Daniele, a dificuldade no Renaissance era a entrada. Você quer que eu tente uma composição priorizando parcelas menores?"
    }
  }
];
const openaiMock = {
  chat: {
    completions: {
      create: async (payload) => {
        chamadas.push(payload);
        const data = respostas.shift();
        return { model: "mock-gpt", choices: [{ message: { content: JSON.stringify(data) } }] };
      }
    }
  }
};
const { analyzeWithBrain } = await import("../api/_pipeline.js");
const integrada = await analyzeWithBrain({
  lead: { clientName: "Daniele" },
  timeline,
  openai: openaiMock,
  cerebroConfig: cfg
});
assert.equal(chamadas.length, 2);
assert.equal(chamadas[0].messages[0].role, "system");
assert.equal(integrada.mensagensCorrigidasPelaValidacao, true);
assert.equal(integrada.sugestoesPendentes, false);
assert.match(integrada.messages.a, /\?$/);
assert.match(integrada.messages.b, /\?$/);
assert.match(integrada.messages.c, /\?$/);

console.log("retomada-validator-integrado: ok");
