import assert from "node:assert/strict";
import { analyzeWithBrain } from "../api/_pipeline.js";

// v986 — o dono registrou uma observação manual ("Enviei outra opção mas ele não respondeu
// mais" — cobrindo um envio de imagem que o sistema não consegue ler) e reanalisou o lead. O
// resumo até mencionou a observação, mas as três mensagens sugeridas continuaram tratando como
// se nada tivesse sido enviado (ex.: "posso te enviar agora as opções?"). Causa: a observação
// entrava misturada em CONVERSA COMPLETA, como só mais uma linha do WhatsApp — sem nada dizendo
// à IA que é um FATO confirmado pelo corretor, não uma mensagem a interpretar com cautela.
// Fix: bloco dedicado "OBSERVAÇÕES DO CORRETOR" no prompt, com instrução explícita de peso alto
// e de não contradizer/repetir o que a observação já diz ter acontecido.

const respostaBase = {
  summary: "Resumo", diagnostico: { produtoPrincipal: "Produto", etapaFunil: "Atendimento" },
  mensagens: { recomendada: "Bom dia?", maisSuave: "Bom dia?", maisDireta: "Bom dia?" },
  produtoInteresse: "Produto", produtosInteresse: ["Produto"], etapaSugerida: "Atendimento",
  clientProfile: "Perfil", nextAction: "Ação"
};
let ultimaChamada = null;
const openaiMock = {
  chat: { completions: { create: async payload => {
    ultimaChamada = payload;
    return { model: "mock-gpt", choices: [{ message: { content: JSON.stringify(respostaBase) } }] };
  } } }
};

const timeline = [
  { date: "17/07/2026", time: "13:45", author: "Você", text: "Vi que você já conheceu o loteamento, quer ver outras opções?" },
  { date: "17/07/2026", time: "15:43", author: "Evandro", text: "Sim, quero ver outras opções." },
  {
    date: "25/07/2026", time: "11:05", author: "Observação do corretor",
    text: "Enviei outra opção mas ele nao respondeu mais",
    type: "observacao_manual", source: "corretor-pro-manual", manual: true
  }
];

await analyzeWithBrain({
  lead: { clientName: "Evandro" }, timeline, openai: openaiMock,
  cerebroConfig: { metodo: "método do corretor", tom: "tom normal" }
});

const userPrompt = ultimaChamada.messages.find(m => m.role === "user")?.content || "";

// v1291 — o dono reescreveu o pedido: o bloco virou "OBSERVAÇÕES MANUAIS DO CORRETOR" e a
// instrução de peso alto ficou em uma frase, distinguindo o que ele registrou como FEITO (peso
// alto) do que ele apenas interpretou sobre o cliente (continua sendo interpretação).
assert.match(userPrompt, /OBSERVAÇÕES MANUAIS DO CORRETOR/, "precisa existir um bloco dedicado pra observações manuais no prompt");
assert.match(userPrompt, /Enviei outra opção mas ele nao respondeu mais/, "o texto da observação precisa chegar no prompt");
assert.match(userPrompt, /Fatos e ações que o corretor registrou como realizados têm peso alto/i, "precisa instruir a IA a tratar a observação como fato, não como algo a duvidar");
assert.match(userPrompt, /Já interpretações sobre intenção,\s+motivação, objeção ou estado do cliente continuam sendo interpretação/,
  "precisa proibir explicitamente que as mensagens repitam/ignorem o que a observação já registrou");
// A observação continua também na conversa cronológica — o bloco dedicado é reforço, não
// substituição.
assert.match(userPrompt, /CONVERSA [\s\S]*Enviei outra opção mas ele nao respondeu mais/, "a observação também deve continuar na timeline cronológica");

// Sem nenhuma observação manual na timeline, o bloco precisa dizer isso com todas as letras — a
// IA não pode ficar achando que existe observação que ela não recebeu.
ultimaChamada = null;
await analyzeWithBrain({
  lead: { clientName: "Cliente" },
  timeline: [{ date: "09/05/2026", time: "18:30", author: "Cliente", text: "Quero entender as condições." }],
  openai: openaiMock,
  cerebroConfig: { metodo: "método do corretor", tom: "tom normal" }
});
const userPromptSemObs = ultimaChamada.messages.find(m => m.role === "user")?.content || "";
assert.match(userPromptSemObs, /Nenhuma observação manual registrada\./, "sem observação manual na timeline, o prompt precisa dizer que não há nenhuma");

console.log("v986-observacao-manual-peso-alto: ok");
