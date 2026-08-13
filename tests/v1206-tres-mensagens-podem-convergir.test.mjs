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
import fs from "node:fs";
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
// v1241 — AUDITORIA DO DONO (13/08/2026): "o Cérebro tem que ser a única autoridade comercial".
// O bloco que definia o ÂNGULO COMERCIAL de cada uma das três (e a exceção de convergência)
// é método comercial: saiu do pedido de quem TEM Cérebro e virou ponto de partida da conta
// nova (METODO_BASE_PREVIA). A regra não sumiu do produto — mudou quem manda nela. O pedido
// de todo mundo mantém só o que é da TELA: as três são três caminhos pro mesmo comoConduzir.
const fonte = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
assert.match(fonte, /EXCEÇÃO/, "a exceção de convergência continua existindo, no ponto de partida da conta nova");
assert.match(fonte, /ÚNICO próximo passo adequado/i);
assert.match(fonte, /PODEM convergir/i);
assert.match(fonte, /caminho e um enquadramento diferentes/i);
assert.match(pedido, /TRÊS CAMINHOS PARA O MESMO "comoConduzir"/,
  "o pedido de todo mundo mantém a regra de tela: três caminhos pro mesmo passo");

// E precisa proibir o efeito colateral que a regra antiga provocava.
// v1241 — mesma mudança de dono: isto é método comercial e mora agora no ponto de partida da
// conta nova. Continua escrito no produto, só não é mais o código quem impõe a quem tem Cérebro.
assert.match(fonte, /Nunca invente um próximo passo pior, prematuro ou artificial só pra diferenciar/,
  "o pedido precisa proibir diferenciar as mensagens inventando um passo pior");

// Ângulos diferentes continuam sendo o padrão — a exceção não pode virar permissão pra repetir
// a mesma mensagem três vezes.
// v1241 — método comercial: continua escrito no produto, agora no ponto de partida da conta nova.
// O que o pedido de TODO MUNDO garante é o que a tela precisa: três caminhos, não três cópias.
assert.match(fonte, /ÂNGULOS COMERCIAIS DIFERENTES/i);
assert.match(fonte, /NÃO a mesma ideia reescrita/i);
assert.match(pedido, /não três assuntos diferentes,\s*\n?nem a mesma frase reescrita três vezes/i,
  "o pedido continua proibindo entregar a mesma mensagem três vezes");

// "maisDireta" deixou de exigir avanço concreto em conversa que ainda não amadureceu
// (regra 20 do Cérebro Comercial V3).
assert.match(fonte, /Quando a conversa ainda NÃO tiver maturidade/i);
assert.match(fonte, /não\s+força esse avanço/i);

console.log("v1206-tres-mensagens-podem-convergir: ok");
