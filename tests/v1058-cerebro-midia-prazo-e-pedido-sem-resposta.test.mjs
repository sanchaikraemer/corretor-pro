import fs from "node:fs";
import assert from "node:assert/strict";
import { parseWhatsappTxt, analyzeWithBrain } from "../api/_pipeline.js";

// v1058 — a conversa real da Karine (lead da Construtora Senger, usada como caso de teste na
// revisão dos prompts do Cérebro) expôs 4 furos concretos:
// 1) o piso comercial fixo (INTELIGENCIA_CARTEIRA) citava "reserva de unidade" como tática de
//    negociação avançada — direto contra a regra do corretor de nunca falar em reserva.
// 2) "se formos investir" é fala coloquial comum (= "se a gente topar comprar"), mas nada
//    avisava a IA pra não rotular o objetivo do cliente como investimento só por essa palavra.
// 3) foto/vídeo/PDF enviados pelo corretor pelo WhatsApp somem INTEIRAMENTE do texto que a IA lê
//    (parseWhatsappTxt descartava a linha toda) — a IA não sabia nem que algo tinha sido enviado,
//    não só o conteúdo (que já era certo não tentar adivinhar).
// 4) quando o cliente pede algo específico e a resposta manda outra coisa, isso não ficava
//    registrado em nenhum campo da análise.
// 5) a regra de retomada do próprio corretor ("depois de X dias, reconheça o intervalo") não
//    tinha nenhum número real fornecido pelo sistema pra comparar.

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// ---------------------------------------------------------------------------
// 1) "Reserva de unidade" não pode mais ser prescrita no piso fixo — cada organização decide
//    isso no próprio Cérebro.
// ---------------------------------------------------------------------------
assert.doesNotMatch(pipeline, /Reserva só com negociação avançada/, "reserva não pode mais ser sugerida pelo texto fixo");

// ---------------------------------------------------------------------------
// 2) Aviso sobre o uso coloquial de "investir" precisa estar na base fixa.
// ---------------------------------------------------------------------------
assert.match(pipeline, /CUIDADO com a palavra "investir"/, "precisa alertar sobre o uso coloquial de 'investir'");

// ---------------------------------------------------------------------------
// 3) parseWhatsappTxt: PDF, vídeo e imagem enviados não podem sumir sem deixar rastro.
// ---------------------------------------------------------------------------
const linhasMidia = [
  "20/06/2026 10:45 - Construtora Senger: ‎FOLDER EVOLUTTI (2).pdf (arquivo anexado)",
  "20/06/2026 11:20 - Construtora Senger: ‎VID-20260620-WA0002.mp4 (arquivo anexado)",
  "20/06/2026 11:23 - Construtora Senger: ‎IMG-20260620-WA0005.jpg (arquivo anexado)",
  "20/06/2026 11:25 - Karine: Recebi, obrigada!"
].join("\n");
const timelineMidia = parseWhatsappTxt(linhasMidia);
assert.equal(timelineMidia.length, 4, "PDF, vídeo e imagem enviados não podem mais desaparecer da conversa que a IA lê");
assert.match(timelineMidia[0].text, /documento\/PDF.*não analisado/i, "PDF precisa deixar um marcador factual do envio");
assert.match(timelineMidia[1].text, /vídeo.*não analisado/i, "vídeo precisa deixar um marcador factual do envio");
assert.match(timelineMidia[2].text, /imagem.*não analisado/i, "imagem precisa deixar um marcador factual do envio");
assert.equal(timelineMidia[3].text, "Recebi, obrigada!", "mensagem de texto normal continua intacta");

// Áudio continua com o comportamento antigo (texto literal preservado — é resolvido depois por
// findReferencedAudio/buildTimeline, não deve virar um marcador genérico).
const timelineAudio = parseWhatsappTxt("20/06/2026 10:00 - Karine: ‎audio-teste.opus (arquivo anexado)");
assert.equal(timelineAudio.length, 1);
assert.match(timelineAudio[0].text, /audio-teste\.opus \(arquivo anexado\)/, "áudio deve continuar literal, sem virar marcador");

// ---------------------------------------------------------------------------
// 4) e 5) comportamento fim a fim de analyzeWithBrain: prazo configurado chega no prompt vivo,
//    aviso de "investir" e ausência de "reserva" chegam no prompt vivo, e o campo novo
//    pedidoSemResposta é pedido à IA, mapeado no resultado e cai em "Nenhum" quando ausente.
// ---------------------------------------------------------------------------
const chamadas = [];
function mockComCampo(diagnosticoExtra) {
  return {
    chat: { completions: { create: async payload => {
      chamadas.push(payload);
      return { model: "mock-gpt", choices: [{ message: { content: JSON.stringify({
        summary: "Resumo",
        diagnostico: { produtoPrincipal: "Produto", etapaFunil: "Atendimento", ...diagnosticoExtra },
        mensagens: { recomendada: "Boa tarde?", maisSuave: "Boa tarde?", maisDireta: "Boa tarde?" },
        produtoInteresse: "Produto",
        produtosInteresse: ["Produto"],
        etapaSugerida: "Atendimento",
        clientProfile: "Perfil",
        nextAction: "Ação"
      }) } }] };
    } } }
  };
}
const timeline = [{ date: "20/06/2026", time: "10:53", author: "Karine", text: "03 quartos, churrasqueira a carvão" }];

const resultado = await analyzeWithBrain({
  lead: { clientName: "Karine" }, timeline,
  openai: mockComCampo({ pedidoSemResposta: "Cliente pediu 2 quartos prontos; a resposta ofereceu produto na planta." }),
  cerebroConfig: { metodo: "método do corretor", diasDescansoPosAtendimento: 7 }
});
const systemVivo = chamadas.at(-1).messages.find(m => m.role === "system")?.content || "";
const userVivo = chamadas.at(-1).messages.find(m => m.role === "user")?.content || "";

// v1240 — este aviso é MÉTODO comercial, e método virou assunto do Cérebro do corretor. Ele
// continua existindo como ponto de partida pra quem ainda não escreveu o dele (METODO_BASE_PREVIA);
// pra quem já tem Cérebro, quem decide isso é o Cérebro. O que se confere é que a orientação não
// se perdeu do produto.
assert.match(pipeline, /CUIDADO com a palavra "investir"/, "o aviso do 'investir' precisa continuar no ponto de partida de quem não tem Cérebro");
assert.doesNotMatch(systemVivo, /Reserva só com negociação avançada/, "reserva não pode chegar no prompt vivo");
assert.match(userVivo, /Prazo configurado pelo corretor para reconhecer intervalo\/retomada.*: 7 dias corridos/, "o prazo configurado (7, igual ao Descanso após atender) precisa chegar no prompt vivo");
assert.match(userVivo, /"pedidoSemResposta":"texto"/, "o formato JSON pedido à IA precisa incluir pedidoSemResposta");
assert.match(userVivo, /PEDIDO SEM RESPOSTA DIRETA/, "a instrução explicando quando preencher o campo precisa estar no prompt vivo");
assert.equal(resultado.diagnostico.pedidoSemResposta, "Cliente pediu 2 quartos prontos; a resposta ofereceu produto na planta.", "o campo novo precisa vir populado no resultado final");

// Sem diasDescansoPosAtendimento configurado, cai no padrão (5), igual ao clamp de cerebro-config.js.
await analyzeWithBrain({
  lead: { clientName: "Karine-sem-config" }, timeline,
  openai: mockComCampo({}), cerebroConfig: { metodo: "método do corretor" }
});
assert.match(chamadas.at(-1).messages.find(m => m.role === "user")?.content || "", /: 5 dias corridos/, "sem configuração, o prazo padrão precisa ser 5 dias");

// Valor fora do teto (1–60) também cai no padrão 5.
await analyzeWithBrain({
  lead: { clientName: "Karine-fora-do-teto" }, timeline,
  openai: mockComCampo({}), cerebroConfig: { metodo: "método do corretor", diasDescansoPosAtendimento: 90 }
});
assert.match(chamadas.at(-1).messages.find(m => m.role === "user")?.content || "", /: 5 dias corridos/, "valor fora do teto (60) precisa cair no padrão 5");

// Quando a IA não devolve pedidoSemResposta, o padrão precisa ser "Nenhum" (confirma que não há
// pedido pendente), não "Não identificado" (que significa "não deu pra saber").
const resultadoSemCampo = await analyzeWithBrain({
  lead: { clientName: "Karine-sem-pedido" }, timeline,
  openai: mockComCampo({}), cerebroConfig: { metodo: "método do corretor" }
});
assert.equal(resultadoSemCampo.diagnostico.pedidoSemResposta, "Nenhum", "sem o campo vindo da IA, o padrão precisa ser 'Nenhum'");

// ---------------------------------------------------------------------------
// UI: a tela do lead precisa mostrar o campo novo (cp704DetailRows, api/_pipeline.js).
// ---------------------------------------------------------------------------
assert.match(app, /\['Pedido do cliente ainda sem resposta direta'/, "a tela do lead precisa ter a linha nova");
assert.match(app, /a\?\.diagnostico\?\.pedidoSemResposta/, "a linha nova precisa ler diagnostico.pedidoSemResposta");

console.log("v1058-cerebro-midia-prazo-e-pedido-sem-resposta: ok");
