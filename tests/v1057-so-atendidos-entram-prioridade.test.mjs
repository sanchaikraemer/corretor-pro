import fs from "node:fs";
import assert from "node:assert/strict";

// v1057 — pedido taxativo e definitivo do dono, resolvendo a rodada inteira sobre "Fazer agora"
// vs. mensagem vs. atendimento: "na lista de prioridades só pode aparecer clientes que já foram
// atendidos e que respeita o tempo descrito no cérebro... quem não tem atendimento tem que ir lá
// nas oportunidades esquecidas... atendidos respeita o tempo de descanso dele do último
// atendimento e cai na prioridade. Quem não tem atendimento tem que ir lá nas oportunidades
// esquecidas e essa sim vai classificar pelo prazo mais antigo".
//
// Duas partes:
// 1) cpFilaFazerAgora ("Fazer agora") passa a exigir que o lead JÁ tenha sido atendido pelo menos
//    uma vez (ultimoAtendimentoTs > 0) — sem atendimento nenhum, nunca entra aqui, não importa
//    quantas mensagens tenha ou há quanto tempo.
// 2) leadsEsquecidos ("Oportunidades esquecidas") já aceitava lead sem atendimento (só precisa de
//    "investimento": atendimento manual OU 5+ mensagens do cliente) e já ordenava pelo mais
//    parado primeiro — não precisou mudar nada ali, só confirmar que continua assim.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const filaSrc = app.match(/function cpFilaFazerAgora\(items\)\{[\s\S]*?\n\}/)[0];
assert.match(filaSrc, /ultimoAtendimentoTs\(l\)/, "cpFilaFazerAgora precisa exigir atendimento marcado (ultimoAtendimentoTs)");

const esquecidosSrc = app.match(/function leadsEsquecidos\(items\)\{[\s\S]*?\n\}/)[0];
assert.match(esquecidosSrc, /temAtendimentoManual\(l\) \|\| mensagensDoCliente\(l\) >= CP_MIN_MSGS_PRIORIDADE/,
  "leadsEsquecidos continua aceitando lead sem atendimento (só precisa de investimento real)");
assert.match(esquecidosSrc, /out\.sort\(\(a,b\) => b\.parado - a\.parado\)/,
  "leadsEsquecidos continua ordenando pelo mais parado primeiro (prazo mais antigo)");

// --- comportamento real: lead sem atendimento nenhum NUNCA entra em Fazer agora -----------------
const diasCalSrc = app.match(/function diasCalendarioBR\(quando\)\{[\s\S]*?\n\}/)[0];
const ultAtSrc = app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/)[0];
const tiposSrc = app.match(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/)[0];
const fdsSrc = app.match(/function cpFimDeSemana\(\)\{[\s\S]*?\n\}/)[0];
const notaSrc = app.match(/function cpProbabilidadeFechamento\(l\)\{[\s\S]*?\n\}/)[0];

const cpFilaFazerAgora = eval(`
  const leadEhAtivo = () => true;
  const ehContatadoHoje = (l) => !!l.__hoje;
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  const cp786TemCompromisso = () => false;
  const emJanelaDeEspera = () => false;
  const contextoPrioridadeIA = () => ({});
  const ultimaMsgClientePedeResposta = () => false;
  const analiseAtualValida752 = () => false;
  ${tiposSrc}
  ${diasCalSrc}
  ${ultAtSrc}
  ${fdsSrc}
  ${notaSrc}
  ${filaSrc}
  cpFilaFazerAgora;
`);

const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();
const semAtendimento = { id: "nunca-atendido", __msgs: 50 }; // muitas mensagens, mas nunca atendido
const comAtendimento = { id: "ja-atendido", __msgs: 3, analysis: { aprendizado: { eventos: [
  { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: diasAtras(20) }
] } } };

const resultado = cpFilaFazerAgora([semAtendimento, comAtendimento]).map(l => l.id);
assert.ok(!resultado.includes("nunca-atendido"), "lead que nunca foi atendido não pode aparecer em Fazer agora, mesmo com muitas mensagens");
assert.ok(resultado.includes("ja-atendido"), "lead já atendido (fora do prazo de descanso) continua aparecendo normalmente");

console.log("v1057-so-atendidos-entram-prioridade: ok");
