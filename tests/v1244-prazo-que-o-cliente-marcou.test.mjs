// v1244 — O PRAZO QUE O PRÓPRIO CLIENTE MARCOU.
//
// CASO REAL (print + conversa colada pelo dono em 13/08/2026, contato "Thume Leilao"):
//   03/08/2026 (segunda) — o CLIENTE: "Buenas mano! sim... dei uma olhada... vamos falar sobre o
//                          assunto na semana que vem"
//   03/08/2026           — o corretor: "Combinado"
//   13/08/2026           — o dono manda reanalisar.
//
// "Semana que vem" dito numa segunda-feira é 10/08 a 16/08. Dia 13 está DENTRO. Mesmo assim a tela
// dizia que o prazo padrão de retomada tinha sido ultrapassado, e as três sugestões saíram com cara
// de cobrança: "Passou a semana que tínhamos comentado...". Ou seja: o app cobrava atraso de quem
// estava em dia, e ainda reoferecia planta/simulação de um material que o cliente JÁ tinha dito que
// olhou. Ele: "veja q bosta de sugestoes, nada a ver com o contexto".
//
// A causa era o prazo genérico do Cérebro ("X dias sem interação") atropelando o combinado
// explícito entre os dois. Agora a conta é feita NO CÓDIGO (calendário é onde a IA erra) e entra no
// pedido como fato. Três cuidados que impedem o remédio de virar doença nova, todos cobrados aqui:
//   1. só vale o que o CLIENTE marcou (promessa do corretor não é combinado do cliente);
//   2. depois do marco, só confirmação curta ("Combinado", "blz") mantém a janela viva — assunto
//      novo significa que a conversa andou e aquele "semana que vem" não manda mais;
//   3. marco de mais de 180 dias não governa negociação de hoje.
import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain, calcularMarcoTemporalExplicitoCliente } from "../api/_pipeline.js";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const HOJE = new Date("2026-08-13T15:00:00.000Z");   // quinta, dentro da janela 10–16/08
const lead = { clientName: "Thume Leilao" };
const cerebro = { corretorNome: "Sanchai", metodo: "M", tom: "T", diferenciais: "", evitar: "", regras: [], objecoes: [] };

const msg = (date, iso, author, text) => ({ date, time: "12:00", iso, author, text });
const CONVERSA = [
  msg("29/07/2026", "2026-07-29T12:16:00.000Z", "Sanchai", "buenas mano, como vai? foi arrematado, quanto?"),
  msg("29/07/2026", "2026-07-29T12:21:00.000Z", "Thume Leilao", "bom dia. tudo bem mano? foi juntada proposta... vamos ver se vai homologar"),
  msg("03/08/2026", "2026-08-03T17:21:00.000Z", "Thume Leilao", "Buenas mano! sim... dei uma olhada... vamos falar sobre o assunto na semana que vem"),
  msg("03/08/2026", "2026-08-03T17:32:00.000Z", "Sanchai", "Combinado")
];

// ══ 1. A CONTA DO CALENDÁRIO ═══════════════════════════════════════════════════════════════════
const marco = calcularMarcoTemporalExplicitoCliente(CONVERSA, lead, "Sanchai", HOJE);
assert.equal(marco.encontrado, true, 'o "semana que vem" dito pelo cliente precisa ser reconhecido');
assert.equal(marco.inicio, "10/08/2026", '"semana que vem" dito numa segunda começa na segunda seguinte');
assert.equal(marco.fim, "16/08/2026", "e termina no domingo daquela semana");
assert.equal(marco.status, "dentro_da_janela", "dia 13 está DENTRO do combinado — não há atraso nenhum");

// Antes da janela: dia 05/08 ainda não chegou a semana combinada.
assert.equal(calcularMarcoTemporalExplicitoCliente(CONVERSA, lead, "Sanchai", new Date("2026-08-05T12:00:00.000Z")).status,
  "antes_da_janela", "antes de 10/08 o combinado ainda é pra frente");
// Depois: dia 20/08 aí sim o combinado passou.
assert.equal(calcularMarcoTemporalExplicitoCliente(CONVERSA, lead, "Sanchai", new Date("2026-08-20T12:00:00.000Z")).status,
  "janela_encerrada", "depois de 16/08 aí sim é factual dizer que o período combinado passou");

// ══ 2. SÓ O QUE O CLIENTE MARCOU CONTA ═════════════════════════════════════════════════════════
// O corretor dizer "te chamo semana que vem" é promessa DELE, não combinado do cliente — não pode
// travar nem liberar nada, senão o sistema passa a obedecer a si mesmo.
const soCorretor = [msg("03/08/2026", "2026-08-03T17:21:00.000Z", "Sanchai", "beleza mano, te chamo na semana que vem")];
assert.equal(calcularMarcoTemporalExplicitoCliente(soCorretor, lead, "Sanchai", HOJE).encontrado, false,
  "prazo prometido pelo corretor não é prazo marcado pelo cliente");

// ══ 3. O MARCO MORRE QUANDO A CONVERSA ANDA ════════════════════════════════════════════════════
// "Combinado" mantém de pé; assunto novo depois disso encerra. Sem isto, um "semana que vem" de
// meses atrás voltaria a mandar na análise pra sempre.
const comAvanco = [...CONVERSA, msg("05/08/2026", "2026-08-05T12:00:00.000Z", "Thume Leilao", "e qual era o valor do metro quadrado mesmo?")];
assert.equal(calcularMarcoTemporalExplicitoCliente(comAvanco, lead, "Sanchai", HOJE).encontrado, false,
  "depois de um assunto novo, o marco anterior não governa mais");
const soConfirmacoes = [...CONVERSA, msg("04/08/2026", "2026-08-04T12:00:00.000Z", "Thume Leilao", "blz")];
assert.equal(calcularMarcoTemporalExplicitoCliente(soConfirmacoes, lead, "Sanchai", HOJE).status, "dentro_da_janela",
  'confirmação curta ("blz") não encerra o combinado');
// Marco velho não ressuscita.
const velho = [msg("03/01/2026", "2026-01-03T12:00:00.000Z", "Thume Leilao", "vamos falar na semana que vem")];
assert.equal(calcularMarcoTemporalExplicitoCliente(velho, lead, "Sanchai", HOJE).encontrado, false,
  "marco de mais de 180 dias não manda em negociação de hoje");

// ══ 4. O FATO CHEGA NO PEDIDO E A COBRANÇA DE ATRASO É REESCRITA ═══════════════════════════════
const capt = { chamadas: 0, prompts: [] };
const openai = { chat: { completions: { create: async (args) => {
  capt.chamadas += 1;
  const user = String(args?.messages?.find(m => m.role === "user")?.content || "");
  capt.prompts.push(user);
  if (capt.chamadas === 1) capt.user = user;
  // 1ª volta: a IA erra o tempo, como errou no print dele. 2ª volta (releitura): acerta.
  const mensagens = capt.chamadas === 1 ? {
    recomendada: "Bom dia Thume, tudo certo? Passou a semana que tínhamos comentado, quer ver a planta?",
    maisSuave: "Oi Thume! Como o prazo que combinamos já venceu, retomo com voce?",
    maisDireta: "Thume, o periodo combinado passou. Seguimos com a simulacao?"
  } : {
    recomendada: "Buenas mano! como a gente combinou de falar essa semana — o que tu achou daquilo?",
    maisSuave: "Buenas! passando aqui na semana que a gente marcou. e ai, o que achou?",
    maisDireta: "Mano, e aquele do leilao, homologou?"
  };
  return { model: "gpt-teste", choices: [{ message: { content: JSON.stringify({
    summary: "s",
    leituraDaConversa: {
      oQueOClienteQuer: "info do leilao",
      ondeParou: "03/08 ele disse que olhou e combinou falar na semana seguinte",
      oQueMudouNoTempo: "Passaram 10 dias e o prazo combinado ja venceu.",
      condicaoDoCliente: "Falar na semana que vem",
      comoConduzir: "O prazo combinado passou, entao retome cobrando o retorno dele."
    },
    recomendacaoContato: { aguardar: true, motivo: "esperar" },
    mensagens
  }) } }], usage: {} };
} } } };

const r = await analyzeWithBrain({ lead, timeline: CONVERSA, openai, cerebroConfig: cerebro, agora: HOJE });

// 4a) o fato calculado vai no pedido, escrito como ordem — não como sugestão.
assert.match(capt.user, /PRAZO QUE O PRÓPRIO CLIENTE MARCOU — ISTO MANDA NA LEITURA DO TEMPO/,
  "o prazo marcado pelo cliente precisa chegar no pedido");
assert.ok(capt.user.includes("10/08/2026 a 16/08/2026"), "com as datas já calculadas pelo código");
assert.match(capt.user, /DENTRO DO PRAZO COMBINADO\. NÃO existe atraso/,
  "e dizendo com todas as letras que não existe atraso");
assert.match(capt.user, /SOMENTE quando não houver acima um prazo marcado pelo próprio cliente/,
  "o prazo genérico do Cérebro não pode atropelar o combinado explícito");

// 4b) a cobrança de atraso não chega na tela: vira releitura obrigatória, mesmo sem clichê da lista.
assert.equal(capt.chamadas, 2, "mensagem que diz que o prazo venceu tem que forçar a releitura");
assert.ok(capt.prompts[1].includes("ERRO TEMPORAL"), "e a releitura precisa dizer QUAL é o erro");
for (const m of [r.messages.a, r.messages.b, r.messages.c]) {
  assert.doesNotMatch(m.toLowerCase(), /passou a semana|prazo.{0,20}(venceu|passou)|periodo combinado passou/,
    `nenhuma sugestão pode cobrar atraso de quem está em dia: "${m}"`);
}

// 4c) o painel "Como conduzir este atendimento" também não pode ficar dizendo que venceu.
assert.doesNotMatch(r.leituraDaConversa.oQueMudouNoTempo, /venceu|passou o prazo/i,
  "a leitura na tela não pode contradizer o combinado que ainda está aberto");
assert.ok(r.leituraDaConversa.oQueMudouNoTempo.includes("10/08/2026 a 16/08/2026"),
  "ela precisa mostrar a janela real do combinado");
assert.doesNotMatch(r.leituraDaConversa.comoConduzir, /prazo combinado passou/i,
  "e a condução também não");
// Combinar de FALAR não é condição pra COMPRAR.
assert.equal(r.leituraDaConversa.condicaoDoCliente, "Nenhuma",
  '"falar na semana que vem" é agenda, não condição de compra');

// 4d) o cartão "Fazer agora": dentro da janela é dia de falar, o lead não some da fila.
assert.equal(r.recomendacaoContato.aguardar, false,
  "dentro da janela combinada o contato não fica em espera");
assert.ok(r.marcoTemporalCliente?.encontrado, "o cálculo fica gravado junto da análise, pra conferir depois");

// ══ 5. ANTES DA JANELA, O CARTÃO SEGURA ════════════════════════════════════════════════════════
const capt2 = { n: 0 };
const openai2 = { chat: { completions: { create: async () => {
  capt2.n += 1;
  return { model: "gpt-teste", choices: [{ message: { content: JSON.stringify({
    summary: "s", recomendacaoContato: { aguardar: false, motivo: "" },
    mensagens: { recomendada: "Buenas mano, tudo certo por ai?", maisSuave: "Buenas mano!", maisDireta: "E ai mano, novidade?" }
  }) } }], usage: {} };
} } } };
const r2 = await analyzeWithBrain({ lead, timeline: CONVERSA, openai: openai2, cerebroConfig: cerebro, agora: new Date("2026-08-05T12:00:00.000Z") });
assert.equal(r2.recomendacaoContato.aguardar, true, "antes da janela combinada o certo é aguardar");
assert.ok(r2.recomendacaoContato.motivo.includes("10/08/2026"), "e o motivo diz a partir de quando");

// ══ 6. A VOZ DOS DOIS CONTINUA CHEGANDO, MESMO COM NOME DIFERENTE NO CÉREBRO ═══════════════════
// Se o dono salvou o nome comercial no Cérebro e o WhatsApp exporta o apelido, o lado do corretor
// saía VAZIO e a IA escrevia como vendedor genérico — que é a reclamação de origem. Numa conversa
// de dois, quem não é o contato é o corretor.
const capt3 = {};
const openai3 = { chat: { completions: { create: async (args) => {
  capt3.system = String(args?.messages?.find(m => m.role === "system")?.content || "");
  return { model: "gpt-teste", choices: [{ message: { content: JSON.stringify({ summary: "s", mensagens: {
    recomendada: "Buenas mano!", maisSuave: "Buenas!", maisDireta: "E ai mano?"
  } }) } }], usage: {} };
} } } };
await analyzeWithBrain({
  lead, timeline: CONVERSA, openai: openai3, agora: HOJE,
  cerebroConfig: { ...cerebro, corretorNome: "Imóveis Premium Sanchai Kraemer" }   // não bate com "Sanchai"
});
assert.ok(capt3.system.includes("buenas mano, como vai? foi arrematado, quanto?"),
  "a voz real do corretor precisa chegar mesmo quando o nome do Cérebro não bate com o do WhatsApp");
assert.ok(capt3.system.includes("bom dia. tudo bem mano? foi juntada proposta"),
  "e a voz do contato também");

// ══ 7. MATERIAL QUE ELE JÁ DISSE QUE OLHOU NÃO SE REOFERECE ════════════════════════════════════
assert.match(capt.user, /SE O CLIENTE JÁ DISSE QUE VIU\/OLHOU\/ANALISOU o que você mandou/,
  "reoferecer o que ele já viu é sinal de que ninguém leu o que ele escreveu");
assert.match(capt.user, /A condução ali é PERGUNTAR O QUE ELE ACHOU/,
  "a condução certa ali é perguntar o que ele achou");

// ══ 8. O HISTÓRICO CONTINUA INTEIRO ════════════════════════════════════════════════════════════
assert.equal(r.conversaLidaPelaIA.mensagensEnviadas, CONVERSA.length,
  "todas as mensagens continuam chegando na IA");
assert.doesNotMatch(pipeline, /DIRECIONA_ANO_ANALISE|MIN_MSGS_ANO/,
  "não pode existir filtro por ano: o sistema lê sempre todo o histórico do cliente");

console.log("v1244-prazo-que-o-cliente-marcou: ok");
