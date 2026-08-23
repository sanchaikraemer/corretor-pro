import fs from "node:fs";
import assert from "node:assert/strict";
import { parseWhatsappTxt, guessLeadData, analyzeWithBrain } from "../api/_pipeline.js";
import { CONVERSA } from "./conversa-fixa-permuta.mjs";

// v1318 — AS TRÊS MENSAGENS SAEM PRONTAS PRA ENVIAR.
//
// v1372/governança: o prompt principal voltou ao estado medido pelo porteiro v1327. As garantias
// novas de convergência e de mensagem pronta ficam fora do coração medido: piso de forma,
// conferência determinística e reparo curto quando necessário. Este teste protege essa divisão.

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");

// 1) Convergência forte existe na camada de reparo sem transformar A/B/C em cópias.
assert.match(pipeline, /const systemPromptReparoMensagens = `Você é o revisor final das mensagens comerciais do Corretor Pro/);
assert.match(pipeline, /Se houver um único próximo passo adequado, as três DEVEM convergir para ele/);
assert.match(pipeline, /CONVERGIR NO PASSO NÃO É COPIAR A PERGUNTA/);
assert.match(pipeline, /MESMA LACUNA NÃO SIGNIFICA MESMA MENSAGEM/);

// 2) Cumprimento e forma mínima continuam sendo piso do produto, sem atropelar o Cérebro.
assert.match(
  pipeline,
  /A saudação, o reconhecimento ou não do intervalo e o tipo de próximo passo devem seguir o Cérebro\./,
  "a autoridade do Cérebro sobre saudação e retomada precisa continuar"
);
assert.match(pipeline, /PISO DE FORMA — VALE PARA AS TRÊS MENSAGENS, SEMPRE/);
assert.match(pipeline, /toda mensagem abre cumprimentando a pessoa, pelo primeiro nome dela/);
assert.match(pipeline, /Mensagem que começa direto no assunto, sem cumprimento, é rascunho/);
assert.match(pipeline, /se ele definir faixas próprias, são as dele que valem/);

// 3) "Aguardar" não autoriza rascunho; a mensagem continua preparada para quando o prazo vencer.
assert.match(pipeline, /RECOMENDAR ESPERAR NÃO LIBERA MENSAGEM PELA METADE/);
assert.doesNotMatch(pipeline, /"_atencao_aguardar"/, "instrução não pode morar dentro do formato de resposta");

// 4) FIM A FIM NORMAL: o prompt medido continua recebendo o piso de forma e a saudação calculada.
// A convergência reforçada não precisa aparecer na primeira chamada; ela só entra se a conferência
// reprovar as mensagens, o que evita alterar o diagnóstico medido sem nova bateria comercial.
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

const pedidoPrincipal = chamadas[0].messages.find(m => m.role === "user")?.content || "";
assert.match(pedidoPrincipal, /PISO DE FORMA — VALE PARA AS TRÊS MENSAGENS, SEMPRE/, "o piso precisa chegar ao pedido vivo");
assert.match(pedidoPrincipal, /Saudação correspondente ao horário neste instante: (Bom dia|Boa tarde|Boa noite)/);
assert.equal(resultado.recomendacaoContato.aguardar, true, "a recomendação de aguardar continua existindo");
assert.equal(resultado.messages.a, "Bom dia, Fulana? Um.", "mensagem válida continua inteira");

// O teste específico v1372-julsimar-reparo-e2e cobre o segundo caminho: resposta ruim -> reparo
// -> três mensagens convergentes e sem compromisso inventado.
assert.match(pipeline, /systemPrompt: systemPromptReparoMensagens/,
  "quando houver bloqueio, a segunda chamada precisa usar o revisor dedicado e não refazer o diagnóstico");

console.log("v1318-mensagem-pronta-pra-enviar: ok");
