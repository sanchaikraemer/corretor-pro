import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v981 — print do dono: "mariana planta p/morar lançamento" foi atendida (botão "Marcar
// atendimento") há 2 dias e voltou a aparecer nas prioridades/"Fazer agora" antes do prazo de
// espera (3 ou 5 dias, conforme limiarRetomada). Causa raiz: "Marcar atendimento" (botao_atendido)
// e "copiar mensagem" sem observação só gravam o evento contato_manual — NUNCA tocam
// timeline_json — então daysSinceLastTouch (calculado no servidor em cima da timeline) não sabia
// desse atendimento e continuava com a idade da ÚLTIMA MENSAGEM real do WhatsApp, que pode ser
// bem mais antiga. emJanelaDeEspera confiava só nesse campo. Mesma causa raiz já corrigida em
// diasParado (v882) — replicada aqui, no outro lugar do código que tinha o mesmo problema.
//
// v1018 — o dono voltou com casos reais (Adão: atendeu dia 22, sistema mostrava "26 dias" e
// liberava o lead antes da hora) e foi taxativo: "deve contar do último atendimento esse prazo, e
// não da última mensagem do cliente". emJanelaDeEspera parou de olhar mensagem/resposta do
// cliente OU do corretor — conta SÓ o último atendimento marcado (ultimoAtendimentoTs). A
// mensagem deixou de "ajudar" (não usa mais o toque mais recente entre os dois) — só o
// atendimento importa; sem atendimento nenhum, o lead fica elegível na hora.

const diasCal = app.match(/function diasCalendarioBR\(quando\)\{[\s\S]*?\n\}/);
const tipos = app.match(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/);
const ultAt = app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/);
const lembTs = app.match(/function lembreteTs\(l\)\{[\s\S]*?\n\}/);
const lembVenc = app.match(/function lembreteVencido\(l\)\{[^\n]*\}/);
const limiar = app.match(/function limiarRetomada\(l\)\{[\s\S]*?\n\}/);
const janela = app.match(/function emJanelaDeEspera\(l\)\{[\s\S]*?\n\}/);
assert.ok(diasCal && tipos && ultAt && lembTs && lembVenc && limiar && janela,
  'não achei emJanelaDeEspera + dependências em app.js');
// Remove as linhas de comentário (podem citar os nomes antigos pra explicar a história) antes de
// checar o CÓDIGO em si.
const janelaSemComentarios = janela[0].split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
assert.doesNotMatch(janelaSemComentarios, /\bl\.daysSinceLastTouch\b|\bl\.daysSinceClientReply\b|_diasDesdeMsg\(/,
  'o CÓDIGO de emJanelaDeEspera não pode mais olhar nenhum campo baseado em mensagem — só o último atendimento');

const emJanelaDeEspera = eval(`
  ${diasCal[0]}
  ${tipos[0]}
  ${ultAt[0]}
  ${lembTs[0]}
  ${lembVenc[0]}
  ${limiar[0]}
  ${janela[0]}
  emJanelaDeEspera
`);

const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();

// 1. Bug do print original: mensagem real do WhatsApp é antiga (20 dias), mas o corretor marcou
// atendimento (botão) há 2 dias. Precisa CONTINUAR protegido — conta a partir do atendimento.
const mariana = {
  createdAt: diasAtras(200), // lead estabelecido → limiarRetomada = 5
  daysSinceLastTouch: 20,
  daysSinceClientReply: null,
  analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: diasAtras(2) }
  ] } }
};
assert.equal(emJanelaDeEspera(mariana), true,
  'lead atendido pelo botão há 2 dias precisa continuar na janela de espera, mesmo com a última mensagem real sendo antiga');

// 2. Sem NENHUM atendimento manual registrado: nada de onde contar — elegível na hora, mesmo com
// mensagem recente ou antiga (mensagem não entra mais nessa conta desde a v1018).
const semAtendimento = { createdAt: diasAtras(200), daysSinceLastTouch: 20, daysSinceClientReply: null, analysis: {} };
assert.equal(emJanelaDeEspera(semAtendimento), false,
  'sem nenhum atendimento marcado, o lead nunca foi "colocado em espera" por ninguém — fica elegível na hora');

// 3. v1018 — Atendimento manual ANTIGO (2020) NÃO é mais "ajudado" por uma mensagem recente (2
// dias): mensagem não conta mais pra nada aqui. Só o atendimento manda, e 2020 já passou muito do
// limiar — não protege.
const atendimentoAntigo = {
  createdAt: diasAtras(200),
  daysSinceLastTouch: 2,
  daysSinceClientReply: 1,
  analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: '2020-01-01T12:00:00Z' }
  ] } }
};
assert.equal(emJanelaDeEspera(atendimentoAntigo), false,
  'atendimento de 2020 é o único sinal que conta — muito além do limiar, não protege mais (mensagem recente não "ressuscita" a proteção)');

// 4. Lead novo (limiar 3 dias): atendido manualmente há 2 dias → ainda dentro da janela.
const leadNovo = {
  createdAt: diasAtras(1), // < 7 dias → limiarRetomada = 3
  daysSinceLastTouch: 20,
  daysSinceClientReply: null,
  analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: diasAtras(2) }
  ] } }
};
assert.equal(emJanelaDeEspera(leadNovo), true, 'lead novo (limiar 3 dias) atendido há 2 dias ainda está dentro da janela');

// 5. Atendimento manual há MAIS tempo que o limiar (ex.: 6 dias, limiar 5): não protege mais —
// passou da janela, volta a ser candidato normalmente (comportamento correto, não deve travar pra sempre).
const passouDaJanela = {
  createdAt: diasAtras(200),
  daysSinceLastTouch: 20,
  daysSinceClientReply: null,
  analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: diasAtras(6) }
  ] } }
};
assert.equal(emJanelaDeEspera(passouDaJanela), false, 'atendimento manual de 6 dias atrás (> limiar de 5) já não protege mais');

// 6. v1018 — caso real "Adão": atendido há 5 dias (dentro do limiar de 5 só até o 4º dia
// completo — no 5º dia exato já não protege mais, que é o comportamento consistente com os
// cenários 4/5 acima). O ponto central do relato do dono é o Nº 3: mensagem não "atrapalha" nem
// "ajuda" mais essa conta, só o atendimento.
const adao = {
  createdAt: diasAtras(400),
  daysSinceLastTouch: 26, // "a tela mostrava 26 dias" — o bug era ESSA exibição, agora corrigida à parte (cpHomeLeadRow)
  daysSinceClientReply: null,
  analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: diasAtras(4) }
  ] } }
};
assert.equal(emJanelaDeEspera(adao), true,
  'atendido há 4 dias (dentro do limiar de 5) continua protegido, mesmo com a última mensagem/interação sendo de 26 dias atrás');

console.log('v981-janela-espera-considera-atendimento: ok');
