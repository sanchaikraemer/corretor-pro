// v1243 — "o problema nao é tempo de historico, é a analise do conteto e formulações das
// sugestoes. ja te falei mil vezes pra prestar a atencao nisso q é o principio de tudo" (dono,
// 13/08/2026).
//
// CASO REAL (print + conversa colada por ele): contato que é PARCEIRO DE LEILÃO e amigo. Nos
// últimos dois meses existiam TRÊS assuntos vivos ao mesmo tempo:
//   08/07 — o PAI dele quer visitar o escritório do contato quando passar o inverno (o contato até
//           passou o endereço e disse "vamos falando mais perto qdo esquentar"). Hoje é agosto.
//   29/07 — LEILÃO: proposta de 825 mil, esperando o juiz homologar. O corretor disse que ia levar
//           a oportunidade pros chefes. Dez dias depois: homologou?
//   03/08 — RENAISSANCE: "dei uma olhada... vamos falar na semana que vem" / "Combinado".
//
// O app sugeriu três variações de "passou a semana, quer ver planta ou simulação?" — e formais
// ("Bom dia Thume, tudo certo?") com alguém que ele trata por "mano", "kambio", "blzzz", "abss".
//
// Dois defeitos de código, os dois consertados aqui:
//   1. A LEITURA só enxergava UM fio ("ondeParou" era singular) — os outros dois sumiam antes de
//      a IA sequer escolher. Sobrava o assunto da última mensagem, que quase nunca é o melhor.
//   2. O TRATAMENTO: só as mensagens do CORRETOR iam no pedido. Registro é coisa de dois; sem ver
//      como o cliente fala com ele, o modelo cai no padrão comercial.
//
// (NÃO se mexe em quanto da conversa é lido: "o sistema deve ler sempre todo historico do
// cliente" — dono, mesmo dia.)
import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain } from "../api/_pipeline.js";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");

const capt = {};
const openai = { chat: { completions: { create: async (args) => {
  capt.system = String(args?.messages?.find(m => m.role === "system")?.content || "");
  capt.user = String(args?.messages?.find(m => m.role === "user")?.content || "");
  return { model: "gpt-teste", choices: [{ message: { content: JSON.stringify({ summary: "s", mensagens: {
    recomendada: "Buenas mano! e aquele do leilão, homologou?",
    maisSuave: "Buenas! passou o frio, o pai quer te fazer a visita",
    maisDireta: "Mano, e o Renaissance, seguimos?"
  } }) } }], usage: {} };
} } } };

// A conversa real dele, encurtada nos pontos que importam.
const timeline = [
  { date: "23/06/2023", time: "10:53", iso: "2023-06-23T13:53:00.000Z", author: "Sanchai", text: "310 tava no anuncio né?" },
  { date: "23/06/2023", time: "10:54", iso: "2023-06-23T13:54:00.000Z", author: "Thume Leilao", text: "sim... no anúncio está 310" },
  { date: "30/04/2026", time: "14:17", iso: "2026-04-30T17:17:00.000Z", author: "Thume Leilao", text: "Buenas. Consegue me dar mais informações?" },
  { date: "30/04/2026", time: "15:54", iso: "2026-04-30T18:54:00.000Z", author: "Sanchai", text: "6mil o m2 mano" },
  { date: "08/07/2026", time: "10:38", iso: "2026-07-08T13:38:00.000Z", author: "Thume Leilao", text: "kambio. bom dia mano. quando puder falar... me liga ou me avisa!" },
  { date: "08/07/2026", time: "14:53", iso: "2026-07-08T17:53:00.000Z", author: "Sanchai", text: "Falei com o pai, ele gostou da ideia, mas pediu pra dar um tempinho porque agora é inverno. Deixa passar o inverno, aí ele te procura." },
  { date: "08/07/2026", time: "15:15", iso: "2026-07-08T18:15:00.000Z", author: "Thume Leilao", text: "buenas... tranquilo.... sem problemas! vamos falando mais perto qdo esquentar... escritório é na BR, na frente da Mekal" },
  { date: "08/07/2026", time: "15:17", iso: "2026-07-08T18:17:00.000Z", author: "Sanchai", text: "blzzz. valeu mano, abss" },
  { date: "29/07/2026", time: "09:16", iso: "2026-07-29T12:16:00.000Z", author: "Sanchai", text: "buenas mano, como vai? foi arrematado, quanto?" },
  { date: "29/07/2026", time: "09:21", iso: "2026-07-29T12:21:00.000Z", author: "Thume Leilao", text: "bom dia. tudo bem mano? foi juntada proposta... vamos ver se vai homologar" },
  { date: "29/07/2026", time: "09:26", iso: "2026-07-29T12:26:00.000Z", author: "Sanchai", text: "Vou comentar com os chefes aqui, essa parte comercial tem que apresentar oportunidades boas" },
  { date: "03/08/2026", time: "14:21", iso: "2026-08-03T17:21:00.000Z", author: "Thume Leilao", text: "Buenas mano! sim... dei uma olhada... vamos falar sobre o assunto na semana que vem" },
  { date: "03/08/2026", time: "14:32", iso: "2026-08-03T17:32:00.000Z", author: "Sanchai", text: "Combinado" }
];

const r = await analyzeWithBrain({
  lead: { clientName: "Thume Leilao" }, timeline, openai,
  cerebroConfig: { corretorNome: "Sanchai", metodo: "M", tom: "T", diferenciais: "", evitar: "", regras: [], objecoes: [] }
});

// ══ 1. A LEITURA PRECISA ENXERGAR TODOS OS FIOS, NÃO SÓ O ÚLTIMO ═══════════════════════════
assert.match(capt.user, /"ondeParou": TODOS os assuntos que ficaram em aberto — não só o último/,
  "o pedido precisa exigir TODOS os assuntos em aberto");
assert.match(capt.user, /o erro que mais estraga a sugestão é enxergar\s*\n?\s*só o assunto da última mensagem/,
  "e precisa dizer POR QUE isso importa");
assert.match(capt.user, /o que depende de terceiro \(um resultado, uma decisão,\s*\n?\s*uma pessoa da família\)/,
  "fio que depende de terceiro (o juiz do leilão, o pai) precisa contar como assunto em aberto");
assert.match(capt.user, /Vale também o que não é\s*\n?\s*venda: uma visita combinada, um favor, um assunto pessoal/,
  "assunto que não é venda (a visita do pai) também é fio em aberto — era o que mais faltava");

// ══ 2. E PRECISA ESCOLHER ENTRE ELES, COM MOTIVO ═══════════════════════════════════════════
assert.match(capt.user, /ESCOLHA, ENTRE OS FIOS DE "ondeParou", POR QUAL SE REABRE — e diga por quê/,
  "a condução precisa escolher o fio, não pegar o último por inércia");
assert.match(capt.user, /Nem sempre é o\s*\n?\s*assunto da última mensagem, e quase nunca é reoferecer material/,
  "reoferecer o material já mandado é justamente o que ele reclamou");
assert.match(capt.user, /a bola está com\s*\n?\s*o OUTRO LADO[\s\S]{0,220}quase sempre reabre melhor/,
  "o fio onde a bola está com o cliente reabre melhor — é o caso do leilão esperando o juiz");

// ══ 3. TRATAMENTO: AS DUAS VOZES CHEGAM ════════════════════════════════════════════════════
// A voz DELE já ia. Faltava como o CLIENTE fala com ele — registro é coisa de dois.
assert.match(capt.system, /=== COMO ESTA PESSOA FALA COM ELE \(mensagens reais do contato NESTA conversa\) ===/,
  "as mensagens do contato precisam chegar no pedido");
for (const doCliente of ["kambio. bom dia mano", "Buenas mano!", "buenas... tranquilo"]) {
  assert.ok(capt.system.includes(doCliente),
    `o jeito do contato ("${doCliente}") precisa chegar — é metade do tratamento`);
}
for (const doCorretor of ["blzzz. valeu mano, abss", "buenas mano, como vai? foi arrematado, quanto?"]) {
  assert.ok(capt.system.includes(doCorretor), `e o jeito dele ("${doCorretor}") continua chegando`);
}
assert.match(capt.system, /TRATAMENTO — REGRA DURA: use com esta pessoa o MESMO tratamento que os dois já usam entre si/,
  "e a regra do tratamento precisa estar escrita");
assert.match(capt.system, /não com abertura de atendimento comercial \("Bom dia Fulano, tudo certo\?"\)/,
  "com o exemplo exato do que saiu errado no print dele");

// ══ 4. O HISTÓRICO CONTINUA INTEIRO ════════════════════════════════════════════════════════
// "o sistema deve ler sempre todo historico do cliente" (dono). Chegou a existir um filtro por ano
// aqui; foi desfeito no mesmo dia. Este assert existe pra ele não voltar por engano.
assert.equal(r.conversaLidaPelaIA.mensagensEnviadas, timeline.length,
  "todas as mensagens do cliente chegam na IA, de qualquer ano");
const conversa = capt.user.slice(capt.user.indexOf("CONVERSA COMPLETA:"));
assert.ok(conversa.includes("310 tava no anuncio"), "mensagem de 2023 continua indo");
assert.doesNotMatch(pipeline, /DIRECIONA_ANO_ANALISE|MIN_MSGS_ANO/,
  "não pode existir filtro por ano: o sistema lê sempre todo o histórico do cliente");

// ══ 5. A INSTRUÇÃO DA VOZ APONTA PRO LUGAR CERTO ═══════════════════════════════════════════
// Dizia "as mensagens reais dele que você recebeu ACIMA" — e o bloco vem ABAIXO dela. Instrução
// que manda procurar no vazio não vale nada, e o modelo cai no registro genérico.
assert.doesNotMatch(capt.system, /que você\s*\n?recebeu acima/,
  'a instrução não pode mandar procurar "acima" o que está abaixo');
assert.match(capt.system, /recebe logo abaixo, no bloco "COMO ESTE CORRETOR ESCREVE"/,
  "ela precisa apontar pro bloco certo, pelo nome");
assert.ok(capt.system.indexOf("ESCREVA COMO ESTE CORRETOR ESCREVE") < capt.system.indexOf("=== COMO ESTE CORRETOR ESCREVE"),
  "sanidade: a instrução realmente vem antes dos exemplos");

console.log("v1243-contexto-e-formulacao: ok");
