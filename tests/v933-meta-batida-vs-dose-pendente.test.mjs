import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v933 — bug reportado pelo dono via print: a Home mostrava, na MESMA tela, "10 leads pra
// atender hoje" (saudação) + card "Fazer agora: 10" + a caixa "🎉 Meta de hoje batida!" pedindo
// pra puxar mais um. Contraditório: se a meta ainda tem 10 pendentes (ninguém foi atendido hoje),
// ela não pode estar "batida". Causa: o branch de "Meta de hoje batida" disparava sempre que o
// balde categorizado ("acao-hoje"/"retomar-cuidado") vinha vazio, sem checar se a dose do dia
// (metaHoje/cpFazerAgoraDose) já tinha de fato caído a 0 por atendimento real. Este teste roda o
// trecho REAL de renderBotoesHome (extraído do app.js) nos dois cenários e confirma que a
// mensagem certa aparece em cada um.

const ini = app.indexOf('const metaHoje = typeof cpFazerAgoraDose');
const fim = app.indexOf('// Botão "Pular próximo"');
assert.ok(ini !== -1 && fim !== -1 && fim > ini, 'trecho de decisão do top3Html não encontrado em app.js');
const trecho = app.slice(ini, fim);

function rodar({ urgentesRanqueados, items, fazerAgoraExtra, dose, filaCompleta, retomada }){
  const grupos = { retomada: retomada || [] };
  const state = { fazerAgoraExtra };
  const cpFazerAgoraDose = () => dose;
  const cpFilaFazerAgora = () => filaCompleta;
  const CP_DOSE_DIA = 10;
  return eval(`
    (function(){
      ${trecho}
      return { doseBase, urgentes, disponiveisParaPuxar, top3Html };
    })();
  `);
}

const filaCompleta = [{ id:'p1' }, { id:'p2' }, { id:'p3' }];

// Cenário do bug: ninguém atendido hoje (metaHoje = 10, a dose NÃO foi consumida), mas o balde
// categorizado veio vazio. NÃO pode dizer "Meta de hoje batida" — a meta segue pendente.
const rPendente = rodar({ urgentesRanqueados: [], items: [], fazerAgoraExtra: 0, dose: 10, filaCompleta });
assert.equal(rPendente.urgentes.length, 0, 'balde categorizado vazio: nenhum urgente no topo');
assert.equal(rPendente.disponiveisParaPuxar.length, 3, 'a fila completa ainda enxerga os 3 candidatos');
assert.doesNotMatch(rPendente.top3Html, /Meta de hoje batida/i,
  'com a dose ainda pendente (metaHoje=10), NUNCA deve afirmar que a meta bateu');
assert.match(rPendente.top3Html, /Nenhum lead prioritário pelas regras agora/,
  'deve avisar que ninguém passou no critério de urgência agora, sem confundir com meta batida');
assert.match(rPendente.top3Html, /Ainda faltam 10 pra bater a meta de hoje/,
  'deve mostrar quantos ainda faltam pra bater a meta, coerente com a saudação/card');

// Cenário correto: meta REALMENTE cumprida (metaHoje = 0, dose consumida por atendimento real).
// Aí sim pode convidar a continuar com "Meta de hoje batida!".
const rBatida = rodar({ urgentesRanqueados: [], items: [], fazerAgoraExtra: 0, dose: 0, filaCompleta });
assert.match(rBatida.top3Html, /Meta de hoje batida/i,
  'com metaHoje=0 (dose de fato consumida), a mensagem de meta batida é a correta');
assert.doesNotMatch(rBatida.top3Html, /Nenhum lead prioritário pelas regras agora/,
  'não deve misturar as duas mensagens quando a meta já foi cumprida');

console.log('v933-meta-batida-vs-dose-pendente: ok');
