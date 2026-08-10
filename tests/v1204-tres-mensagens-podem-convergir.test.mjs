// v1204 — as três sugestões podem convergir para o MESMO próximo passo quando só existe um
// passo adequado.
//
// Por que este teste existe: o pedido fixo da análise (que vai junto em TODA execução, fora do
// Cérebro) mandava "reescreva até virarem três caminhos realmente distintos". O Cérebro Comercial
// do corretor (documento V3, 10/08/2026) diz o contrário: se objetivamente só existe um próximo
// passo adequado, as três podem convergir por abordagens diferentes. As duas instruções chegavam
// juntas na mesma análise e se contradiziam — o resultado ficava imprevisível, e no pior caso a
// IA inventava um terceiro passo pior só pra diferenciar as mensagens.
//
// O Cérebro é a autoridade sobre estratégia; o pedido fixo passou a concordar com ele.
import assert from "node:assert/strict";
import { analyzeWithBrain } from "../api/_pipeline.js";

const timeline = [
  { date: "05/08/2026", time: "10:12", author: "Rose", text: "Pode mandar a simulação sim, por favor." }
];

const resposta = {
  summary: "Resumo",
  diagnostico: { ultimaPessoaFalar: "contato" },
  mensagens: { recomendada: "Mensagem um", maisSuave: "Mensagem dois", maisDireta: "Mensagem três" },
  produtoInteresse: "Produto",
  produtosInteresse: ["Produto"],
  etapaSugerida: "Atendimento",
  clientProfile: "Perfil",
  nextAction: "Ação"
};

const chamadas = [];
const openaiMock = {
  chat: { completions: { create: async payload => {
    chamadas.push(payload);
    return { model: "mock-gpt", choices: [{ message: { content: JSON.stringify(resposta) } }] };
  } } }
};

await analyzeWithBrain({
  lead: { clientName: "Rose" },
  timeline,
  openai: openaiMock,
  cerebroConfig: { metodo: "Regra de teste do corretor.", tom: "Tom do corretor." }
});

assert.equal(chamadas.length, 1, "a análise deve usar uma única chamada à IA");
const pedido = chamadas[0].messages.find(m => m.role === "user")?.content || "";

// A ordem antiga, absoluta, não pode voltar: era ela que brigava com o Cérebro.
assert.doesNotMatch(
  pedido,
  /reescreva até virarem três caminhos realmente distintos/i,
  "o pedido não pode mais exigir três próximos passos diferentes em qualquer situação"
);

// A exceção precisa estar escrita, e precisa dizer que a convergência é por caminhos diferentes.
assert.match(pedido, /EXCEÇÃO/, "o pedido precisa prever a exceção de convergência");
assert.match(pedido, /ÚNICO próximo passo adequado/i);
assert.match(pedido, /PODEM convergir/i);
assert.match(pedido, /caminho e um enquadramento diferentes/i);

// E precisa proibir o efeito colateral que a regra antiga provocava.
assert.match(
  pedido,
  /Nunca invente um próximo passo pior, prematuro ou artificial só pra diferenciar as mensagens/i,
  "o pedido precisa proibir diferenciar as mensagens inventando um passo pior"
);

// Ângulos diferentes continuam sendo o padrão — a exceção não pode virar permissão pra repetir
// a mesma mensagem três vezes.
assert.match(pedido, /ÂNGULOS COMERCIAIS DIFERENTES/i);
assert.match(pedido, /NÃO a mesma ideia reescrita/i);

// "maisDireta" deixou de exigir avanço concreto em conversa que ainda não amadureceu
// (regra 20 do Cérebro Comercial V3).
assert.match(pedido, /Quando a conversa ainda NÃO tiver maturidade/i);
assert.match(pedido, /não\s+força esse avanço/i);

console.log("v1204-tres-mensagens-podem-convergir: ok");
