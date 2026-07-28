import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v981 — print do dono: "mariana planta p/morar lançamento" foi atendida (botão "Marcar
// atendimento") há 2 dias e voltou a aparecer nas prioridades/"Fazer agora" antes do prazo de
// espera (limiarRetomada). Causa raiz: "Marcar atendimento" (botao_atendido)
// e "copiar mensagem" sem observação só gravam o evento contato_manual — NUNCA tocam
// timeline_json — então daysSinceLastTouch (calculado no servidor em cima da timeline) não sabia
// desse atendimento e continuava com a idade da ÚLTIMA MENSAGEM real do WhatsApp, que pode ser
// bem mais antiga. emJanelaDeEspera confiava só nesse campo. Mesma causa raiz já corrigida em
// diasParado (v882) — replicada aqui, no outro lugar do código que tinha o mesmo problema.
//
// v1018 — o dono voltou com casos reais (Adão: atendeu dia 22, sistema mostrava "26 dias" e
// liberava o lead antes da hora) e foi taxativo: "deve contar do último atendimento esse prazo, e
// não da última mensagem do cliente". emJanelaDeEspera parou de olhar mensagem/resposta do
// cliente OU do corretor por um bom tempo — conta o último atendimento marcado
// (ultimoAtendimentoTs) como base.
//
// v1048 — o dono pediu pra tornar o prazo de descanso configurável (campo novo no Cérebro,
// "Descanso após atender") — limiarRetomada deixou de ter a distinção fixa "3 dias pra lead
// novo, 5 pra estabelecido" e virou um valor só (cpDiasDescansoPosAtendimento), com padrão 5
// quando não há Cérebro configurado (exatamente o caso destes testes, que não simulam o
// formulário/localStorage do Cérebro).
//
// v1051 — caso real "Karine": atendida (marcada no app), mas depois trocou mensagens com o dono
// pelo WhatsApp direto (sem passar pelo botão "Copiar" do app) — o app não reconhecia isso como
// nenhum toque novo, então mesmo com "Descanso após atender" configurado pra 7 dias, ela
// reapareceu com só 5 dias (contando só do clique antigo de "Marcar atendimento", não da troca de
// mensagem mais recente). O dono foi taxativo: "7 dias é 7 e ponto final, não pode aparecer com
// menos que isso". emJanelaDeEspera volta a considerar mensagem — mas só pra REFORÇAR a proteção
// (usa a interação mais recente entre atendimento e mensagem, nunca a mais antiga), o que é
// diferente do bug que a v1018 corrigiu (mensagem "vencendo"/AFROUXANDO um atendimento que já
// devia proteger). Os cenários 1/3/6 abaixo (que dependiam de mensagem NUNCA contar, nem pra
// ajudar) foram atualizados pra reflita a regra nova; o restante (sem atendimento, atendimento
// isolado sem mensagem) continua igual.

const diasCal = app.match(/function diasCalendarioBR\(quando\)\{[\s\S]*?\n\}/);
const tipos = app.match(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/);
const ultAt = app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/);
const lembTs = app.match(/function lembreteTs\(l\)\{[\s\S]*?\n\}/);
const lembVenc = app.match(/function lembreteVencido\(l\)\{[^\n]*\}/);
const diasDescanso = app.match(/function cpDiasDescansoPosAtendimento\(\)\{[\s\S]*?\n\}/);
const limiar = app.match(/function limiarRetomada\(l\)\{[\s\S]*?\n\}/);
const janela = app.match(/function emJanelaDeEspera\(l\)\{[\s\S]*?\n\}/);
assert.ok(diasCal && tipos && ultAt && lembTs && lembVenc && diasDescanso && limiar && janela,
  'não achei emJanelaDeEspera + dependências em app.js');

// v1051 — o CÓDIGO precisa usar a interação mais recente (mensagem OU atendimento), nunca ficar
// preso só no atendimento quando a mensagem for mais nova — isso é o oposto do que a v1018
// travava (mensagem nunca contava). Trava a fórmula do "mínimo" (nunca aumenta os dias, só
// diminui) pra garantir que isso só FORTALECE a proteção.
assert.match(janela[0], /Math\.min|diasMsg < dias/, 'emJanelaDeEspera precisa usar a interação (atendimento ou mensagem) mais recente, nunca a mais antiga');
assert.match(janela[0], /daysSinceLastTouch/, 'emJanelaDeEspera precisa considerar daysSinceLastTouch (toque de qualquer lado, inclusive meu)');

const emJanelaDeEspera = eval(`
  ${diasCal[0]}
  ${tipos[0]}
  ${ultAt[0]}
  ${lembTs[0]}
  ${lembVenc[0]}
  ${diasDescanso[0]}
  ${limiar[0]}
  ${janela[0]}
  emJanelaDeEspera
`);

const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();

// 1. Bug do print original (v981): mensagem real do WhatsApp é antiga (20 dias), mas o corretor
// marcou atendimento (botão) há 2 dias. Precisa CONTINUAR protegido — o atendimento é o toque
// mais recente aqui, então vale ele.
const mariana = {
  createdAt: diasAtras(200),
  daysSinceLastTouch: 20,
  daysSinceClientReply: null,
  analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: diasAtras(2) }
  ] } }
};
assert.equal(emJanelaDeEspera(mariana), true,
  'lead atendido pelo botão há 2 dias precisa continuar na janela de espera — o atendimento é o toque mais recente');

// 2. Sem NENHUM atendimento manual registrado: nada de onde contar — elegível na hora, mesmo com
// mensagem recente ou antiga (sem atendimento, a janela nunca chega a existir).
const semAtendimento = { createdAt: diasAtras(200), daysSinceLastTouch: 20, daysSinceClientReply: null, analysis: {} };
assert.equal(emJanelaDeEspera(semAtendimento), false,
  'sem nenhum atendimento marcado, o lead nunca foi "colocado em espera" por ninguém — fica elegível na hora');

// 3. v1051 — caso real "Karine": atendimento manual ANTIGO (2020, muito além do limiar), mas uma
// mensagem RECENTE (2 dias — o dono mandou pelo WhatsApp direto) precisa REFORÇAR a proteção,
// não ser ignorada. Isso é o CONTRÁRIO do cenário travado antes da v1051 (onde mensagem nunca
// contava pra nada) — o pedido explícito do dono foi "7 dias é 7 e ponto final".
const atendimentoAntigoComMensagemNova = {
  createdAt: diasAtras(200),
  daysSinceLastTouch: 2,
  daysSinceClientReply: 1,
  analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: '2020-01-01T12:00:00Z' }
  ] } }
};
assert.equal(emJanelaDeEspera(atendimentoAntigoComMensagemNova), true,
  'atendimento de 2020 sozinho não protegeria mais, mas a mensagem de 2 dias atrás é o toque mais recente e PRECISA proteger (v1051)');

// 3b. Mesmo atendimento antigo (2020), mas SEM nenhuma mensagem recente também: não protege —
// confirma que é a mensagem RECENTE que muda o resultado, não o atendimento antigo sozinho.
const atendimentoAntigoSemMensagemNova = {
  createdAt: diasAtras(200),
  analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: '2020-01-01T12:00:00Z' }
  ] } }
};
assert.equal(emJanelaDeEspera(atendimentoAntigoSemMensagemNova), false,
  'sem daysSinceLastTouch/daysSinceLastInteraction recentes, o atendimento de 2020 sozinho não protege mais');

// 4. Lead recém-criado: atendido manualmente há 2 dias → ainda dentro da janela (limiar 5,
// v1048 — deixou de ter regra especial por idade do lead; é o mesmo valor pra qualquer lead).
const leadNovo = {
  createdAt: diasAtras(1),
  daysSinceLastTouch: 2,
  daysSinceClientReply: null,
  analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: diasAtras(2) }
  ] } }
};
assert.equal(emJanelaDeEspera(leadNovo), true, 'lead recém-criado atendido há 2 dias ainda está dentro da janela (limiar 5)');

// 5. Atendimento manual E última interação, ambos há MAIS tempo que o limiar (ex.: 6 dias, limiar
// 5): não protege mais — passou da janela dos dois jeitos, volta a ser candidato normalmente.
const passouDaJanela = {
  createdAt: diasAtras(200),
  daysSinceLastTouch: 6,
  daysSinceClientReply: null,
  analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: diasAtras(6) }
  ] } }
};
assert.equal(emJanelaDeEspera(passouDaJanela), false, 'atendimento e última interação de 6 dias atrás (> limiar de 5) já não protegem mais');

// 6. v1018/v1051 — caso real "Adão": atendido há 5 dias (dentro do limiar de 5 só até o 4º dia
// completo — no 5º dia exato já não protege mais). Como não há daysSinceLastTouch mais recente
// que o atendimento aqui, o resultado é o mesmo de antes da v1051.
const adao = {
  createdAt: diasAtras(400),
  daysSinceLastTouch: 26, // "a tela mostrava 26 dias" — o bug era ESSA exibição, corrigida à parte (cpHomeLeadRow)
  daysSinceClientReply: null,
  analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: diasAtras(4) }
  ] } }
};
assert.equal(emJanelaDeEspera(adao), true,
  'atendido há 4 dias (dentro do limiar de 5) continua protegido, mesmo com a última interação sendo de 26 dias atrás');

console.log('v981-janela-espera-considera-atendimento: ok');
