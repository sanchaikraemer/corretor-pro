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

const diasCal = app.match(/function diasCalendarioBR\(quando\)\{[\s\S]*?\n\}/);
const tipos = app.match(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/);
const ultAt = app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/);
const lembTs = app.match(/function lembreteTs\(l\)\{[\s\S]*?\n\}/);
const lembVenc = app.match(/function lembreteVencido\(l\)\{[^\n]*\}/);
const limiar = app.match(/function limiarRetomada\(l\)\{[\s\S]*?\n\}/);
const diasMsg = app.match(/function _diasDesdeMsg\(l, somenteCliente\)\{[\s\S]*?\n\}/);
const janela = app.match(/function emJanelaDeEspera\(l\)\{[\s\S]*?\n\}/);
assert.ok(diasCal && tipos && ultAt && lembTs && lembVenc && limiar && diasMsg && janela,
  'não achei emJanelaDeEspera + dependências em app.js');

const emJanelaDeEspera = eval(`
  ${diasCal[0]}
  ${tipos[0]}
  ${ultAt[0]}
  ${lembTs[0]}
  ${lembVenc[0]}
  ${limiar[0]}
  ${diasMsg[0]}
  ${janela[0]}
  emJanelaDeEspera
`);

const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();

// 1. Bug do print: mensagem real do WhatsApp é antiga (20 dias — fora da janela), mas o corretor
// marcou atendimento (botão) há 2 dias. Precisa CONTINUAR protegido (dentro da janela), porque o
// toque mais recente é o atendimento manual, não a mensagem velha.
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

// 2. Sem NENHUM atendimento manual: comportamento de antes, baseado só na mensagem (não quebrou nada).
const semAtendimento = { createdAt: diasAtras(200), daysSinceLastTouch: 20, daysSinceClientReply: null, analysis: {} };
assert.equal(emJanelaDeEspera(semAtendimento), false,
  'sem atendimento manual, continua usando só o sinal de mensagem (20 dias > limiar de 5 → fora da janela)');

// 3. Atendimento manual ANTIGO (ex.: 2020) não pode "proteger" um lead cuja mensagem real é mais
// recente — usa sempre o toque mais recente entre os dois, nunca o mais antigo.
const atendimentoAntigo = {
  createdAt: diasAtras(200),
  daysSinceLastTouch: 2,
  daysSinceClientReply: null,
  analysis: { aprendizado: { eventos: [
    { evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: '2020-01-01T12:00:00Z' }
  ] } }
};
assert.equal(emJanelaDeEspera(atendimentoAntigo), true,
  'com mensagem mais recente (2 dias) que o atendimento de 2020, usa a mensagem — resultado bate mesmo assim (2 < limiar 5)');

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

console.log('v981-janela-espera-considera-atendimento: ok');
