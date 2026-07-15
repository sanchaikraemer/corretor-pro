import assert from 'node:assert/strict';
import fs from 'node:fs';
import { guessLeadData } from '../api/_pipeline.js';
import { _nomesMesmoLead } from '../api/_persistence.js';

const lead = guessLeadData([
  { author:'Maria Prime', text:'Tenho interesse no apartamento.', type:'text' },
  { author:'Construtora Senger', text:'Vou lhe enviar as informações.', type:'text' }
]);
assert.equal(lead.clientName, 'Maria Prime', 'o nome exportado não pode perder palavras');
assert.equal(lead.phone, '', 'telefone não é obrigatório para importar');
const leadComTelefone = guessLeadData([
  { author:'Maria Prime', text:'Meu contato é (54) 99999-0000.', type:'text' },
  { author:'Construtora Senger', text:'Recebi.', type:'text' }
]);
assert.equal(leadComTelefone.clientName, 'Maria Prime');
assert.equal(leadComTelefone.phone, '54999990000');
assert.equal(_nomesMesmoLead('maria prime', 'maria prime'), true);
assert.equal(_nomesMesmoLead('maria prime', 'maria'), false);
assert.equal(_nomesMesmoLead('maria souza', 'maria clara souza'), false);

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
assert.match(app, /Atualizar cliente/);
assert.doesNotMatch(app, /Criar um novo cliente/);
assert.match(app, />Cancelar</);
assert.match(app, /sem criar duplicata/);
assert.doesNotMatch(app, /autoPorNome\s*=/);

const persistence = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');
assert.match(persistence, /forceNew\s*=\s*false/);
assert.match(persistence, /const existenteV681 = forceNew\s*\?\s*null/);
const leadUpdate = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');
assert.match(leadUpdate, /forceNew:\s*false/);
assert.match(leadUpdate, /acao:\s*"criar-novo"/);
assert.match(leadUpdate, /acao:\s*"atualizar-existente"/);
assert.match(leadUpdate, /conversa-consolidada-aguardando-reanalise/);
assert.match(leadUpdate, /_historicoAnalises/);
assert.match(leadUpdate, /_historicoImportacoes/);
assert.match(leadUpdate, /\.\.\.anterior,\s*\.\.\.nova/s, 'campos operacionais e manuais anteriores precisam permanecer');
const atualizarInicio = leadUpdate.indexOf('async function acaoAtualizarComEvolucao');
const atualizarFim = leadUpdate.indexOf('// Junta duas timelines', atualizarInicio);
const atualizarBloco = leadUpdate.slice(atualizarInicio, atualizarFim);
assert.ok(atualizarBloco.indexOf('.update(payloadConsolidacao)') < atualizarBloco.indexOf('obterAnaliseValidadaDaImportacao(result)'), 'a conversa consolidada deve ser salva antes de gravar a análise já validada');
assert.doesNotMatch(atualizarBloco, /analyzeWithBrain\(/, 'salvar uma atualização não pode chamar a IA novamente');

console.log('v825-import-integridade: ok');
