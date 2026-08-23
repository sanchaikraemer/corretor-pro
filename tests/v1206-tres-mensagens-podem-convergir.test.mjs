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

// v1346 — a análise voltou a ser UMA chamada por padrão: o modo de duas etapas (v1332) dobrava a
// espera do corretor e tinha sido ligado sem medir. Ele continua disponível por variável de
// ambiente. Por isso a contagem aqui não crava mais o número — o que este teste guarda vale
// igual nos dois modos.
assert.ok(chamadas.length >= 1, "a análise precisa chamar a IA");
// v1291 — parte das regras das três mensagens mora nas instruções (system) e parte no pedido
// (user). O que importa é que a IA receba tudo isso na mesma execução, então a checagem é feita
// sobre os dois juntos.
const pedido = chamadas.flatMap(c => c.messages.map(m => m.content || "")).join("\n");

// A ordem antiga, absoluta, não pode voltar: era ela que brigava com o Cérebro.
assert.doesNotMatch(
  pedido,
  /reescreva até virarem três caminhos realmente distintos/i,
  "o pedido não pode mais exigir três próximos passos diferentes em qualquer situação"
);

// v1372 — a convergência ficou mais forte quando existe uma lacuna prioritária: não são três
// caminhos; são três redações da mesma jogada. Sem lacuna única, o Cérebro ainda pode escolher
// alternativas diferentes. O que este teste guarda é que o pedido nunca força um terceiro passo pior.
assert.match(pedido, /Se houver um único próximo passo adequado, as três DEVEM convergir para ele/i,
  "o pedido precisa prever a convergência quando só existe um passo adequado");

// E precisa continuar proibindo o efeito colateral que a regra antiga provocava: diferenciar as
// mensagens inventando diferença que não existe.
assert.match(
  pedido,
  /podendo ter ângulos diferentes sem\s*\n?inventar diferenças artificiais/i,
  "o pedido precisa proibir diferenciar as mensagens inventando um passo pior"
);

// A convergência não pode virar permissão pra repetir a mesma mensagem três vezes: cada uma
// continua tendo o seu papel escrito.
assert.match(pedido, /MAIS SUAVE reduz a pressão pela forma de escrever; não muda a pergunta central/i);
assert.match(pedido, /MAIS DIRETA encurta o caminho até a pergunta central; não troca a pergunta por outra etapa/i);

// A direta continua sem poder inventar avanço ou compromisso fora da maturidade real.
assert.match(pedido, /NÃO INVENTE COMPROMISSO/i);
assert.match(pedido, /Alguma mensagem força visita\/encontro\/proposta sem maturidade\?/i);

console.log("v1206-tres-mensagens-podem-convergir: ok");
