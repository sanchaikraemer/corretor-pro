import fs from "node:fs";
import assert from "node:assert/strict";

// v1056 — o pedido ORIGINAL desta rodada inteira de conversas (a primeiríssima mensagem, sobre o
// print com "Fernando Evo...", "Dra. Diene Faht...", 141 dias parada, barra de mensagens em 0,
// disputando posição com leads realmente quentes): "não quero número de posição... estando ali
// os 10, ou 15, ou quantos definidos lá no cérebro, já está ok" — o dono aceitou tirar só o
// número de posição naquele momento, e eu deixei explícito que o CRITÉRIO de quem entra e a
// ORDEM continuavam os mesmos, oferecendo consertar depois se ele quisesse. Só depois de um
// caminho longo (v1048–v1055, todos sobre o "descanso pós-atendimento") ele voltou a apontar pro
// problema original ("vc não vai resolver nunca né? o que eu falei sobre isso?").
//
// v1057 — a v1056 original usava a última MENSAGEM (daysSinceLastTouch) como base da penalidade
// de tempo parado. O dono cortou isso na hora: "eu já disse que não interessa a contagem de
// última mensagem, somente de último atendimento, ponto final". E foi além, resolvendo a tensão
// que isso criava (lead nunca atendido não tem atendimento pra medir): "na lista de prioridades
// só pode aparecer clientes que já foram atendidos... quem não tem atendimento tem que ir lá nas
// oportunidades esquecidas". Ou seja: desde a v1057, SÓ entra em "Fazer agora" quem já tem
// atendimento marcado (ver tests/v1057-so-atendidos-entram-prioridade.test.mjs) — então a
// penalidade de tempo parado pode (e deve) usar SÓ o último atendimento, sem essa tensão: todo
// lead que chega até aqui tem uma data de atendimento de verdade pra medir.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const fn = app.match(/function cpProbabilidadeFechamento\(l\)\{[\s\S]*?\n\}/)[0];
assert.match(fn, /diasFrio/, "cpProbabilidadeFechamento precisa descontar uma penalidade por tempo parado");
assert.match(fn, /Math\.min\(diasFrio, 90\)/, "a penalidade tem teto de 90 dias — não cresce pra sempre");
// Isola só o trecho da penalidade (de "diasFrio = 90" até o fim da função) — o resto da função
// ainda usa daysSinceClientReply/daysSinceLastTouch legitimamente, pro bônus "cliente espera
// você" (travado pelo teste v944), que é OUTRO fator, não a penalidade de tempo parado.
const trechoPenalidade = fn.slice(fn.indexOf("let diasFrio = 90;"));
assert.doesNotMatch(trechoPenalidade, /daysSinceLastTouch|daysSinceLastInteraction|daysSinceClientReply/,
  "v1057: a penalidade não pode mais usar NENHUM campo de mensagem — só o último atendimento (ultimoAtendimentoTs)");
assert.match(trechoPenalidade, /ultimoAtendimentoTs\(l\)/, "a penalidade precisa vir de ultimoAtendimentoTs");

const diasCalSrc = app.match(/function diasCalendarioBR\(quando\)\{[\s\S]*?\n\}/)[0];
const ultAtSrc = app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/)[0];
const tiposSrc = app.match(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/)[0];

const cpProbabilidadeFechamento = eval(`
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  const contextoPrioridadeIA = (l) => ({});
  const ultimaMsgClientePedeResposta = () => false;
  ${tiposSrc}
  ${diasCalSrc}
  ${ultAtSrc}
  ${fn}
  cpProbabilidadeFechamento;
`);

const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();
const atendidoHa = (dias) => ({ analysis: { aprendizado: { eventos: [
  { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: diasAtras(dias) }
] } } });

// Dois leads com engajamento parecido, mas atendimentos em datas diferentes: o mais recente
// precisa pontuar mais.
const atendidoAntigo = { __msgs: 3, clientMessageDays: 1, clientQuestionCount: 0, ...atendidoHa(90) };
const atendidoRecente = { __msgs: 3, clientMessageDays: 1, clientQuestionCount: 0, ...atendidoHa(2) };
assert.ok(cpProbabilidadeFechamento(atendidoRecente) > cpProbabilidadeFechamento(atendidoAntigo),
  "com engajamento parecido, o lead atendido há 2 dias precisa pontuar mais que o atendido há 90 dias");

// A penalidade tem teto: atendido há 200 dias não pode pontuar pior que atendido há 90 (não
// afunda pra sempre, só até um limite razoável).
const muitoAntigo = { __msgs: 3, ...atendidoHa(200) };
const noTeto = { __msgs: 3, ...atendidoHa(90) };
assert.equal(cpProbabilidadeFechamento(muitoAntigo), cpProbabilidadeFechamento(noTeto),
  "a penalidade não cresce além do teto de 90 dias");

// Sem NENHUM atendimento (não deveria acontecer na prática, já que v1057 barra isso na entrada
// da fila) — cai no teto máximo (90), tratado como o caso mais frio possível.
const semAtendimento = { __msgs: 3 };
assert.equal(cpProbabilidadeFechamento(semAtendimento), cpProbabilidadeFechamento(muitoAntigo),
  "sem nenhum atendimento, a penalidade cai no teto máximo (mesmo caso de atendido há 90+ dias)");

// Sinal de negociação real ainda pode superar um pouco de tempo parado (a junção de fatores
// continua valendo — isso não vira um critério só de "tempo parado", vira mais um fator).
const negociacaoReal = eval(`
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  const contextoPrioridadeIA = (l) => ({ propostaAtiva: true, retornoProposta: true });
  const ultimaMsgClientePedeResposta = () => false;
  ${tiposSrc}
  ${diasCalSrc}
  ${ultAtSrc}
  ${fn}
  cpProbabilidadeFechamento({ __msgs: 12, clientMessageDays: 6, clientQuestionCount: 4, ...(${JSON.stringify(atendidoHa(10))}) });
`);
const semNegociacaoFrio = cpProbabilidadeFechamento({ __msgs: 6, clientMessageDays: 1, ...atendidoHa(60) });
assert.ok(negociacaoReal > semNegociacaoFrio,
  "negociação avançada real (proposta discutida) ainda pesa mais que um pouco de tempo parado sozinho");

console.log("v1056-tempo-parado-pesa-contra-posicao-na-fila: ok");
