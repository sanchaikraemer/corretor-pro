import fs from "node:fs";
import assert from "node:assert/strict";
// v1337 — o fuso do app saiu de 35 literais "America/Sao_Paulo" e virou cpFuso(). Este import
// entrega as funções REAIS de fuso do app.js pros trechos que este teste roda com eval.
import "./_fuso-do-app.mjs";

// v1049 — o dono aceitou a sugestão feita ao entregar a v1048 ("Descanso após atender"
// configurável no Cérebro): unificar a tela "Atendidos recentemente" e a bolinha de "cliente
// aguardando você" (protegidoPosAtendimento) pra usar o MESMO número escolhido no Cérebro, em vez
// do prazo fixo de 5 dias que elas ainda tinham (PRAZO_PROTECAO_ATENDIDO). Sem isso, um corretor
// que configurasse 10 dias de descanso continuaria vendo essas duas telas liberarem o lead no
// 6º dia — a MESMA classe de inconsistência (duas contas diferentes pro mesmo conceito) que já
// causou vários bugs reais em versões anteriores (v1017/v1022).

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// A constante fixa antiga não pode mais existir em lugar nenhum.
assert.doesNotMatch(app, /PRAZO_PROTECAO_ATENDIDO/, "PRAZO_PROTECAO_ATENDIDO não pode mais existir — protegidoPosAtendimento usa o valor configurável");

// protegidoPosAtendimento precisa usar a mesma fonte que limiarRetomada/emJanelaDeEspera (v1048).
assert.match(app, /function protegidoPosAtendimento\(l\)\{[\s\S]*?cpDiasDescansoPosAtendimento\(\)[\s\S]*?\n\}/,
  "protegidoPosAtendimento precisa usar cpDiasDescansoPosAtendimento (mesmo valor configurável do Cérebro)");

// O texto do grupo "Atendidos recentemente" também reflete o valor configurado, não um número cravado.
assert.match(app, /"tratado-hoje":\s*\{ titulo: "Atendidos recentemente", sub: `Leads que você já atendeu nos últimos \$\{cpDiasDescansoPosAtendimento\(\)\} dias/,
  "o texto do grupo Atendidos recentemente precisa usar o valor configurável, não um número fixo");

// --- comportamento real: protegidoPosAtendimento respeita o valor configurado no Cérebro -------
const diasCalSrc = app.match(/function diasCalendarioBR\(quando\)\{[\s\S]*?\n\}/)[0];
const tiposSrc = app.match(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/)[0];
const ultAtSrc = app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/)[0];
const diasDescansoSrc = app.match(/function cpDiasDescansoPosAtendimento\(\)\{[\s\S]*?\n\}/)[0];
const protegidoSrc = app.match(/function protegidoPosAtendimento\(l\)\{[\s\S]*?\n\}/)[0];

function montarProtegidoPosAtendimento(diasConfigurados) {
  return eval(`
    const obterCerebroConfigParaAnalise = () => (${diasConfigurados == null ? "null" : `{ diasDescansoPosAtendimento: ${diasConfigurados} }`});
    ${diasCalSrc}
    ${tiposSrc}
    ${ultAtSrc}
    ${diasDescansoSrc}
    ${protegidoSrc}
    protegidoPosAtendimento
  `);
}

const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();
const leadAtendidoHa7Dias = () => ({ lastAttendanceAt: diasAtras(7), analysis: {} });

// Sem Cérebro configurado: padrão 5 dias — 7 dias já passou, não protege mais.
assert.equal(montarProtegidoPosAtendimento(null)(leadAtendidoHa7Dias()), false,
  "sem config, padrão de 5 dias — atendido há 7 dias já não protege mais");

// Corretor escolheu 10 dias: atendido há 7 dias AINDA protege (mesmo comportamento que
// limiarRetomada/emJanelaDeEspera já têm desde a v1048 — as duas concordam agora).
assert.equal(montarProtegidoPosAtendimento(10)(leadAtendidoHa7Dias()), true,
  "com 10 dias configurados, atendido há 7 dias continua protegido");

console.log("v1049-protecao-pos-atendimento-usa-descanso-configurado: ok");
