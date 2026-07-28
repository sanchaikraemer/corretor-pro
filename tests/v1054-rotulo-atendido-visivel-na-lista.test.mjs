import fs from "node:fs";
import assert from "node:assert/strict";

// v1054 — depois da v1053 (o número da lista "Fazer agora" sempre mostra o atendimento quando
// ele existe), o dono continuou vendo "há 5d" na Karine mesmo depois de dizer que a tinha
// atendido no app. A única explicação, olhando a lógica: o app não está encontrando NENHUM
// atendimento registrado pra ela — daí o número cair pro fallback (última mensagem). Mas essa
// diferença ("é atendimento" vs "é só mensagem, nunca atendido") só existia no title (invisível
// no celular, sem hover) — o dono não tinha como notar isso olhando só a lista.
//
// Agora a diferença aparece no próprio texto visível: "atendido há Xd" quando existe um
// atendimento reconhecido, ou só "há Xd" (sem a palavra "atendido") quando NÃO existe nenhum —
// dá pra saber pela lista, sem abrir cada lead, se o app considera aquele lead "atendido" ou não.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const rowSrc = app.match(/function cpHomeLeadRow\(l, ?maxMsgs\)\{[\s\S]*?\n\}/)[0];
assert.match(rowSrc, /diasRotulo = diasEhAtendimento \? "atendido há" : "há"/, "o rótulo visível precisa diferenciar atendimento de mensagem");
assert.match(rowSrc, /\$\{diasRotulo\} \$\{escapeHtml\(dias\)\}/, "o texto exibido usa o rótulo dinâmico, não mais 'há' fixo");

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

// Lead COM atendimento reconhecido: mostra "atendido há Xd".
const comAtendimento = {
  daysSinceLastInteraction: 2,
  analysis: { aprendizado: { eventos: [
    { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: diasAtras(3) }
  ] } }
};
assert.match(cpHomeLeadRow(comAtendimento, 100), />atendido há 3d</, "com atendimento reconhecido, o texto visível diz 'atendido há'");

// Lead SEM nenhum atendimento reconhecido (só mensagem): mostra "há Xd", sem a palavra "atendido"
// — é exatamente esse caso que revela, direto na lista, que o app nunca registrou atendimento
// pra esse lead (caso real "Karine": ela aparecia com "há 5d" e a explicação era essa).
const semAtendimento = { daysSinceLastInteraction: 5, analysis: {} };
const htmlSem = cpHomeLeadRow(semAtendimento, 100);
assert.match(htmlSem, />há 5d</, "sem atendimento reconhecido, o texto visível é só 'há', sem a palavra 'atendido'");
assert.doesNotMatch(htmlSem, /atendido há/, "a palavra 'atendido' não pode aparecer quando o app não reconhece nenhum atendimento pra esse lead");

console.log("v1054-rotulo-atendido-visivel-na-lista: ok");
