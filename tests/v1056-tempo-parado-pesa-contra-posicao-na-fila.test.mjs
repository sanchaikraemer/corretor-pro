import fs from "node:fs";
import assert from "node:assert/strict";

// v1056 — o pedido ORIGINAL desta rodada inteira de conversas (a primeiríssima mensagem, sobre o
// print com "Fernando Evo...", "Dra. Diene Faht...", 141 dias parada, barra de mensagens em 0,
// disputando posição com leads realmente quentes): "não quero número de posição... estando ali
// os 10, ou 15, ou quantos definidos lá no cérebro, já está ok" — o dono aceitou tirar só o
// número de posição naquele momento, e eu deixei explícito que o CRITÉRIO de quem entra e a
// ORDEM continuavam os mesmos, oferecendo consertar depois se ele quisesse. Só depois de um
// caminho longo (v1048–v1055, todos sobre o "descanso pós-atendimento") ele voltou a apontar pro
// problema original: leads com "há 141d"/"há 46d" — sem engajamento recente nenhum — continuando
// a disputar espaço com leads realmente ativos ("vc não vai resolver nunca né? o que eu falei
// sobre isso?").
//
// Esta é a correção que eu tinha proposto lá no início e nunca tinha sido implementada:
// cpProbabilidadeFechamento (a nota que ordena a fila "Fazer agora") passa a descontar uma
// penalidade proporcional ao tempo parado (o toque mais recente entre mensagem e atendimento,
// até um teto de 90 dias) — um lead frio de verdade cai pra trás de quem está ativo, SEM sumir
// da lista (o critério de quem ENTRA continua o mesmo, só a ORDEM muda).

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const fn = app.match(/function cpProbabilidadeFechamento\(l\)\{[\s\S]*?\n\}/)[0];
assert.match(fn, /diasFrio/, "cpProbabilidadeFechamento precisa descontar uma penalidade por tempo parado");
assert.match(fn, /Math\.min\(diasFrio, 90\)/, "a penalidade tem teto de 90 dias — não cresce pra sempre");
assert.doesNotMatch(fn, /daysSinceClientReply.*diasFrio|diasFrio.*daysSinceClientReply/,
  "a penalidade não pode reusar daysSinceClientReply (já tem outro significado no bônus 'cliente espera você' logo acima — travado pelo teste v944)");

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

// Caso "Dra. Diene": engajamento histórico baixo (poucas mensagens no total), 141 dias sem
// nenhum toque — igual ao print real que motivou toda essa conversa.
const draDiene = { __msgs: 3, clientMessageDays: 1, clientQuestionCount: 0, daysSinceLastTouch: 141 };

// Lead realmente ativo: engajamento parecido, mas tocado há poucos dias.
const leadAtivo = { __msgs: 3, clientMessageDays: 1, clientQuestionCount: 0, daysSinceLastTouch: 2 };

assert.ok(cpProbabilidadeFechamento(leadAtivo) > cpProbabilidadeFechamento(draDiene),
  "com engajamento parecido, o lead tocado há 2 dias precisa pontuar mais que o parado há 141 dias");

// A penalidade tem teto: parado há 200 dias não pode pontuar pior que parado há 90 (não afunda
// pra sempre, só até um limite razoável).
const muitoParado = { __msgs: 3, daysSinceLastTouch: 200 };
const noTeto = { __msgs: 3, daysSinceLastTouch: 90 };
assert.equal(cpProbabilidadeFechamento(muitoParado), cpProbabilidadeFechamento(noTeto),
  "a penalidade não cresce além do teto de 90 dias");

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
  cpProbabilidadeFechamento({ __msgs: 12, clientMessageDays: 6, clientQuestionCount: 4, daysSinceLastTouch: 10 });
`);
const semNegociacaoFrio = cpProbabilidadeFechamento({ __msgs: 6, clientMessageDays: 1, daysSinceLastTouch: 60 });
assert.ok(negociacaoReal > semNegociacaoFrio,
  "negociação avançada real (proposta discutida) ainda pesa mais que um pouco de tempo parado sozinho");

console.log("v1056-tempo-parado-pesa-contra-posicao-na-fila: ok");
