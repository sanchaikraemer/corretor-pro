// v1206 — as três sugestões podem convergir para o MESMO próximo passo quando só existe um
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
// v1291 — parte das regras das três mensagens mora nas instruções (system) e parte no pedido
// (user). O que importa é que a IA receba tudo isso na mesma execução, então a checagem é feita
// sobre os dois juntos.
const pedido = [
  chamadas[0].messages.find(m => m.role === "system")?.content || "",
  chamadas[0].messages.find(m => m.role === "user")?.content || ""
].join("\n");

// A ordem antiga, absoluta, não pode voltar: era ela que brigava com o Cérebro.
assert.doesNotMatch(
  pedido,
  /reescreva até virarem três caminhos realmente distintos/i,
  "o pedido não pode mais exigir três próximos passos diferentes em qualquer situação"
);

// v1291 — o dono reescreveu o pedido inteiro; a exceção deixou de ser um bloco em caixa alta e
// virou uma linha da lista de regras das três mensagens. A garantia é a mesma: quando só existe
// um próximo passo adequado, as três podem convergir por abordagens diferentes.
assert.match(pedido, /Se houver um único próximo passo adequado, as três podem convergir para ele por abordagens diferentes/i,
  "o pedido precisa prever a exceção de convergência");

// E precisa continuar proibindo o efeito colateral que a regra antiga provocava: diferenciar as
// mensagens inventando diferença que não existe.
assert.match(
  pedido,
  /podendo ter ângulos diferentes sem\s*\n?inventar diferenças artificiais/i,
  "o pedido precisa proibir diferenciar as mensagens inventando um passo pior"
);

// A convergência não pode virar permissão pra repetir a mesma mensagem três vezes: cada uma
// continua tendo o seu papel escrito.
assert.match(pedido, /MAIS SUAVE explora\/resolve o ponto mais importante com menor pressão/i);
assert.match(pedido, /MAIS DIRETA é objetiva/i);

// "maisDireta" continua sem poder forçar avanço em conversa que ainda não amadureceu
// (regra 20 do Cérebro Comercial V3).
assert.match(pedido, /nunca força visita, proposta ou decisão antes da maturidade/i);

console.log("v1206-tres-mensagens-podem-convergir: ok");
