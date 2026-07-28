import fs from "node:fs";
import assert from "node:assert/strict";

// v1055 (2ª parte) — a v1054 tinha feito o texto visível da lista "Fazer agora" diferenciar
// "atendido há Xd" (existe atendimento reconhecido) de "há Xd" (só mensagem, nunca atendido).
// O dono reclamou da inconsistência visual: "tenque ficar tudo padrão" — queria o mesmo texto
// pra todo mundo. O rótulo volta a ser sempre "há Xd", igual antes da v1054 — mas o NÚMERO
// continua vindo do atendimento quando ele existe (regra da v1053, que resolveu o problema
// original de verdade e continua valendo). Só o texto que virou uniforme de novo.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const rowSrc = app.match(/function cpHomeLeadRow\(l, ?maxMsgs\)\{[\s\S]*?\n\}/)[0];
assert.match(rowSrc, /const diasRotulo = "há";/, "o rótulo visível precisa ser sempre 'há', igual pra todo mundo");
assert.doesNotMatch(rowSrc, /diasEhAtendimento \? "atendido há"/, "a distinção 'atendido há' vs 'há' não pode mais existir no texto visível");

const diasCalSrc = app.match(/function diasCalendarioBR\(quando\)\{[\s\S]*?\n\}/)[0];
const ultAtSrc = app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/)[0];
const tiposSrc = app.match(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/)[0];

const cpHomeLeadRow = eval(`
  const mensagensDoClienteRecente = (l) => Number(l.__msgs||0);
  const escapeHtml = (s) => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const produtosLabel = (l) => l.product || '';
  const produtosLabelCurto = (l) => l.product || '';
  const prioridadeAtendimento = (l) => ({ nivel: l.__nivel||0 });
  const cpBarraMensagensMini = (l, maxMsgs) => '<span class="chr-bar"></span>';
  ${tiposSrc}
  ${diasCalSrc}
  ${ultAtSrc}
  ${rowSrc}
  cpHomeLeadRow;
`);

const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();

// Lead COM atendimento reconhecido: texto é "há Xd" (sem a palavra "atendido"), mas o NÚMERO
// continua vindo do atendimento (v1053, intacta).
const comAtendimento = {
  daysSinceLastInteraction: 2,
  analysis: { aprendizado: { eventos: [
    { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: diasAtras(11) }
  ] } }
};
const htmlCom = cpHomeLeadRow(comAtendimento, 100);
assert.match(htmlCom, />há 11d</, "com atendimento reconhecido, o número é do atendimento (11 dias), com o rótulo padrão 'há'");
assert.doesNotMatch(htmlCom, /atendido há/, "a palavra 'atendido' não aparece mais no texto visível");
assert.match(htmlCom, /desde o último atendimento marcado/, "o title (invisível, passar o mouse) continua explicando que é do atendimento");

// Lead SEM nenhum atendimento reconhecido: texto também é só "há Xd" — visualmente idêntico ao
// caso acima, exatamente como o dono pediu ("tudo padrão").
const semAtendimento = { daysSinceLastInteraction: 46, analysis: {} };
const htmlSem = cpHomeLeadRow(semAtendimento, 100);
assert.match(htmlSem, />há 46d</, "sem atendimento, o rótulo é o mesmo 'há', igual ao lead atendido");

console.log("v1055-2-rotulo-padrao-sempre-ha: ok");
