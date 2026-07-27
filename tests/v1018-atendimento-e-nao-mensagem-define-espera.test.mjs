import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1018 — o dono testou o v1017 (que já tinha corrigido "despedida não pode encerrar a espera")
// e trouxe dois casos reais mostrando que isso não bastava:
//
// "rafael continua aparecendo mesmo sendo atendido em menos de 5 dias."
// "adão marquei atendimento quarta dia 22, ainda sim apresenta 26 dias."
// "esta MUITO ERRADO, e vc nao resolve nunca"
// "deve contar do último atendimento esse prazo, e não da última mensagem do cliente"
// "assim como adão vários outros atendi e não marca corretamente as datas"
//
// Dois bugs distintos, mesma causa raiz (usar sinal de MENSAGEM em vez de ATENDIMENTO):
//
// 1) emJanelaDeEspera ainda deixava uma mensagem nova (do cliente, cronologicamente mais recente
//    que o atendimento) "vencer" um atendimento antigo — bastava o cliente escrever qualquer
//    coisa depois do atendimento pra "toque" (usado pra decidir a espera) voltar a ficar recente,
//    mesmo sem NENHUM atendimento novo. Corrigido: conta SÓ ultimoAtendimentoTs, nunca mensagem.
//
// 2) O número "há Xd" mostrado no card (cpHomeLeadRow) vinha de daysSinceLastInteraction, que só
//    olha a ÚLTIMA MENSAGEM da conversa — nunca soube de atendimento marcado. Por isso o Adão
//    aparecia com "26 dias" um dia depois de ter sido atendido (a conversa dele é antiga; só o
//    atendimento é recente). Corrigido: usa o atendimento quando ele for mais recente que a
//    última interação, igual ao "toque" que a fila já calcula.

function extrai(padrao, nome) {
  const m = app.match(padrao);
  assert.ok(m, `${nome} não encontrada em app.js`);
  return m[0];
}

// --- 1. emJanelaDeEspera não pode ter sinal nenhum de mensagem ---
const janela = extrai(/function emJanelaDeEspera\(l\)\{[\s\S]*?\n\}/, 'emJanelaDeEspera');
// Remove as linhas de comentário (podem citar os nomes antigos pra explicar a história) antes de
// checar o CÓDIGO em si — só o código não pode mais usar esses campos.
const janelaSemComentarios = janela.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
assert.doesNotMatch(janelaSemComentarios, /\bl\.daysSinceLastTouch\b|\bl\.daysSinceClientReply\b|_diasDesdeMsg\(|ultimaMsgClientePedeResposta\(/,
  'o CÓDIGO de emJanelaDeEspera não pode mais usar nenhum campo baseado em mensagem (nem do cliente, nem meu) — só o último atendimento');
assert.match(janela, /ultimoAtendimentoTs\(l\)/, 'emJanelaDeEspera precisa continuar usando ultimoAtendimentoTs');

const diasCal = extrai(/function diasCalendarioBR\(quando\)\{[\s\S]*?\n\}/, 'diasCalendarioBR');
const tipos = extrai(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/, 'TIPOS_ATENDIMENTO_TIMELINE');
const ultAt = extrai(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/, 'ultimoAtendimentoTs');
const lembTs = extrai(/function lembreteTs\(l\)\{[\s\S]*?\n\}/, 'lembreteTs');
const lembVenc = extrai(/function lembreteVencido\(l\)\{[^\n]*\}/, 'lembreteVencido');
const limiar = extrai(/function limiarRetomada\(l\)\{[\s\S]*?\n\}/, 'limiarRetomada');

const emJanelaDeEspera = eval(`
  ${diasCal}
  ${tipos}
  ${ultAt}
  ${lembTs}
  ${lembVenc}
  ${limiar}
  ${janela}
  emJanelaDeEspera
`);

const diasAtras = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

// Caso "Rafael": atendido há 2 dias (dentro do limiar de 5), mas o CLIENTE escreveu de novo
// ontem (1 dia atrás) — sem nenhum atendimento novo. ANTES desta versão, essa mensagem nova
// fazia "toque" voltar a ficar recente e a espera acabava (ou nem começava de verdade). Agora
// precisa continuar protegido: mensagem não conta, só o atendimento (2 dias, dentro do limiar).
const rafael = {
  createdAt: diasAtras(300),
  daysSinceLastTouch: 1, // mensagem (do cliente ou minha) de ontem
  daysSinceClientReply: 1,
  recentMessages: [{ author: 'Rafael', text: 'Bom dia!', iso: diasAtras(1) }],
  analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: diasAtras(2) }
  ] } }
};
assert.equal(emJanelaDeEspera(rafael), true,
  'caso Rafael: atendido há 2 dias continua protegido mesmo com mensagem nova depois do atendimento (mensagem não conta mais)');

// Caso "Adão", v1019: atendido há EXATAMENTE 5 dias — "5 dias de descanso" são 5 dias
// INTEIROS, então ainda precisa estar protegido nesse dia (só libera no 6º dia). O dono viu esse
// exato caso ao vivo (atendeu quarta 22, no 5º dia — domingo/segunda 27 — o lead já tinha
// voltado) e apontou que 5 dias deveria significar 5 dias completos de folga.
const adao = {
  createdAt: diasAtras(400),
  daysSinceLastTouch: 26,
  daysSinceClientReply: null,
  recentMessages: [],
  analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: diasAtras(5) }
  ] } }
};
assert.equal(emJanelaDeEspera(adao), true,
  'atendido há exatamente 5 dias (limiar de estabelecido) AINDA precisa estar protegido — 5 dias de descanso são 5 dias inteiros');

// No 6º dia (passou do limiar inteiro), aí sim libera.
const adaoDiaSeguinte = { ...adao, analysis: { aprendizado: { eventos: [
  { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: diasAtras(6) }
] } } };
assert.equal(emJanelaDeEspera(adaoDiaSeguinte), false,
  'no 6º dia (passou dos 5 dias inteiros de descanso), o lead volta a ficar elegível');

// --- 2. cpHomeLeadRow: o número "há Xd" exibido usa o atendimento quando ele for mais recente ---
const rowSrc = extrai(/function cpHomeLeadRow\(l, ?pos, ?maxMsgs\)\{[\s\S]*?\n\}/, 'cpHomeLeadRow');
assert.match(rowSrc, /ultimoAtendimentoTs/, 'cpHomeLeadRow precisa considerar o atendimento pro número exibido');

const cpHomeLeadRow = eval(`
  const mensagensDoClienteRecente = (l) => Number(l.__msgs||0);
  const escapeHtml = (s) => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const produtosLabel = (l) => l.product || '';
  const produtosLabelCurto = (l) => l.product || '';
  const prioridadeAtendimento = (l) => ({ nivel: l.__nivel||0 });
  const cpBarraMensagensMini = (l, maxMsgs) => '<span class="chr-bar"></span>';
  ${diasCal}
  ${ultAt}
  ${rowSrc}
  cpHomeLeadRow;
`);

// Caso Adão, agora olhando o HTML da linha: última interação (mensagem) é de 26 dias, mas o
// atendimento foi há 5 dias — o card precisa mostrar "há 5d", não "há 26d".
const adaoParaExibicao = {
  __msgs: 0,
  daysSinceLastInteraction: 26,
  analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: diasAtras(5) }
  ] } }
};
const htmlAdao = cpHomeLeadRow(adaoParaExibicao, 2, 100);
assert.match(htmlAdao, />há 5d</, 'com atendimento mais recente (5 dias) que a última interação (26 dias), o card mostra 5, não 26');
assert.match(htmlAdao, /desde o último atendimento marcado/, 'o title explica que o número vem do atendimento marcado, não da conversa');

// Sem atendimento registrado: continua mostrando a última interação normalmente (nada mudou).
const semAtendimentoExibicao = { __msgs: 0, daysSinceLastInteraction: 12, analysis: {} };
const htmlSemAtendimento = cpHomeLeadRow(semAtendimentoExibicao, 3, 100);
assert.match(htmlSemAtendimento, />há 12d</, 'sem atendimento marcado, mostra a última interação normalmente (comportamento de antes)');
assert.match(htmlSemAtendimento, /desde a última interação \(sua ou do cliente\)/, 'title genérico continua igual quando não há atendimento mais recente');

console.log('v1018-atendimento-e-nao-mensagem-define-espera: ok');
