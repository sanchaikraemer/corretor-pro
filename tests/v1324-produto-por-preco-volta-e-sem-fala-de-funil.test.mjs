import fs from "node:fs";
import assert from "node:assert/strict";
import { parseWhatsappTxt, guessLeadData, analyzeWithBrain } from "../api/_pipeline.js";
import { CONVERSA } from "./conversa-fixa-permuta.mjs";

// v1322 — dois defeitos apontados pelo dono no print das 09:51 (v1321):
//
// 1. "Você tinha entrado pelo apartamento de R$ 430 mil" — linguagem de FUNIL numa mensagem pro
//    cliente. Cliente não "entra" por nada: ele pergunta, pede, responde. O pedido fixo proibía
//    jargão de escritório mas não proibia descrever o cliente pra ele mesmo em fala de sistema.
//
// 2. O produto de janeiro sumiu das jogadas. O pedido mandava "não ressuscitar produto superado"
//    sem definir superado — e produto ABANDONADO POR PREÇO era tratado como superado mesmo quando
//    a virada abriu uma faixa nova em que ele volta a caber. Reabri-lo pelo ponto da objeção que
//    ficou de pé é exatamente a jogada 3 da análise-modelo.

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");

assert.match(pipeline, /Produto abandonado POR PREÇO volta a valer quando a faixa de compra muda/,
  "a definição de superado precisa deixar o produto largado por preço voltar quando a faixa muda");
assert.match(pipeline, /reabri-lo pelo ponto da objeção que ficou de pé é jogada legítima/);
assert.match(pipeline, /NÃO DESCREVA O CLIENTE PARA ELE MESMO EM LINGUAGEM DE SISTEMA/,
  "fala de funil não pode entrar em mensagem pro cliente");
assert.match(pipeline, /O cliente não "entra" por nada — ele pergunta, pede, responde\./);

// Fim a fim: as duas regras chegam no pedido vivo da conversa fixa.
const timeline = parseWhatsappTxt(CONVERSA);
const lead = guessLeadData(timeline, "Miguel Kirinus", "Conversa do WhatsApp com Noemi Barcarol Evoluti.txt");
const chamadas = [];
const openaiMock = { chat: { completions: { create: async payload => {
  chamadas.push(payload);
  return { model: "mock", choices: [{ message: { content: JSON.stringify({
    summary: "R", diagnostico: { produtoPrincipal: "P", etapaFunil: "Atendimento" },
    mensagens: { recomendada: "Oi? A.", maisSuave: "Oi? B.", maisDireta: "Oi? C." },
    produtoInteresse: "P", produtosInteresse: ["P"], etapaSugerida: "Atendimento",
    clientProfile: "X", nextAction: "Y"
  }) } }] };
} } } };
await analyzeWithBrain({ lead, timeline, openai: openaiMock, cerebroConfig: { metodo: "m" } });
const textoCompleto = chamadas.at(-1).messages.map(m => m.content).join("\n");
assert.match(textoCompleto, /NÃO DESCREVA O CLIENTE PARA ELE MESMO EM LINGUAGEM DE SISTEMA/);
assert.match(textoCompleto, /Produto abandonado POR PREÇO volta a valer quando a faixa de compra muda/);

console.log("v1322-produto-por-preco-volta-e-sem-fala-de-funil: ok");
