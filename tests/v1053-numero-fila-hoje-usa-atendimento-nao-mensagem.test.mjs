import fs from "node:fs";
import assert from "node:assert/strict";
// v1337 — o fuso do app saiu de 35 literais "America/Sao_Paulo" e virou cpFuso(). Este import
// entrega as funções REAIS de fuso do app.js pros trechos que este teste roda com eval.
import "./_fuso-do-app.mjs";

// v1053 — caso real "Karine": a v1052 fez a regra de descanso contar exclusivamente do último
// atendimento marcado. O número na linha da lista "Fazer agora" usava a data mais recente entre
// atendimento e mensagem, e em casos como o dela (atendimento de 10+ dias, mensagem de 5) a tela
// mostrava "há 5d" enquanto a regra contava do atendimento — parecia que a regra dos 7 dias
// configurados estava sendo ignorada.
//
// v1332 — E AÍ APARECEU O OUTRO LADO DA MESMA MOEDA. Print do dono em 20/08/2026, 20h09: um
// cliente que tinha acabado de escrever pra ele às 17h55 aparecia como "há 8d" (o atendimento de
// 12/08) e, ao mesmo tempo, no topo da fila de "Fazer agora". "Tu tem noção do quanto isso é
// ridículo" — e é: número velho ao lado de quem está esperando resposta AGORA faz despriorizar
// justamente quem não pode esperar.
//
// A saída não é escolher um dos dois lados: é DIZER QUAL É. A linha passa a mostrar o evento mais
// recente COM O NOME DELE — "atendido há 10d" (o caso da Karine, que continua batendo com a regra
// de descanso) ou "falou hoje" / "falou há 5d" (o caso do cliente que escreveu agora). O que a
// v1055 tinha padronizado ("tudo há Xd") era justamente o que deixava o número ambíguo.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const rowSrc = app.match(/function cpHomeLeadRow\(l, ?maxMsgs\)\{[\s\S]*?\n\}/)[0];
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
const comAtendimento = (diasAt, diasMsg) => ({
  daysSinceLastInteraction: diasMsg,
  analysis: { aprendizado: { eventos: [
    { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: diasAtras(diasAt) }
  ] } }
});

// ── 1. Caso "Karine": atendimento há 10 dias e mensagem há 5 ─────────────────────────────────
// O evento mais recente é a mensagem — e agora ela aparece, mas DIZENDO que é mensagem. Quem
// quiser conferir a regra de descanso continua tendo o atendimento no title.
{
  const html = cpHomeLeadRow(comAtendimento(10, 5), 100);
  assert.match(html, /falou há 5d/, "o evento mais recente é a mensagem, e a linha diz isso com todas as letras");
  assert.doesNotMatch(html, /atendido há 10d/, "não pode dizer 'atendido' quando o que aconteceu por último foi a mensagem");
}

// ── 2. Nenhuma novidade depois do atendimento: manda o atendimento ───────────────────────────
{
  const html = cpHomeLeadRow(comAtendimento(10, 10), 100);
  assert.match(html, /atendido há 10d/, "sem mensagem mais nova, o número é o do atendimento — e com o nome dele");
  assert.match(html, /desde o último atendimento marcado/, "o title continua explicando de onde vem o número");
}

// ── 3. O print de 20/08: cliente escreveu HOJE, atendimento de 8 dias atrás ──────────────────
{
  const html = cpHomeLeadRow(comAtendimento(8, 0), 100);
  assert.match(html, /falou hoje/, "cliente que escreveu hoje não pode aparecer como parado há 8 dias");
  assert.doesNotMatch(html, />atendido há 8d</, "o número velho do atendimento não pode continuar na tela nesse caso");
}

// ── 4. Sem atendimento nenhum: continua a última interação ───────────────────────────────────
{
  const html = cpHomeLeadRow({ daysSinceLastInteraction: 12, analysis: {} }, 100);
  assert.match(html, /falou há 12d/, "sem atendimento marcado, o que existe é a mensagem");
  assert.match(html, /desde a última interação \(sua ou do cliente\)/, "title genérico continua igual");
}

console.log("v1053-numero-fila-hoje-usa-atendimento-nao-mensagem: ok");
