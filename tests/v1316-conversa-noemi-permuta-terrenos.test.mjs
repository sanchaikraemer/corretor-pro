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

const CONVERSA = `[19/01/2026 15:41] Noemi Barcarol Evoluti: Olá! Tenho interesse e queria mais informações, por favor.
[19/01/2026 16:21] Construtora Senger: Boa tarde Noemi, tudo bem?
Fico muito feliz com o seu contato!
Meu nome Miguel Kirinus, da Construtora Senger, Vi que você demonstrou interesse em um dos nossos imóveis e gostaria de entender melhor o que está buscando, para te atender da melhor forma possível.
Você está procurando algo para morar ou para investir?
Produto de Interesse: Ed. Evolutti
Fico no aguardo para darmos continuidade. Estou à disposição!
[21/01/2026 13:44] Construtora Senger: Boa tarde Noemi, tudo bem?
Gostou do Evolutti?
Ele atende os requisitos que vc procura?
[21/01/2026 15:04] Noemi Barcarol Evoluti: Olá! Tenho interesse e queria mais informações, por favor.
[21/01/2026 15:04] Noemi Barcarol Evoluti: Localização fica na floresta?
[21/01/2026 15:05] Noemi Barcarol Evoluti: Eu quero pela avenida Pátria ou mais centro?
[21/01/2026 15:08] Construtora Senger: O Evolutti fica no centro, bem próximo a avenida pátria
[21/01/2026 15:08] Construtora Senger: [Arquivo enviado nesta mensagem: imagem — conteúdo não analisado pela IA]
[21/01/2026 15:09] Construtora Senger: próximo á colégios, mas ao mesmo tempo, fora da confusão do transito nos horários de pico
[21/01/2026 15:10] Construtora Senger: Te enviei o mapa, conseguiu se localizar?
[21/01/2026 16:49] Noemi Barcarol Evoluti: Sim
[21/01/2026 16:50] Noemi Barcarol Evoluti: 2 quartos com suíte?
[21/01/2026 17:34] Construtora Senger: PTT-20260121-WA0002.opus (arquivo anexado)
[21/01/2026 17:35] Construtora Senger: PTT-20260121-WA0003.opus (arquivo anexado)
[21/01/2026 17:35] Construtora Senger: [Arquivo enviado nesta mensagem: documento/PDF — conteúdo não analisado pela IA]
[21/01/2026 17:52] Noemi Barcarol Evoluti: PTT-20260121-WA0005.opus (arquivo anexado)
[21/01/2026 17:52] Construtora Senger: Certo
[21/01/2026 17:52] Construtora Senger: Claro, to mandando, um segundo
[21/01/2026 17:53] Construtora Senger: [Arquivo enviado nesta mensagem: imagem — conteúdo não analisado pela IA]
[21/01/2026 17:53] Construtora Senger: PTT-20260121-WA0007.opus (arquivo anexado)
[21/01/2026 17:54] Construtora Senger: A partir de R$ 670.000 com 1 box de garagem
[21/01/2026 17:54] Construtora Senger: [Arquivo enviado nesta mensagem: vídeo — conteúdo não analisado pela IA]
[21/01/2026 17:54] Construtora Senger: Entrega em 2028
[21/01/2026 17:57] Noemi Barcarol Evoluti: São de fundos
[21/01/2026 17:57] Construtora Senger: Final 04 sim
[21/01/2026 17:58] Construtora Senger: Final 03 fica de frente para Antônio Vargas
[21/01/2026 17:58] Construtora Senger: Inclusive é a melhor posição solar final 03
[21/01/2026 18:56] Construtora Senger: Gostaria de levá-la visitar na semana q vem, pode ser?
Estou fora da cidade ate domingo, mas segunda em diante estou a disposição.
Qualquer dia e horário
[27/01/2026 12:27] Construtora Senger: Boa tarde Noemi, tudo bem?
Gostaria de convidá-la para um café na construtora e apresentar melhor os empreendimentos, e na sequência visitarmos os imóveis.
O q acha?
[27/01/2026 12:28] Noemi Barcarol Evoluti: Estou viajando na volta eu vejo
[27/01/2026 12:29] Construtora Senger: Perfeito, combinado.
Obrigado pelo retorno.
[13/02/2026 14:21] Construtora Senger: Boa tarde Noemi, tudo bem?
[13/02/2026 14:26] Construtora Senger: Já voltou de viagem?
Se já tiver por aqui, podemos dar continuidade na negociação
[26/02/2026 11:39] Construtora Senger: Bom dia, Noemi
Estava revisando nossa conversa e notei que não avançamos na sua busca.
Você gostaria de dar continuidade no atendimento?
[27/06/2026 17:38] Noemi Barcarol Evoluti: Olá! Posso ter mais informações sobre isso?
[29/06/2026 09:27] Construtora Senger: Olá, Noemi! Claro.
Esse apartamento é novo e pronto para morar, com 132 m² privativos, 3 suítes, lavabo, sacada com churrasqueira, móveis planejados, automação e box duplo. Fica em andar alto e localização central, esquina das ruas Ernesto Alves com Alexandre da mota. Lindo apartamento novinho e financiável em qualquer banco.
Posso te enviar o valor, as fotos e as condições de pagamento?
[19/08/2026 15:34] Construtora Senger: Anúncio do Facebook Mostrar detalhes Olá!
Vi que você se interessou pelo apartamento de 2 dormitórios com box, por R$ 430.000.
Posso te enviar fotos, detalhes do imóvel e as condições de financiamento por aqui.
O que você gostaria de ver primeiro?
[19/08/2026 15:34] Noemi Barcarol Evoluti: Olá! Quero saber mais sobre o apartamento de R$ 430 mil.
[19/08/2026 17:23] Construtora Senger: Boa Tarde Noemi, obrigado pelo interesse! Logo te passo as informações atualizadas do apartamento anunciado por R$ 430 mil: são 2 dormitórios e box de garagem, apartamento novo, pronto para morar. Gostaria de saber se você já conhece o imóvel pessoalmente ou prefere que eu envie mais detalhes, fotos e condições de pagamento por aqui?
[19/08/2026 17:24] Construtora Senger: Percebi também que já falamos sobre outros imóveis e nenhum atendeu sua necessidade
[19/08/2026 17:24] Construtora Senger: Teria alguma observação a fazer na sua busca que possa ajudar a encontrar as opções mais alinhadas com o perfil que você busca?
[19/08/2026 17:34] Noemi Barcarol Evoluti: Quantos meses quadrados ?
[19/08/2026 17:34] Noemi Barcarol Evoluti: Metros
[19/08/2026 17:35] Construtora Senger: [Arquivo enviado nesta mensagem: imagem — conteúdo não analisado pela IA]
[19/08/2026 17:35] Construtora Senger: 43m2 privativo mais box
[19/08/2026 17:36] Construtora Senger: Esse é um tamanho bom pra vocês?
[19/08/2026 17:36] Noemi Barcarol Evoluti: Não é muito pequeno
[19/08/2026 17:37] Construtora Senger: Temos maiores também
[19/08/2026 17:37] Construtora Senger: Me diz q tamanho seria bom pra vocês?
[19/08/2026 17:37] Noemi Barcarol Evoluti: Com 2 banheiros
[19/08/2026 17:40] Construtora Senger: Certo, e qual faixa de investimento vocês estão pensando?
[19/08/2026 17:40] Construtora Senger: Assim consigo enviar opções mais alinhadas ao que buscam
[19/08/2026 17:43] Noemi Barcarol Evoluti: Eu tenho 3 terrenos lá numa esquina da ouro preto não sei se vcs pegariam de entrada?
[19/08/2026 17:45] Construtora Senger: Podemos estudar, 1 terreno conseguimos analisar
[19/08/2026 17:46] Construtora Senger: Tudo depende da volta, desde que seja em torno de 40% do valor da compra, podemos estudar sim
[19/08/2026 17:47] Construtora Senger: Sua ideia seria financiar o saldo?
[19/08/2026 17:47] Construtora Senger: Dai podemos sim estudar o terreno como composição da entrada
[19/08/2026 18:39] Noemi Barcarol Evoluti: Como é 3 terrenos junto só posso trocar pelos 3 o valor dos terrenos fica 360,
[19/08/2026 18:40] Construtora Senger: Entendi, podemos analisar
[19/08/2026 18:41] Construtora Senger: Porém o valor da compra teria que ser em torno de 800mil
[19/08/2026 18:41] Construtora Senger: Se for interessante para vocês podemos avançar
[19/08/2026 18:42] Construtora Senger: Permuta em torno de 40 a 50% pode ser analisada sim
[19/08/2026 18:43] Construtora Senger: Só não conseguimos receber permuta de valor próximo a compra
[19/08/2026 18:44] Construtora Senger: Então é possível sim, a permuta pelos seus terrenos, desde que avaliados e com cerca de 50% de volta`;

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
