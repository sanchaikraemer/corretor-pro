import assert from "node:assert/strict";
import {
  parseConversaColada,
  expandirObservacoesColadas,
  tentativasSemRespostaDoCorretor,
  calcularContextoTemporalMensagens
} from "../api/_pipeline.js";

// v1287 — CASO REAL DO DONO (17/08/2026, lead do Quality Residence).
//
// O WhatsApp ainda não tinha sido reexportado, então ele colou o pedaço novo da conversa no campo
// de Observação — inclusive a mensagem em que a cliente diz exatamente o que procura. Como toda
// observação valia como recado DO CORRETOR, o sistema mandou pra IA "TENTATIVAS DO CORRETOR AINDA
// SEM RESPOSTA: 4. O cliente não respondeu nenhuma delas", quando ela tinha respondido quatro
// vezes em três dias. A IA obedeceu ao fato errado: chamou pra visita cravando dia e hora, e
// escreveu que já tinham sido enviadas opções que nunca saíram.

const CLIENTE = "Geovana Bueno";
const CORRETOR = "Construtora Senger";

const colado = [
  "[16:34, 14/08/2026] Construtora Senger: Boa tarde Geovana, existe algum critério que ainda está pesando?",
  "[17:06, 14/08/2026] Geovana Bueno: Oi. Boa tarde, mudança de planos",
  "[17:06, 14/08/2026] Geovana Bueno: Apartamento",
  "[17:10, 14/08/2026] Construtora Senger: Perfeito, temos opções de apartamentos prontos e na planta",
  "[20:49, 14/08/2026] Geovana Bueno: Oi. Sim",
  "[13:15, 15/08/2026] Construtora Senger: Bom dia! Você busca 2 ou 3 dormitórios?",
  "",
  "E prefere pronto ou na planta?",
  "[18:12, 15/08/2026] Geovana Bueno: Oi. Boa tarde, procuro apartamento de 2 dormitórios, sacada e boa iluminação, próximo ao hospital, com financiamento"
].join("\n");

// ── 1. O formato colado do celular é reconhecido ───────────────────────────────────────────────
const msgs = parseConversaColada(colado, "17/08/2026");
assert.equal(msgs.length, 7, "as sete falas coladas precisam virar sete mensagens");
assert.equal(msgs[0].author, "Construtora Senger");
assert.equal(msgs[0].date, "14/08/2026", "hora antes da data é o formato do 'copiar mensagens' do celular");
assert.equal(msgs[6].author, CLIENTE);
assert.match(msgs[6].text, /2 dormitórios, sacada e boa iluminação/);
assert.match(msgs[5].text, /prefere pronto ou na planta/,
  "linha quebrada continua na mesma fala, não vira mensagem solta");

// Data sem ano ("15/08") herda o ano da observação em que o trecho foi colado.
const semAno = parseConversaColada("[09:10, 15/08] Geovana Bueno: bom dia", "17/08/2026");
assert.equal(semAno[0].date, "15/08/2026");

// ── 2. Anotação de verdade CONTINUA anotação ───────────────────────────────────────────────────
// Esta é a linha que não pode ser cruzada: uma observação comum não pode virar mensagem falsa.
assert.deepEqual(parseConversaColada("já mandei outra opção por imagem, o sistema não capta"), []);
assert.deepEqual(parseConversaColada("não quis responder importunando ela no domingo, vamos retomar agora"), []);
assert.deepEqual(parseConversaColada(""), []);

// ── 3. Na análise, o trecho colado entra no lugar certo do histórico ───────────────────────────
const timeline = [
  { date: "06/06/2026", time: "15:47", author: CLIENTE, text: "quero muito comprar um imóvel" },
  { date: "17/07/2026", time: "10:48", author: CORRETOR, text: "Bom dia Geovana, conseguiu analisar as opções?" },
  { date: "27/07/2026", time: "17:41", author: CORRETOR, text: "Boa tarde Geovana, posso esclarecer algum ponto?" },
  { date: "14/08/2026", time: "16:34", author: CORRETOR, text: "Boa tarde Geovana, existe algum critério que ainda está pesando?" },
  { id: "obs-1", order: 900, date: "17/08/2026", time: "08:49", author: "Observação do corretor", type: "observacao_manual", source: "corretor-pro-manual", text: colado },
  { id: "obs-2", order: 901, date: "17/08/2026", time: "08:50", author: "Observação do corretor", type: "observacao_manual", source: "corretor-pro-manual", text: "não quis responder importunando ela no domingo" }
];
const expandida = expandirObservacoesColadas(timeline);
const ultimaReal = expandida.filter(m => m.type !== "observacao_manual").pop();
assert.equal(ultimaReal.author, CLIENTE, "a última palavra da conversa é da CLIENTE");
assert.match(ultimaReal.text, /2 dormitórios/);

// A mensagem de 14/08 16:34 está nos dois lugares (importação e trecho colado) — não pode duplicar.
const dezesseis = expandida.filter(m => String(m.text).includes("existe algum critério que ainda está pesando"));
assert.equal(dezesseis.length, 1, "mensagem repetida nos dois lugares não pode aparecer duas vezes");

// A anotação de verdade sobrevive como anotação.
assert.equal(expandida.filter(m => m.type === "observacao_manual").length, 1);

// ── 4. E é isso que conserta os números que o prompt manda pra IA ──────────────────────────────
const lead = { clientName: CLIENTE };
assert.equal(tentativasSemRespostaDoCorretor(timeline, CORRETOR, lead).tentativas, 3,
  "antes: o sistema contava tentativas ignoradas que nunca existiram (no caso real do dono, quatro)");
assert.equal(tentativasSemRespostaDoCorretor(expandida, CORRETOR, lead).tentativas, 0,
  "depois: a última palavra é da cliente, então não há tentativa sem resposta");

const agora = new Date("2026-08-17T11:53:00Z");
// Anotação do corretor deixou de contar como mensagem: salvar uma observação hoje zerava o tempo
// parado, como se a cliente tivesse escrito hoje.
const soAnotacao = [
  { date: "14/08/2026", time: "16:34", author: CORRETOR, text: "Boa tarde Geovana" },
  { date: "17/08/2026", time: "08:50", author: "Observação do corretor", type: "observacao_manual", source: "corretor-pro-manual", text: "liguei e não atendeu" }
];
assert.equal(calcularContextoTemporalMensagens(soAnotacao, {}, agora).dias, 3,
  "a conta do tempo parado ignora a anotação e usa a última mensagem de verdade");

const temporal = calcularContextoTemporalMensagens(expandida, {}, agora);
assert.equal(temporal.ultimaData, "15/08/2026");
assert.equal(temporal.dias, 2, "com o trecho colado lido como conversa, o tempo parado é o real");

console.log("v1287-observacao-colada-vira-conversa: ok (7 falas coladas, 0 tentativas falsas, 2 dias reais)");
