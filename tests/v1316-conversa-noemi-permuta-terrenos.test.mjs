import fs from "node:fs";
import assert from "node:assert/strict";
import {
  parseWhatsappTxt,
  guessLeadData,
  tentativasSemRespostaDoCorretor,
  calcularContextoTemporalMensagens,
  analyzeWithBrain
} from "../api/_pipeline.js";

// v1316 — CASO FIXO: a conversa real da Noemi (lead da Construtora Senger), de 19/01/2026 a
// 19/08/2026, escolhida pelo dono como caso de teste permanente do app.
//
// Por que ESTA conversa vira teste fixo: ela junta, num arquivo só, quase tudo o que já quebrou
// neste projeto e não pode quebrar de novo —
//   • sete meses de histórico, com um sumiço de quatro meses no meio (26/02 → 27/06);
//   • foto, vídeo, PDF e áudio enviados pelos dois lados (a IA precisa saber que foram enviados,
//     sem inventar o conteúdo);
//   • mensagem de várias linhas numa bolha só (a apresentação de 19/01);
//   • preço antigo (R$ 670.000, de janeiro) convivendo com preço novo (R$ 430.000, de agosto);
//   • uma virada comercial no fim: a cliente oferece 3 terrenos (R$ 360 mil) como permuta, o que
//     muda a faixa de compra dela — nada disso pode se perder no caminho até a IA;
//   • a conversa termina com uma sequência de mensagens do corretor sem resposta nenhuma.
//
// O que este arquivo garante: a conversa é lida INTEIRA e sem perder nenhum desses fatos, o
// cliente certo é identificado, o que é fato deste atendimento chega ao pedido enviado à IA — e
// NADA de comercial desta conversa (empreendimento, preço, endereço, nome de pessoa) foi parar
// dentro do código do app.

import { CONVERSA } from "./conversa-fixa-permuta.mjs";

// ---------------------------------------------------------------------------
// 1) LEITURA DA CONVERSA — 64 mensagens, nenhuma a mais, nenhuma a menos.
// ---------------------------------------------------------------------------
const timeline = parseWhatsappTxt(CONVERSA);
assert.equal(timeline.length, 64, "a conversa da Noemi tem 64 mensagens; qualquer mudança nesse número é mensagem perdida ou duplicada");
assert.equal(timeline[0].date, "19/01/2026", "a conversa precisa começar no primeiro contato dela, em 19/01/2026");
assert.equal(timeline[0].author, "Noemi Barcarol Evoluti");
assert.equal(timeline.at(-1).date, "19/08/2026");
assert.equal(timeline.at(-1).time, "18:44");
assert.equal(timeline.at(-1).author, "Construtora Senger", "a última palavra da conversa é do corretor — é isso que faz dela um atendimento em aberto");
assert.deepEqual(
  [...new Set(timeline.map(m => m.author))],
  ["Noemi Barcarol Evoluti", "Construtora Senger"],
  "só existem dois lados nesta conversa; um terceiro autor aqui significa que a leitura quebrou"
);

// Mensagem de várias linhas numa bolha só (a apresentação de 19/01) não pode virar várias
// mensagens nem perder as linhas do meio.
assert.equal(timeline[1].time, "16:21");
assert.match(timeline[1].text, /Fico muito feliz com o seu contato!/);
assert.match(timeline[1].text, /Você está procurando algo para morar ou para investir\?/);
assert.match(timeline[1].text, /Produto de Interesse: Ed\. Evolutti/, "a última linha da bolha não pode se perder");

// ---------------------------------------------------------------------------
// 2) ARQUIVOS ENVIADOS — a IA precisa saber que foto, vídeo, PDF e áudio existiram.
// ---------------------------------------------------------------------------
const marcadores = timeline.filter(m => /\[Arquivo enviado nesta mensagem/.test(m.text));
assert.equal(marcadores.length, 5, "3 imagens + 1 vídeo + 1 PDF = 5 envios que não podem sumir da conversa");
assert.equal(timeline.filter(m => /imagem — conteúdo não analisado/.test(m.text)).length, 3);
assert.equal(timeline.filter(m => /vídeo — conteúdo não analisado/.test(m.text)).length, 1);
assert.equal(timeline.filter(m => /documento\/PDF — conteúdo não analisado/.test(m.text)).length, 1);
// Áudio continua literal (é resolvido depois pela transcrição), inclusive o áudio DELA de 17:52.
const audios = timeline.filter(m => /\.opus \(arquivo anexado\)/.test(m.text));
assert.equal(audios.length, 4, "os 4 áudios da conversa precisam continuar literais para a transcrição achar cada um");
assert.equal(audios.filter(m => m.author === "Noemi Barcarol Evoluti").length, 1, "o áudio que a CLIENTE mandou não pode ser confundido com um do corretor");

// ---------------------------------------------------------------------------
// 3) DE QUEM É ESTE ATENDIMENTO — e o que o app se recusa a adivinhar.
// ---------------------------------------------------------------------------
const lead = guessLeadData(timeline, "Miguel Kirinus", "Conversa do WhatsApp com Noemi Barcarol Evoluti.txt");
assert.equal(lead.clientName, "Noemi Barcarol Evoluti", "o cartão é da cliente, nunca da construtora");
assert.equal(lead.totalTimelineItems, 64);
// Regra do projeto: nenhum empreendimento é cravado na importação. "Ed. Evolutti" está escrito na
// conversa, mas quem decide o produto é a análise da IA — aqui fica em branco, de propósito.
assert.equal(lead.product, "Não identificado", "a importação não pode eleger empreendimento sozinha");

// ---------------------------------------------------------------------------
// 4) A CONVERSA TERMINA NA MÃO DO CORRETOR — cinco mensagens seguidas sem resposta.
// ---------------------------------------------------------------------------
const semResposta = tentativasSemRespostaDoCorretor(timeline, "Miguel Kirinus", lead);
assert.equal(semResposta.tentativas, 1, "as cinco mensagens são todas do mesmo dia (19/08): isso é UMA tentativa, não cinco");
assert.equal(semResposta.textos.length, 5, "o texto das cinco mensagens sem resposta precisa chegar inteiro à IA");
assert.equal(semResposta.textos[0], "Porém o valor da compra teria que ser em torno de 800mil");
assert.equal(semResposta.textos.at(-1), "Então é possível sim, a permuta pelos seus terrenos, desde que avaliados e com cerca de 50% de volta");

// Data da última mensagem e dias parados, com um "hoje" fixo (20/08/2026) para o teste não
// depender do dia em que é rodado.
const temporal = calcularContextoTemporalMensagens(timeline, {}, new Date("2026-08-20T15:00:00-03:00"));
assert.equal(temporal.ultimaData, "19/08/2026");
assert.equal(temporal.dias, 1, "de 19/08 para 20/08 é 1 dia corrido");

// ---------------------------------------------------------------------------
// 5) FIM A FIM — tudo o que decide o próximo passo precisa chegar ao pedido enviado à IA.
// ---------------------------------------------------------------------------
const chamadas = [];
const openaiMock = {
  chat: { completions: { create: async payload => {
    chamadas.push(payload);
    return { model: "mock-analise", choices: [{ message: { content: JSON.stringify({
      summary: "Resumo",
      diagnostico: { produtoPrincipal: "Produto", etapaFunil: "Atendimento" },
      mensagens: { recomendada: "Pergunta?", maisSuave: "Pergunta?", maisDireta: "Pergunta?" },
      produtoInteresse: "Produto",
      produtosInteresse: ["Produto"],
      etapaSugerida: "Atendimento",
      clientProfile: "Perfil",
      nextAction: "Ação"
    }) } }] };
  } } }
};

const resultado = await analyzeWithBrain({
  lead,
  timeline,
  openai: openaiMock,
  cerebroConfig: { metodo: "método do corretor", diasDescansoPosAtendimento: 7 }
});
assert.equal(resultado.mode, "openai", "a análise precisa acontecer de verdade nesta conversa");

const pedido = chamadas.at(-1).messages.find(m => m.role === "user")?.content || "";

// A conversa vai INTEIRA: as 64 linhas, do primeiro contato de janeiro à última de agosto.
const linhasDaConversa = pedido.split("\n").filter(l => /^\[\d{2}\/\d{2}\/2026 \d{2}:\d{2}\] /.test(l));
assert.equal(linhasDaConversa.length, 64, "nenhuma mensagem pode ficar de fora do que a IA lê nesta conversa");

// Os fatos que decidem este atendimento — todos ditos por alguém DENTRO da conversa.
const fatosDaConversa = [
  ["Eu quero pela avenida Pátria ou mais centro?", "o critério de localização que ela deu"],
  ["São de fundos", "a objeção dela sobre a posição do apartamento"],
  ["A partir de R$ 670.000 com 1 box de garagem", "o preço citado em janeiro"],
  ["Entrega em 2028", "o prazo de entrega, que muda tudo se ela precisa morar agora"],
  ["Estou viajando na volta eu vejo", "o prazo que a própria cliente marcou"],
  ["por R$ 430.000", "o preço do anúncio de agosto"],
  ["43m2 privativo mais box", "a metragem que ela recusou"],
  ["Com 2 banheiros", "o que ela pediu"],
  ["Eu tenho 3 terrenos lá numa esquina da ouro preto", "a permuta oferecida por ela"],
  ["o valor dos terrenos fica 360", "quanto vale a permuta — é isso que muda a faixa de compra dela"],
  ["o valor da compra teria que ser em torno de 800mil", "a regra de permuta que o corretor já respondeu"]
];
for (const [trecho, porque] of fatosDaConversa) {
  assert.ok(pedido.includes(trecho), `este fato precisa chegar à IA (${porque}): "${trecho}"`);
}

// O contexto técnico calculado pelo app (não inventado pela IA) também precisa estar lá.
assert.match(pedido, /Data da última mensagem identificada: 19\/08\/2026/);
assert.match(pedido, /Prazo de retomada configurado pelo corretor: 7 dias corridos/);
assert.match(pedido, /TENTATIVAS DO CORRETOR AINDA SEM RESPOSTA: 1\./);
assert.match(pedido, /Porém o valor da compra teria que ser em torno de 800mil/);

// ---------------------------------------------------------------------------
// 6) NADA DESTA CONVERSA PODE ESTAR CRAVADO NO CÓDIGO.
//    Regra do projeto: preço, empreendimento, endereço e nome de pessoa vêm do Cérebro ou da
//    própria conversa — nunca de dentro do app.
// ---------------------------------------------------------------------------
const pipelineSrc = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const appSrc = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
for (const proibido of ["Evolutti", "Senger", "Noemi", "Kirinus", "Ouro Preto", "Ernesto Alves", "Antônio Vargas", "670.000", "430.000"]) {
  const re = new RegExp(proibido.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  assert.doesNotMatch(pipelineSrc, re, `"${proibido}" é informação desta conversa e não pode estar dentro do código`);
  assert.doesNotMatch(appSrc, re, `"${proibido}" é informação desta conversa e não pode estar dentro do código`);
}

console.log("v1316-conversa-noemi-permuta-terrenos: ok");
