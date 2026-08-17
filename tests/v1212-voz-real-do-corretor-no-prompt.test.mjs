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

assert.equal(chamadas.length, 1);
const system = chamadas[0].messages.find(m => m.role === "system")?.content || "";
const pedido = chamadas[0].messages.find(m => m.role === "user")?.content || "";

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

// v1291 — ATENÇÃO, ISTO MUDOU DE FORMA, E É A MUDANÇA MAIS ARRISCADA DESTA VERSÃO.
// Até a v1290 as instruções traziam a lista "LINGUAGEM DE IA — PROIBIDO" com as frases que o dono
// rejeitou uma a uma nos prints de 11/08/2026 ("fico à disposição", "espero que esteja bem", "não
// hesite em", "sinta-se à vontade", "quis saber se", "faz sentido"). Na reescrita das instruções
// que ele entregou pronta na v1291, essa lista saiu — e não sobrou nenhum substituto escrito.
// Ou seja: hoje quem segura o clichê de IA é o tom que o Cérebro do corretor descrever, mais os
// exemplos de voz real conferidos logo acima. Se as frases voltarem a aparecer nas sugestões, é
// aqui que a lista precisa ser recolocada.
const instrucoes = `${system}\n${pedido}`.replace(/\s+/g, " ");
assert.ok(!instrucoes.includes("LINGUAGEM DE IA — PROIBIDO"),
  "se a lista de jargão voltar, este teste precisa voltar a cobrar as frases uma a uma (ver NOTAS-v1291.md)");
assert.match(instrucoes, /Use apenas a forma de escrever/,
  "sem a lista, o exemplo de voz real do corretor é o que resta segurando o tom — não pode sumir também");

console.log("v1212-voz-real-do-corretor-no-prompt: ok");
