import fs from 'node:fs';
import assert from 'node:assert/strict';
import { prepararTimelineParaAprendizado } from '../api/_pipeline.js';

const materialSoObservacao = prepararTimelineParaAprendizado([], 'Cliente', {
  camposManuais:['observacoes','pontosSensiveis'],
  observacoes:'A compra depende da venda do terreno próprio.',
  pontosSensiveis:'A permuta já foi recusada; não insistir nisso.',
  observacoesManuais:[{ texto:'Perguntar se o terreno já foi vendido.', dataBR:'13/07/2026', horaBR:'14:00' }]
});
assert.match(materialSoObservacao, /INFORMAÇÕES MANUAIS ATUAIS/);
assert.match(materialSoObservacao, /depende da venda do terreno/i);
assert.match(materialSoObservacao, /não insistir/i);
assert.match(materialSoObservacao, /já foi vendido/i);


const materialTimelineManual = prepararTimelineParaAprendizado([{
  date:'13/07/2026', time:'16:10', author:'Observação do corretor',
  text:'Cliente só avança depois de vender o terreno.', type:'observacao_manual', source:'corretor-pro-manual'
}], 'Cliente', {});
assert.match(materialTimelineManual, /CORRETOR \(Observação do corretor\)/, 'observação da timeline deve ser atribuída ao corretor');

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const leadUpdate = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');
const cerebro = fs.readFileSync(new URL('../api/cerebro-config.js', import.meta.url), 'utf8');

const obsStart = app.indexOf('window.cp7ObsSalvar = async function(btn)');
const obsEnd = app.indexOf('window.ui670Reanalisar=', obsStart);
const obsBlock = app.slice(obsStart, obsEnd);
assert.match(obsBlock, /action:"observacao-adicionar"/);
assert.doesNotMatch(obsBlock, /api\/reanalisar-lead/);
assert.match(obsBlock, /sugestões atuais mantidas/i);
assert.match(obsBlock, /renderLeadFoco\(lead\)/, 'observação deve aparecer imediatamente');

assert.match(leadUpdate, /case "observacao-adicionar"/);
assert.match(leadUpdate, /motivo:"observacao-manual-adicionada"/);
assert.match(leadUpdate, /camposManuais: camposManuaisMemoria\(memAnterior, \[\]\)/, 'observação rápida não pode confirmar como manual todo o texto antigo inferido pela IA');
assert.match(leadUpdate, /reanalisado:false/);
assert.match(leadUpdate, /informadosPeloFront/, 'backend deve respeitar os campos realmente alterados');
assert.match(leadUpdate, /nenhum-campo-manual-alterado/, 'salvar sem alteração não deve criar aprendizado artificial');
assert.match(cerebro, /memoriaManual: a\.memoria \|\| \{\}/);

const memoriaStart = app.indexOf('async function salvarMemoria()');
const memoriaEnd = app.indexOf('// ============ VENDAS REGISTRADAS', memoriaStart);
const memoriaBlock = app.slice(memoriaStart, memoriaEnd);
assert.doesNotMatch(app, /function reanalisarLeadAuto/, 'rotina automática antiga de reanálise deve ser removida');
assert.match(memoriaBlock, /camposAlterados/, 'frontend deve informar somente campos realmente modificados');
assert.match(memoriaBlock, /somentePendentes:true/);

console.log('observacao-aprendizado: ok');
