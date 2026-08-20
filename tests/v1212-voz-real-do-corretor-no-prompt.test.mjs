// v1212 — a VOZ REAL do corretor precisa chegar no pedido da análise, e o jargão de IA precisa
// estar proibido por escrito.
//
// Caso real do dono (11/08/2026): as sugestões saíam com "Espero que esteja indo bem", "Quis saber
// se você...", "Assim envio só o que realmente faça sentido" — e ele reescrevia tudo à mão, curto e
// direto. Motivo: o único material de estilo que chegava na IA era DESCRIÇÃO abstrata ("conversação
// amigável e informativa", "mantém um tom prestativo, sempre se colocando à disposição"). Pedir
// "prestativo, à disposição" devolve exatamente "fico à disposição".
import assert from "node:assert/strict";
import { analyzeWithBrain, jeitoAprendidoCompacto } from "../api/_pipeline.js";

// ── 1) O bloco de tom prioriza MENSAGEM REAL sobre descrição abstrata ────────────────────────
const config = {
  inteligenciaAprendida: {
    tons: [
      { texto: "Conversação amigável e informativa, com informalidade moderada." },
      { texto: "O corretor mantém um tom amigável e prestativo, sempre se colocando à disposição." },
      { texto: "Boa tarde, tudo bem? Consegui separar duas opções que encaixam no que você me falou, te envio agora." },
      { texto: "Saudação cordial e profissional, com um toque pessoal e atenção ao cliente." }
    ]
  }
};
const jeito = jeitoAprendidoCompacto(config, "cliente pediu opções de apartamento");
assert.match(jeito, /Mensagem real sua/, "a mensagem real do corretor precisa entrar identificada como mensagem");
assert.match(jeito, /Consegui separar duas opções/, "a mensagem real precisa aparecer no bloco");
assert.match(jeito, /imite a forma, não o conteúdo/i);
// A descrição abstrata continua entrando, mas só como complemento — nunca no lugar da mensagem.
assert.match(jeito, /Seu tom:/);
assert.ok(
  jeito.indexOf("Mensagem real sua") < jeito.indexOf("Seu tom:"),
  "a mensagem real precisa vir antes da descrição abstrata"
);

// Sem nenhuma mensagem real guardada, o comportamento antigo continua (só descrição).
const soDescricao = jeitoAprendidoCompacto({ inteligenciaAprendida: { tons: [{ texto: "Tom cordial e direto com o cliente." }] } }, "conversa");
assert.doesNotMatch(soDescricao, /Mensagem real sua/);
assert.match(soDescricao, /Seu tom: Tom cordial e direto/);

// ── 2) As mensagens reais DESTA conversa entram no pedido, e o jargão de IA é proibido ────────
const timeline = [
  { date: "05/08/2026", time: "09:10", author: "Corretor Sanchai", text: "Bom dia Silvana, tudo bem? Te envio agora as informações do Evolutti." },
  { date: "05/08/2026", time: "09:12", author: "Silvana", text: "Obrigada, vou olhar." },
  { date: "05/08/2026", time: "10:30", author: "Corretor Sanchai", text: "Conseguiu conferir as informações que enviei? Se quiser separo outras opções de perfil semelhante." }
];
const resposta = {
  summary: "Resumo",
  diagnostico: { ultimaPessoaFalar: "corretor" },
  mensagens: { recomendada: "um", maisSuave: "dois", maisDireta: "três" },
  produtoInteresse: "Evolutti", produtosInteresse: ["Evolutti"], etapaSugerida: "Follow-up",
  clientProfile: "Perfil", nextAction: "Ação"
};
const chamadas = [];
const openaiMock = {
  chat: { completions: { create: async payload => {
    chamadas.push(payload);
    return { model: "mock-gpt", choices: [{ message: { content: JSON.stringify(resposta) } }] };
  } } }
};

await analyzeWithBrain({
  lead: { clientName: "Silvana" },
  timeline,
  openai: openaiMock,
  cerebroConfig: { corretorNome: "Corretor Sanchai", metodo: "Regra do corretor.", tom: "Tom do corretor." }
});

// v1332 — duas etapas viraram o padrão; a voz do corretor precisa chegar na que ESCREVE.
assert.equal(chamadas.length, 2);
const system = chamadas[0].messages.find(m => m.role === "system")?.content || "";
const pedido = chamadas.map(c => c.messages.find(m => m.role === "user")?.content || "").join("\n");

// v1291 — o dono trocou o título do bloco de voz. O conteúdo (as mensagens reais dele NESTA
// conversa) continua chegando na IA, que é o que importa.
assert.match(system, /COMO ESTE CORRETOR ESCREVE — EXEMPLOS REAIS DESTA CONVERSA/,
  "as mensagens reais do corretor nesta conversa precisam entrar no prompt");
assert.match(system, /Conseguiu conferir as informações que enviei\?/,
  "a mensagem real precisa aparecer literalmente como referência de voz");
assert.doesNotMatch(system, /Obrigada, vou olhar/,
  "mensagem do CLIENTE não pode entrar como exemplo de voz do corretor");
assert.match(system, /Use apenas a forma de escrever; não copie fatos ou promessas/,
  "precisa estar escrito que só a forma é copiada");

// A lista negra de jargão precisa estar nas instruções, item por item — são as frases que o dono
// rejeitou uma a uma nos prints de 11/08/2026.
// (Ela chegou a sair na v1291, junto com a reescrita das instruções que o dono entregou pronta, e
// ele mandou recolocar no mesmo dia: "1 - entao recoloque".)
// Espaços normalizados: as instruções são texto formatado, e uma quebra de linha no meio de
// "sinta-se à vontade" não pode fazer a checagem passar batido.
const instrucoes = `${system}\n${pedido}`.replace(/\s+/g, " ");
for (const proibido of [
  "espero que esteja", "faz sentido", "fico à disposição", "não hesite em",
  "sinta-se à vontade", "quis saber se"
]) {
  assert.ok(instrucoes.toLowerCase().includes(proibido.toLowerCase()), `o jargão proibido "${proibido}" precisa estar listado nas instruções`);
}
assert.match(instrucoes, /LINGUAGEM DE IA — PROIBIDO/);
assert.match(instrucoes, /Use apenas a forma de escrever/,
  "junto com a lista, o exemplo de voz real do corretor continua sendo a referência de tom");

console.log("v1212-voz-real-do-corretor-no-prompt: ok");
