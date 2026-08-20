import fs from "node:fs";
import assert from "node:assert/strict";
import { parseWhatsappTxt, guessLeadData, analyzeWithBrain } from "../api/_pipeline.js";
import { CONVERSA } from "./conversa-fixa-permuta.mjs";

// v1320 — A LEITURA COMPLETA E AS TRÊS JOGADAS.
//
// O dono colou a leitura feita à mão da conversa fixa e disse, três vezes: *"quero essa análise no
// sistema"*. O formato dela vira o formato do app:
//   • A VIRADA da conversa (o fato que muda o atendimento e passou batido, com a conta);
//   • onde o atendimento perdeu força (fatos com data, sem julgamento de caráter);
//   • o plano de agora, em ordem;
//   • as três mensagens como três JOGADAS com nome (aLabel/bLabel/cLabel) — não três redações;
//   • a ordem de envio (qual vai primeiro, sozinha, e o que esperar antes das outras).

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// ---------------------------------------------------------------------------
// 1) O pedido exige as seções novas e as jogadas.
// ---------------------------------------------------------------------------
assert.match(pipeline, /"aVirada":"o fato da conversa que MUDA o atendimento/, "a virada precisa ser pedida à IA");
assert.match(pipeline, /"ondePerdeuForca":\["onde o atendimento perdeu força, com data e fato/, "onde perdeu força precisa ser pedida");
assert.match(pipeline, /"planoDeAgora":\["a sequência de jogadas/, "o plano de agora precisa ser pedido");
assert.match(pipeline, /"ordemDeEnvio":"instrução prática de envio/, "a ordem de envio precisa ser pedida");
assert.match(pipeline, /CADA MENSAGEM TEM NOME DE JOGADA/, "as três precisam ter nome de jogada");
assert.match(pipeline, /a recomendada É a virada contada ao cliente/, "quando há virada, a recomendada entrega a virada");
assert.match(pipeline, /em regra, a principal vai sozinha e as\n?\s*outras esperam a resposta/, "a ordem de envio precisa da regra do bloco");

// ---------------------------------------------------------------------------
// 2) FIM A FIM: os campos novos voltam da IA e são salvos na análise.
// ---------------------------------------------------------------------------
const timeline = parseWhatsappTxt(CONVERSA);
const lead = guessLeadData(timeline, "Miguel Kirinus", "Conversa do WhatsApp com Noemi Barcarol Evoluti.txt");
const chamadas = [];
const openaiMock = { chat: { completions: { create: async payload => {
  chamadas.push(payload);
  return { model: "mock", choices: [{ message: { content: JSON.stringify({
    summary: "Resumo",
    leituraDaConversa: {
      comoConduzir: "Conduzir.",
      aVirada: "A cliente ofereceu bens em permuta que mudam a faixa de compra dela.",
      oQueOClienteQuer: "Apartamento maior.",
      ondeParou: "Sem resposta após a explicação da permuta.",
      oQueMudouNoTempo: "O interesse saiu do anúncio.",
      condicaoDoCliente: "Só troca os bens juntos.",
      ondePerdeuForca: ["Convites de visita repetidos sem resposta.", "Material enviado sem preço."],
      planoDeAgora: ["Entregar a conta da faixa nova.", "Puxar a avaliação dos bens.", "Reabrir o produto que voltou a caber."]
    },
    diagnostico: { produtoPrincipal: "Produto", etapaFunil: "Atendimento" },
    mensagens: {
      aLabel: "Reposiciona a faixa", bLabel: "Puxa a avaliação", cLabel: "Reabre pelo prazo",
      ordemDeEnvio: "Mande a 1 sozinha; as outras só depois da resposta.",
      recomendada: "Bom dia, Fulana? Um.", maisSuave: "Bom dia, Fulana? Dois.", maisDireta: "Bom dia, Fulana? Três."
    },
    produtoInteresse: "Produto", produtosInteresse: ["Produto"],
    etapaSugerida: "Atendimento", clientProfile: "Perfil", nextAction: "Ação"
  }) } }] };
} } } };

const r = await analyzeWithBrain({
  lead, timeline, openai: openaiMock,
  cerebroConfig: { metodo: "método do corretor" }
});
assert.equal(r.leituraDaConversa.aVirada, "A cliente ofereceu bens em permuta que mudam a faixa de compra dela.");
assert.deepEqual(r.leituraDaConversa.ondePerdeuForca, ["Convites de visita repetidos sem resposta.", "Material enviado sem preço."]);
assert.equal(r.leituraDaConversa.planoDeAgora.length, 3);
assert.equal(r.messages.aLabel, "Reposiciona a faixa", "o nome da jogada precisa sobreviver até o resultado");
assert.equal(r.messages.ordemDeEnvio, "Mande a 1 sozinha; as outras só depois da resposta.");

// Sem os campos (análise antiga ou IA que não devolveu), nada quebra e nada é inventado.
const openaiSem = { chat: { completions: { create: async () => ({ model: "mock", choices: [{ message: { content: JSON.stringify({
  summary: "R", diagnostico: { produtoPrincipal: "P", etapaFunil: "Atendimento" },
  mensagens: { recomendada: "Oi? A.", maisSuave: "Oi? B.", maisDireta: "Oi? C." },
  produtoInteresse: "P", produtosInteresse: ["P"], etapaSugerida: "Atendimento", clientProfile: "X", nextAction: "Y"
}) } }] }) } } };
const r2 = await analyzeWithBrain({ lead, timeline, openai: openaiSem, cerebroConfig: { metodo: "m" } });
assert.equal(r2.leituraDaConversa.aVirada, "", "sem virada da IA, o campo fica vazio — nunca inventado");
assert.deepEqual(r2.leituraDaConversa.ondePerdeuForca, []);
assert.equal(r2.messages.ordemDeEnvio, "");

// ---------------------------------------------------------------------------
// 3) A TELA mostra as seções novas e a ordem de envio.
// ---------------------------------------------------------------------------
assert.match(app, /A virada desta conversa/, "a virada precisa aparecer em destaque na tela");
assert.match(app, /Onde o atendimento perdeu força/, "a lista de onde perdeu força precisa aparecer");
assert.match(app, /O que fazer agora, em ordem/, "o plano numerado precisa aparecer");
assert.match(app, /<b>Ordem de envio:<\/b>/, "a ordem de envio precisa aparecer junto das três mensagens");
assert.match(app, /ordemDeEnvio:cp704Text\(a\?\.messages\?\.ordemDeEnvio/, "a tela lê a ordem de envio salva na análise");

console.log("v1320-leitura-completa-e-tres-jogadas: ok");
