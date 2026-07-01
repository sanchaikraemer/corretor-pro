import assert from 'node:assert/strict';
import { finalizarAnaliseDaConversa } from './api/_pipeline.js';

const antigo = [
  { id:1, order:1, date:'30/06/2026', time:'10:00', iso:'2026-06-30T13:00:00.000Z', author:'Anderson', text:'Vou analisar a proposta.', type:'text', source:'txt' },
  { id:2, order:2, date:'30/06/2026', time:'10:05', iso:'2026-06-30T13:05:00.000Z', author:'Sanchai', text:'[Áudio transcrito] Fico no aguardo do teu retorno.', type:'audio', source:'audio', mediaFile:'PTT-20260630-WA0001.opus', audioStatus:'transcrito' }
];
const anterior = { summary:'Cliente analisando a proposta.', probabilityPercent:65, nextAction:'Aguardar retorno.', clientName:'Anderson' };
const mensagensIguais = [
  { id:1, order:1, date:'30/06/2026', time:'10:00', iso:'2026-06-30T13:00:00.000Z', author:'Anderson', text:'Vou analisar a proposta.', type:'text' },
  { id:2, order:2, date:'30/06/2026', time:'10:05', iso:'2026-06-30T13:05:00.000Z', author:'Sanchai', text:'PTT-20260630-WA0001.opus (arquivo anexado)', type:'text' }
];
const map = { 'PTT-20260630-WA0001.opus': { status:'transcrito_reaproveitado', text:'Fico no aguardo do teu retorno.' } };

const semNovidade = await finalizarAnaliseDaConversa({
  txtFile:'Conversa do WhatsApp com Anderson.txt',
  messages:mensagensIguais,
  audioFilesRelevantes:['PTT-20260630-WA0001.opus'],
  transcriptionMap:map,
  existingTimeline:antigo,
  previousAnalysis:anterior,
  existingLeadId:'lead-1',
  audiosReaproveitados:1,
  audiosNovosSolicitados:0
});
assert.equal(semNovidade.incrementalMeta.reimportacao, true);
assert.equal(semNovidade.incrementalMeta.mensagensNovas, 0);
assert.equal(semNovidade.incrementalMeta.analiseReutilizada, true);
assert.equal(semNovidade.incrementalMeta.audiosReaproveitados, 1);
assert.equal(semNovidade.timeline.length, 0);
assert.equal(semNovidade.analysis.summary, anterior.summary);

const comNovidade = await finalizarAnaliseDaConversa({
  txtFile:'Conversa do WhatsApp com Anderson.txt',
  messages:[...mensagensIguais, { id:3, order:3, date:'01/07/2026', time:'09:00', iso:'2026-07-01T12:00:00.000Z', author:'Anderson', text:'Pode me mandar a condição com entrada menor?', type:'text' }],
  audioFilesRelevantes:['PTT-20260630-WA0001.opus'],
  transcriptionMap:map,
  existingTimeline:antigo,
  previousAnalysis:anterior,
  existingLeadId:'lead-1',
  audiosReaproveitados:1,
  audiosNovosSolicitados:0
});
assert.equal(comNovidade.incrementalMeta.reimportacao, true);
assert.equal(comNovidade.incrementalMeta.mensagensNovas, 1);
assert.equal(comNovidade.timeline.length, 1);
assert.equal(comNovidade.timeline.filter(m => m.mediaFile === 'PTT-20260630-WA0001.opus').length, 0);
assert.equal(comNovidade.metrics.audiosReaproveitados, 1);

console.log('Teste incremental V669: OK — sem duplicar, reaproveita áudio e isola somente a mensagem nova.');
