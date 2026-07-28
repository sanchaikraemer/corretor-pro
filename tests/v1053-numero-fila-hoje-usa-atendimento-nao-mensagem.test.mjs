import fs from "node:fs";
import assert from "node:assert/strict";

// v1053 — caso real "Karine": a v1052 fez a regra de descanso (emJanelaDeEspera) contar
// exclusivamente do último atendimento marcado, ignorando mensagem. Mas o NÚMERO mostrado na
// linha da lista "Fazer agora" (cpHomeLeadRow) ainda usava a data mais recente entre atendimento
// e mensagem — então em casos como o da Karine (atendimento de 10+ dias, mensagem de 5 dias), a
// tela mostrava "há 5d" enquanto a regra de verdade contava do atendimento (10+ dias, já fora do
// prazo) — dando a impressão de que a regra dos 7 dias configurados estava sendo ignorada, quando
// na real só o NÚMERO exibido é que não batia com o que a regra usa. Pedido do dono: "mude esse
// número para último atendimento (e não última mensagem trocada)".
//
// Agora, sempre que existe atendimento marcado, o número mostrado é dele — nunca mais da
// mensagem, mesmo quando a mensagem for mais recente. Sem NENHUM atendimento registrado, mostra a
// última interação (única data que existe nesse caso).

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const rowSrc = app.match(/function cpHomeLeadRow\(l, ?maxMsgs\)\{[\s\S]*?\n\}/)[0];
assert.doesNotMatch(rowSrc, /diasAt < diasNum/, "o número não pode mais escolher a data mais recente entre atendimento e mensagem — atendimento sempre vence quando existe");

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

// Caso "Karine": atendimento marcado há 10 dias, mas a última interação (mensagem) foi há só 5
// dias — a tela precisa mostrar "há 10d" (o atendimento), não "há 5d" (a mensagem), pra bater com
// a regra de descanso real (que só olha o atendimento desde a v1052).
const karine = {
  daysSinceLastInteraction: 5,
  analysis: { aprendizado: { eventos: [
    { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: diasAtras(10) }
  ] } }
};
const htmlKarine = cpHomeLeadRow(karine, 100);
assert.match(htmlKarine, />há 10d</, "o número mostrado precisa ser o do atendimento (10 dias), não o da última mensagem (5 dias)");
assert.match(htmlKarine, /desde o último atendimento marcado/, "o title explica que o número é do atendimento, mesmo a mensagem sendo mais recente");
assert.doesNotMatch(htmlKarine, />há 5d</, "o número da última mensagem não pode mais aparecer quando existe atendimento marcado");

// Lead com atendimento MUITO antigo (fora do prazo) e mensagem recente: mesmo assim mostra a data
// do atendimento — o número precisa sempre bater com o que rege a regra de descanso.
const atendimentoAntigoMsgNova = {
  daysSinceLastInteraction: 1,
  analysis: { aprendizado: { eventos: [
    { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: diasAtras(40) }
  ] } }
};
const htmlAntigo = cpHomeLeadRow(atendimentoAntigoMsgNova, 100);
assert.match(htmlAntigo, />há 40d</, "mesmo com mensagem de ontem, o número mostrado continua sendo o do atendimento (40 dias)");

// Sem NENHUM atendimento marcado: continua mostrando a última interação normalmente (única data
// que existe nesse caso).
const semAtendimento = { daysSinceLastInteraction: 12, analysis: {} };
const htmlSemAtendimento = cpHomeLeadRow(semAtendimento, 100);
assert.match(htmlSemAtendimento, />há 12d</, "sem atendimento marcado, mostra a última interação normalmente (comportamento de antes)");
assert.match(htmlSemAtendimento, /desde a última interação \(sua ou do cliente\)/, "title genérico continua igual quando não há atendimento nenhum");

console.log("v1053-numero-fila-hoje-usa-atendimento-nao-mensagem: ok");
