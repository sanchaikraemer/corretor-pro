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
// v1332 — O RÓTULO VOLTOU, E O MOTIVO É OUTRO. A v1055 tirou a palavra por gosto ("tenque ficar
// tudo padrão"), quando o número vinha SEMPRE do atendimento. Em 20/08/2026 o dono mandou o print
// do outro lado da moeda: cliente que tinha escrito pra ele às 17h55 aparecendo como "há 8d" (o
// atendimento de oito dias antes) e, ao mesmo tempo, no topo do "Fazer agora". Número velho ao
// lado de quem está esperando resposta agora faz despriorizar quem não pode esperar.
//
// Com o número passando a ser o do EVENTO MAIS RECENTE, o rótulo deixou de ser enfeite: sem ele,
// "há 5d" tanto pode ser mensagem quanto atendimento, e as duas reclamações voltam. O formato
// continua padrão pra todo mundo — o que muda é uma palavra que diz qual data é.
assert.match(rowSrc, /const diasRotulo = diasEhAtendimento/, "a linha precisa dizer QUAL data é o número que ela mostra");
assert.match(rowSrc, /"falou há"/, "mensagem do cliente aparece como 'falou há Xd'");
assert.match(rowSrc, /"atendido há"/, "atendimento marcado aparece como 'atendido há Xd'");

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

// Atendimento há 11 dias e mensagem há 2: o evento mais recente é a mensagem, e é ela que aparece
// — dizendo que é mensagem. (Antes da v1332 aparecia "há 11d", o número do atendimento.)
const mensagemMaisNova = {
  daysSinceLastInteraction: 2,
  analysis: { aprendizado: { eventos: [
    { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: diasAtras(11) }
  ] } }
};
const htmlMsg = cpHomeLeadRow(mensagemMaisNova, 100);
assert.match(htmlMsg, />falou há 2d</, "o que aconteceu por último foi a mensagem — é ela que a linha mostra");

// Nada aconteceu depois do atendimento: aí sim o número é o do atendimento, com o nome dele.
const soAtendimento = {
  daysSinceLastInteraction: 11,
  analysis: { aprendizado: { eventos: [
    { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: diasAtras(11) }
  ] } }
};
const htmlAt = cpHomeLeadRow(soAtendimento, 100);
assert.match(htmlAt, />atendido há 11d</, "com atendimento reconhecido e nada depois, o número é do atendimento");
assert.match(htmlAt, /desde o último atendimento marcado/, "o title continua explicando de onde vem o número");

// Sem nenhum atendimento reconhecido: o formato é o mesmo, com a palavra da mensagem.
const semAtendimento = { daysSinceLastInteraction: 46, analysis: {} };
assert.match(cpHomeLeadRow(semAtendimento, 100), />falou há 46d</, "mesmo formato pra todo mundo, mudando só a palavra que diz qual data é");

// E o caso do print de 20/08: cliente que escreveu hoje nunca mais aparece como parado.
const escreveuHoje = {
  daysSinceLastInteraction: 0,
  analysis: { aprendizado: { eventos: [
    { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: diasAtras(8) }
  ] } }
};
assert.match(cpHomeLeadRow(escreveuHoje, 100), />falou hoje</, "cliente que escreveu hoje aparece como tal, não como '8d'");

console.log("v1055-2-rotulo-padrao-sempre-ha: ok");
