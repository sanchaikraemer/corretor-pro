import fs from "node:fs";
import assert from "node:assert/strict";
import { parseWhatsappTxt, guessLeadData, analyzeWithBrain } from "../api/_pipeline.js";
import { CONVERSA } from "./conversa-fixa-permuta.mjs";

// v1318 — AS TRÊS MENSAGENS SAEM PRONTAS PRA ENVIAR.
//
// Print do dono (20/08/2026, 07h32, versão 1317): a leitura da conversa ficou boa — pegou a
// permuta, os 3 terrenos, os R$ 360 mil, a faixa de R$ 800 mil, o "evite insistir em visita".
// As TRÊS MENSAGENS, não: sem bom dia, sem cumprimento nenhum, sem reconhecer o intervalo, e as
// três terminando na MESMA pergunta ("a faixa de R$ 800 mil serve pra vocês?").
//
// A causa não era o Cérebro dele — eram três linhas do próprio pedido:
//   1. "Se houver um único próximo passo adequado, as três podem convergir para ele" — essa regra
//      é do CÉREBRO do próprio corretor (documento V3) e continua valendo; o que faltava era dizer
//      que convergir no PASSO não autoriza repetir a mesma PERGUNTA três vezes;
//   2. "A saudação (...) deve seguir o Cérebro": o Cérebro DELE tem a regra das faixas de horário
//      escrita, e ela chegava na IA (não há corte — o teto por caixa é de 20 mil caracteres). Só
//      que o pedido fixo delegava e nunca EXIGIA que houvesse cumprimento, então a regra dele se
//      perdia no meio do resto. A autoridade continua sendo do Cérebro; o que entrou foi o piso;
//   3. quando a IA recomendava aguardar, continuava obrigada a preencher as três — e devolvia
//      rascunho.

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");

// ---------------------------------------------------------------------------
// 1) Convergir no PASSO continua permitido (é regra do Cérebro do corretor, documento V3, e foi
//    conciliada com o pedido fixo na v1206). O que passa a ser proibido é a mesma PERGUNTA
//    escrita três vezes — que é o que o print mostrou.
// ---------------------------------------------------------------------------
assert.match(
  pipeline,
  /Se houver um único próximo passo adequado, as três podem convergir para ele por abordagens diferentes/,
  "a regra de convergência é do Cérebro do corretor e não pode ser removida (ver v1206)"
);
assert.match(pipeline, /CONVERGIR NO PASSO NÃO É REPETIR A PERGUNTA/, "mas convergir não pode virar repetir a pergunta");
assert.match(pipeline, /Trocar palavra não é trocar caminho/);

// ---------------------------------------------------------------------------
// 2) Cumprimento e reconhecimento do intervalo deixaram de ser delegados.
// ---------------------------------------------------------------------------
// A frase de delegação é do dono (v1225) e continua de pé: quem decide QUAL saudação, se reconhece
// o intervalo e qual o próximo passo é o Cérebro dele.
assert.match(
  pipeline,
  /A saudação, o reconhecimento ou não do intervalo e o tipo de próximo passo devem seguir o Cérebro\./,
  "a autoridade do Cérebro sobre saudação e retomada não pode ser removida (ver v1225)"
);
// O que faltava era o PISO: ninguém exigia que a mensagem chegasse inteira.
assert.match(pipeline, /PISO DE FORMA — VALE PARA AS TRÊS MENSAGENS, SEMPRE/);
assert.match(pipeline, /toda mensagem abre cumprimentando a pessoa, pelo primeiro nome dela/);
assert.match(pipeline, /Mensagem que começa direto no assunto, sem cumprimento, é rascunho/);
// E o piso não pode atropelar as faixas de horário que o corretor escreveu no Cérebro dele.
assert.match(pipeline, /se ele definir faixas próprias, são as dele que valem/);

// ---------------------------------------------------------------------------
// 3) "Aguardar" não pode mais virar mensagem pela metade.
// ---------------------------------------------------------------------------
assert.match(pipeline, /RECOMENDAR ESPERAR NÃO LIBERA MENSAGEM PELA METADE/);
// A instrução tem que estar nas REGRAS, não dentro do modelo de JSON — dentro do modelo, a IA
// pode devolvê-la de volta como se fosse um campo da resposta.
assert.doesNotMatch(pipeline, /"_atencao_aguardar"/, "instrução não pode morar dentro do formato de resposta");

// ---------------------------------------------------------------------------
// 4) FIM A FIM: as três regras chegam ao pedido enviado à IA, junto com a saudação certa.
// ---------------------------------------------------------------------------
const timeline = parseWhatsappTxt(CONVERSA);
const lead = guessLeadData(timeline, "Miguel Kirinus", "Conversa do WhatsApp com Noemi Barcarol Evoluti.txt");
const chamadas = [];
const openaiMock = {
  chat: { completions: { create: async payload => {
    chamadas.push(payload);
    return { model: "mock-analise", choices: [{ message: { content: JSON.stringify({
      summary: "Resumo",
      diagnostico: { produtoPrincipal: "Produto", etapaFunil: "Atendimento" },
      mensagens: { recomendada: "Bom dia, Fulana? Um.", maisSuave: "Bom dia, Fulana? Dois.", maisDireta: "Bom dia, Fulana? Três." },
      recomendacaoContato: { aguardar: true, motivo: "dentro do prazo" },
      produtoInteresse: "Produto", produtosInteresse: ["Produto"],
      etapaSugerida: "Atendimento", clientProfile: "Perfil", nextAction: "Ação"
    }) } }] };
  } } }
};
const resultado = await analyzeWithBrain({
  lead, timeline, openai: openaiMock,
  cerebroConfig: { metodo: "método do corretor", diasDescansoPosAtendimento: 6 }
});

const pedido = chamadas.at(-1).messages.find(m => m.role === "user")?.content || "";
assert.match(pedido, /PISO DE FORMA — VALE PARA AS TRÊS MENSAGENS, SEMPRE/, "a exigência precisa chegar no pedido vivo");
assert.match(pedido, /CONVERGIR NO PASSO NÃO É REPETIR A PERGUNTA/, "idem para a proibição de repetir a pergunta");
assert.match(pedido, /RECOMENDAR ESPERAR NÃO LIBERA MENSAGEM PELA METADE/, "idem para o aguardar");
// A saudação certa do horário continua sendo entregue pronta, e agora existe regra que a usa.
assert.match(pedido, /Saudação correspondente ao horário neste instante: (Bom dia|Boa tarde|Boa noite)/);
// Recomendar aguardar continua funcionando (a tela mostra o aviso) — só não zera as mensagens.
assert.equal(resultado.recomendacaoContato.aguardar, true, "a recomendação de aguardar continua existindo");
assert.equal(resultado.messages.a, "Bom dia, Fulana? Um.", "e as três mensagens continuam vindo inteiras");

console.log("v1318-mensagem-pronta-pra-enviar: ok");
