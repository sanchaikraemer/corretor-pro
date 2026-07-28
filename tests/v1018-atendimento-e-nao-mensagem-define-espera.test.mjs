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
// 1) emJanelaDeEspera deixava uma mensagem nova (do cliente, cronologicamente mais recente
//    que o atendimento) "vencer" um atendimento antigo de um jeito que AFROUXAVA a proteção —
//    bastava o cliente escrever qualquer coisa pra "toque" ficar recente, mesmo sem NENHUM
//    atendimento novo, só que usando um campo (daysSinceLastTouch) que na época nem sabia da
//    existência do atendimento marcado por botão. Corrigido então: conta SÓ ultimoAtendimentoTs.
//    v1051 revisitou isso (ver comentário dedicado abaixo) — mensagem voltou a contar, mas só
//    pra REFORÇAR a proteção, nunca pra afrouxar; o bug desta versão continua corrigido.
//
// 2) O número "há Xd" mostrado no card (cpHomeLeadRow) vinha de daysSinceLastInteraction, que só
//    olha a ÚLTIMA MENSAGEM da conversa — nunca soube de atendimento marcado. Por isso o Adão
//    aparecia com "26 dias" um dia depois de ter sido atendido (a conversa dele é antiga; só o
//    atendimento é recente). Corrigido: usa o atendimento quando ele for mais recente que a
//    última interação, igual ao "toque" que a fila já calcula.
//
// v1051 — caso real "Karine": atendida no app, mas o descanso configurado (7 dias) não estava
// valendo de verdade porque uma troca de mensagem mais recente (fora do botão "Copiar" do app)
// não era reconhecida como toque nenhum — ela reapareceu com só 5 dias. Pedido taxativo do dono:
// "7 dias é 7 e ponto final". emJanelaDeEspera passou a considerar TAMBÉM a interação mais
// recente (mensagem, de qualquer lado) — mas só usa esse número quando ele for MENOR (mais
// recente) que os dias desde o atendimento, nunca maior. Ver
// tests/v981-janela-espera-considera-atendimento.test.mjs pros cenários completos dessa regra.

function extrai(padrao, nome) {
  const m = app.match(padrao);
  assert.ok(m, `${nome} não encontrada em app.js`);
  return m[0];
}

// --- 1. emJanelaDeEspera continua usando ultimoAtendimentoTs como base ---
const janela = extrai(/function emJanelaDeEspera\(l\)\{[\s\S]*?\n\}/, 'emJanelaDeEspera');
assert.match(janela, /ultimoAtendimentoTs\(l\)/, 'emJanelaDeEspera precisa continuar usando ultimoAtendimentoTs');
// v1051 — mensagem (daysSinceLastTouch) pode aparecer no código agora, mas só como REFORÇO
// (nunca deixa os dias subirem, só descerem) — ver a trava explícita no teste v981.
assert.match(janela, /diasMsg < dias/, 'a mensagem só pode diminuir os dias (reforçar), nunca aumentar (afrouxar) a proteção');

const diasCal = extrai(/function diasCalendarioBR\(quando\)\{[\s\S]*?\n\}/, 'diasCalendarioBR');
const tipos = extrai(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/, 'TIPOS_ATENDIMENTO_TIMELINE');
const ultAt = extrai(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/, 'ultimoAtendimentoTs');
const lembTs = extrai(/function lembreteTs\(l\)\{[\s\S]*?\n\}/, 'lembreteTs');
const lembVenc = extrai(/function lembreteVencido\(l\)\{[^\n]*\}/, 'lembreteVencido');
// v1048 — limiarRetomada passou a delegar pra cpDiasDescansoPosAtendimento (valor configurável no
// Cérebro, padrão 5 quando não há config — o caso destes testes).
const diasDescanso = extrai(/function cpDiasDescansoPosAtendimento\(\)\{[\s\S]*?\n\}/, 'cpDiasDescansoPosAtendimento');
const limiar = extrai(/function limiarRetomada\(l\)\{[\s\S]*?\n\}/, 'limiarRetomada');

const emJanelaDeEspera = eval(`
  ${diasCal}
  ${tipos}
  ${ultAt}
  ${lembTs}
  ${lembVenc}
  ${diasDescanso}
  ${limiar}
  ${janela}
  emJanelaDeEspera
`);

const diasAtras = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

// Caso "Rafael": atendido há 2 dias (dentro do limiar de 5), e o CLIENTE escreveu de novo ontem
// (1 dia atrás) — sem nenhum atendimento novo. Continua protegido nos dois sentidos: pela
// v1018 (o atendimento sozinho já bastava) e pela v1051 (a mensagem de ontem, sendo ainda mais
// recente, só reforça — nunca destrava a proteção mais cedo).
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
const rowSrc = extrai(/function cpHomeLeadRow\(l, ?maxMsgs\)\{[\s\S]*?\n\}/, 'cpHomeLeadRow');
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
const htmlAdao = cpHomeLeadRow(adaoParaExibicao, 100);
assert.match(htmlAdao, />há 5d</, 'com atendimento mais recente (5 dias) que a última interação (26 dias), o card mostra 5, não 26');
assert.match(htmlAdao, /desde o último atendimento marcado/, 'o title explica que o número vem do atendimento marcado, não da conversa');

// Sem atendimento registrado: continua mostrando a última interação normalmente (nada mudou).
const semAtendimentoExibicao = { __msgs: 0, daysSinceLastInteraction: 12, analysis: {} };
const htmlSemAtendimento = cpHomeLeadRow(semAtendimentoExibicao, 100);
assert.match(htmlSemAtendimento, />há 12d</, 'sem atendimento marcado, mostra a última interação normalmente (comportamento de antes)');
assert.match(htmlSemAtendimento, /desde a última interação \(sua ou do cliente\)/, 'title genérico continua igual quando não há atendimento mais recente');

console.log('v1018-atendimento-e-nao-mensagem-define-espera: ok');
