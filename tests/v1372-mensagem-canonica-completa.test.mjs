import fs from "node:fs";
import assert from "node:assert/strict";
import {
  parseWhatsappTxt,
  guessLeadData,
  montarEstadoComercialDeterministico,
  lacunaComercialPrioritaria,
  montarFicharioDaConversa,
  avisosDeQualidadeDasMensagens
} from "../api/_pipeline.js";

// v1372 — revisão final antes de subir: não basta as três perguntarem a MESMA lacuna.
// Cada uma precisa conduzir como a mensagem aprovada no caso Julsimar:
// contexto real -> motivo da pergunta -> pergunta prioritária -> o que o corretor fará com a resposta.
const CONVERSA = `[18/08/2026 15:38] Construtora Senger: Boa tarde, Julcimar! Tudo bem? Você conseguiu dar uma olhada no Premium Office?
[18/08/2026 15:46] Julsimar Chapada: Dei uma olhada sim
[18/08/2026 15:48] Julsimar Chapada: Estamos analisando ainda, mas gostei da ideia
[18/08/2026 15:48] Julsimar Chapada: O Nicolas me falou mais ou menos as condições de pagamento
[18/08/2026 16:06] Construtora Senger: Hoje estamos trabalhando com 20% de entrada e saldo em até 30x. Se ficar melhor, dá para distribuir parte em reforços anuais. Você já tem algo em mente? Se quiser posso lhe encaminhar mais informações.
[18/08/2026 16:08] Julsimar Chapada: Joia.`;

const timeline = parseWhatsappTxt(CONVERSA);
const lead = guessLeadData(timeline, "Construtora Senger", "Conversa do WhatsApp com Julsimar Chapada.txt");
const agora = new Date("2026-08-22T12:20:00-03:00");
const estado = montarEstadoComercialDeterministico(timeline, "Construtora Senger", lead, agora);
const lacuna = lacunaComercialPrioritaria(timeline, "Construtora Senger", lead, estado);
assert.equal(lacuna?.id, "faixa_valor");

const contexto = {
  conversa: CONVERSA,
  cerebro: "",
  catalogo: [],
  topicosRespondidos: estado.topicosConfirmados,
  compromisso: estado.compromisso,
  lacunaPrioritaria: lacuna,
  temOQueEntregar: false
};

const referencia = "Bom dia, Julcimar! Retomando nossa conversa sobre o Premium Office: como vocês estão analisando a possibilidade de investimento, queria entender uma coisa para eu conseguir montar algo mais objetivo para vocês. Qual faixa de valor vocês pensam em investir hoje? A partir disso consigo separar as unidades e montar a condição que mais faz sentido.";
const avisosReferencia = avisosDeQualidadeDasMensagens([{ qual: "a", texto: referencia }], contexto);
assert.deepEqual(avisosReferencia, [], "a mensagem aprovada precisa passar limpa");

// Três redações realmente diferentes, mas todas executam a MESMA jogada completa.
const boas = avisosDeQualidadeDasMensagens([
  { qual: "a", texto: referencia },
  { qual: "b", texto: "Bom dia, Julcimar! Retomando o Premium Office, quero filtrar isso direito para não te mandar opção fora do que vocês estão pensando. Em que faixa de valor vocês pretendem investir? Com essa faixa eu separo poucas unidades e monto a condição em cima do que realmente cabe." },
  { qual: "c", texto: "Bom dia, Julcimar! Indo direto ao ponto no Premium Office: qual faixa de valor vocês querem considerar? Com esse número eu consigo ir às unidades compatíveis e te passar uma condição objetiva." }
], contexto);
assert.deepEqual(boas, [], "as três variações completas da mesma jogada precisam passar sem aviso");

// A da v1370 pedia a lacuna certa, mas terminava devolvendo a bola ao cliente. É melhor que B/C,
// porém ainda não atinge a arquitetura aprovada: falta dizer o que acontece depois da resposta.
const perguntaSolta = avisosDeQualidadeDasMensagens([
  { qual: "a", texto: "Boa tarde, Julsimar! Sobre o Premium Office que vocês ficaram de analisar, para eu separar poucas opções e te passar os valores de cada uma, em que faixa vocês pretendem investir?" }
], contexto);
assert.ok(perguntaSolta.some(a => a.motivos.some(m => /não diz o que fará com a resposta/i.test(m))),
  "pergunta correta sem consequência prática precisa ir para reparo");

// Os dois desvios do print v1370 continuam bloqueados.
const desvios = avisosDeQualidadeDasMensagens([
  { qual: "b", texto: "Boa tarde, Julcimar! Quanto vocês pensam em colocar de entrada? Com isso monto a condição." },
  { qual: "c", texto: "Boa tarde, Julcimar! Vocês preferem parcelas mensais ou reforços anuais? Com isso preparo a simulação." }
], contexto);
assert.ok(desvios.some(a => a.qual === "b" && a.motivos.some(m => /lacuna prioritária/i.test(m))));
assert.ok(desvios.some(a => a.qual === "c" && a.motivos.some(m => /lacuna prioritária/i.test(m))));

// Revisão final extra: não basta a ÚLTIMA pergunta ser a lacuna certa. A mensagem não pode
// esconder uma segunda qualificação antes dela (ex.: perguntar entrada e depois faixa).
const duasLacunasNaMesmaMensagem = avisosDeQualidadeDasMensagens([
  { qual: "a", texto: "Bom dia, Julcimar! Retomando o Premium Office, quanto vocês pensam em colocar de entrada? E em que faixa total pretendem investir? A partir disso consigo separar as unidades e montar a condição que mais faz sentido." }
], contexto);
assert.ok(duasLacunasNaMesmaMensagem.some(a => a.motivos.some(m => /pergunta secundária.*entrada.*lacuna prioritária/i.test(m))),
  "uma pergunta secundária antes da faixa também precisa disparar reparo");

// Saudação social não é uma segunda lacuna comercial.
const saudacaoMaisLacuna = avisosDeQualidadeDasMensagens([
  { qual: "a", texto: "Bom dia, Julcimar! Tudo bem? Retomando o Premium Office, em que faixa de valor vocês pensam em investir? A partir disso eu separo as unidades e monto a condição que mais faz sentido." }
], contexto);
assert.deepEqual(saudacaoMaisLacuna, [], "'Tudo bem?' não pode ser confundido com segunda qualificação");

const fichario = montarFicharioDaConversa(timeline, "Construtora Senger", lead, agora, estado);
assert.match(fichario, /TRÊS mensagens devem ser três REDAÇÕES da MESMA jogada comercial/i);
assert.match(fichario, /retomar o assunto real → explicar em linguagem natural por que essa informação ajuda agora → perguntar a lacuna → dizer concretamente o que o corretor fará com a resposta/i);

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
assert.match(pipeline, /pergunta a lacuna certa, mas não diz o que fará com a resposta/,
  "a arquitetura aprovada precisa ter conferência determinística, não só prompt");
assert.match(pipeline, /depois de pedir a lacuna, diga em uma frase curta o que o corretor fará com a resposta/i,
  "o reparo automático precisa corrigir pergunta solta");
assert.doesNotMatch(pipeline, /Varie a estratégia: uma pode explicar que vai filtrar/i,
  "não pode sobreviver instrução que contradiga a mensagem canônica");

console.log("v1372-mensagem-canonica-completa: ok");
