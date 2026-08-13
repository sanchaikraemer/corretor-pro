// v1243 — a instrução que manda a IA escrever no jeito do corretor apontava pro lugar errado
// DENTRO DO PRÓPRIO PEDIDO.
//
// CASO REAL (print + conversa colada pelo dono em 13/08/2026): um contato que é parceiro de leilão
// e amigo de anos — os dois se tratam por "mano", "maninho", "kambio", "buenas", "abss". As três
// sugestões saíram formais e genéricas ("Bom dia Thume, tudo certo? Passou a semana que tínhamos
// comentado..."), e ele: "veja q bosta de sugestoes, nada a ver com o contexto".
//
// Investigando com a conversa dele: a VOZ REAL chegava certinha no pedido — "blzzz. valeu mano,
// abss", "Buenas, na escuta kambio", "310 tava no anuncio né?". O problema era a instrução ao lado
// dela: dizia "as mensagens reais dele que você recebeu ACIMA", e o bloco de exemplos vem ABAIXO
// dela no prompt montado. Instrução que manda procurar no vazio não vale nada — a IA não acha a
// régua da voz e escreve como vendedor genérico, que é exatamente o que ele reclamou.
//
// (Este teste NÃO mexe em quanto da conversa é lido. O sistema lê SEMPRE o histórico inteiro do
// cliente — ver v1241 e a correção do dono em 13/08/2026: "o sistema deve ler sempre todo
// historico do cliente".)
import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain } from "../api/_pipeline.js";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");

const capt = {};
const openai = { chat: { completions: { create: async (args) => {
  capt.system = String(args?.messages?.find(m => m.role === "system")?.content || "");
  capt.user = String(args?.messages?.find(m => m.role === "user")?.content || "");
  return { model: "gpt-teste", choices: [{ message: { content: JSON.stringify({ summary: "s", mensagens: {
    recomendada: "Oi! Como ficou?", maisSuave: "Oi! Tudo certo?", maisDireta: "Oi! Retomo?"
  } }) } }], usage: {} };
} } } };

// Conversa no registro real dele: informal, de anos, com o parceiro de leilão.
const timeline = [
  { date: "23/06/2023", time: "10:53", iso: "2023-06-23T13:53:00.000Z", author: "Sanchai", text: "310 tava no anuncio né?" },
  { date: "23/06/2023", time: "10:54", iso: "2023-06-23T13:54:00.000Z", author: "Thume Leilao", text: "sim... no anúncio está 310" },
  { date: "08/07/2026", time: "10:39", iso: "2026-07-08T13:39:00.000Z", author: "Sanchai", text: "Buenas, na escuta kambio. posso agora sim" },
  { date: "08/07/2026", time: "15:17", iso: "2026-07-08T18:17:00.000Z", author: "Sanchai", text: "blzzz. valeu mano, abss" },
  { date: "29/07/2026", time: "09:16", iso: "2026-07-29T12:16:00.000Z", author: "Sanchai", text: "buenas mano, como vai? foi arrematado, quanto?" },
  { date: "03/08/2026", time: "14:21", iso: "2026-08-03T17:21:00.000Z", author: "Thume Leilao", text: "Buenas mano! sim... dei uma olhada... vamos falar sobre o assunto na semana que vem" },
  { date: "03/08/2026", time: "14:32", iso: "2026-08-03T17:32:00.000Z", author: "Sanchai", text: "Combinado" }
];

const r = await analyzeWithBrain({
  lead: { clientName: "Thume Leilao" }, timeline, openai,
  cerebroConfig: { corretorNome: "Sanchai", metodo: "M", tom: "T", diferenciais: "", evitar: "", regras: [], objecoes: [] }
});

// ── 1) A instrução não pode mandar procurar "acima" o que está abaixo ───────────────────────
const posInstrucao = capt.system.indexOf("ESCREVA COMO ESTE CORRETOR ESCREVE");
const posExemplos = capt.system.indexOf("=== COMO ESTE CORRETOR ESCREVE");
assert.ok(posInstrucao > -1, "a instrução de escrever no jeito dele precisa existir");
assert.ok(posExemplos > -1, "e o bloco com as mensagens reais dele também");
assert.ok(posInstrucao < posExemplos, "sanidade: a instrução vem antes dos exemplos no prompt montado");
assert.doesNotMatch(capt.system, /que você\s*\n?recebeu acima/,
  'a instrução não pode dizer "recebeu acima" quando os exemplos estão abaixo dela');
assert.match(capt.system, /recebe logo abaixo, no bloco "COMO ESTE CORRETOR ESCREVE"/,
  "ela precisa apontar pro bloco certo, pelo nome, pra IA achar a régua da voz");

// ── 2) E a voz real precisa estar mesmo lá ──────────────────────────────────────────────────
for (const dele of ["blzzz. valeu mano, abss", "Buenas, na escuta kambio", "310 tava no anuncio né?"]) {
  assert.ok(capt.system.includes(dele),
    `a mensagem real dele ("${dele}") é a régua do jeito de escrever — precisa chegar no pedido`);
}

// ── 3) O sistema continua lendo o HISTÓRICO INTEIRO ─────────────────────────────────────────
// Correção do dono em 13/08/2026: "eu falei pra considerar somente desse ano mas nao a nivel de
// sistema, o sistema deve ler sempre todo historico do cliente". Chegou a existir um filtro por
// ano aqui; foi desfeito, e este assert existe pra ele não voltar por engano.
assert.equal(r.conversaLidaPelaIA.mensagensEnviadas, timeline.length,
  "todas as mensagens do cliente precisam chegar na IA, de qualquer ano");
const conversa = capt.user.slice(capt.user.indexOf("CONVERSA COMPLETA:"));
assert.ok(conversa.includes("310 tava no anuncio"), "mensagem de 2023 continua indo — o histórico é inteiro");
assert.ok(conversa.includes("Combinado"), "e a de agora também");
assert.doesNotMatch(pipeline, /DIRECIONA_ANO_ANALISE|MIN_MSGS_ANO/,
  "não pode existir filtro por ano no pipeline: o sistema lê sempre todo o histórico do cliente");

console.log("v1243-instrucao-da-voz-aponta-certo: ok");
