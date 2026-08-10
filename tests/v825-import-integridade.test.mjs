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
// v1176 — o número escrito NO TEXTO da conversa deixou de virar "telefone do cliente": ele podia
// ser o do próprio corretor (que ele manda pra todo mundo) e, como o telefone é chave de
// identidade do cadastro, dois clientes diferentes acabavam no mesmo cadastro — foi o bug do
// "exportei a conversa de uma cliente e abriu o cadastro de outra". Ele continua guardado como
// informação, e o telefone de verdade vem do contato exportado ou da edição manual do lead.
const leadComTelefone = guessLeadData([
  { author:'Maria Prime', text:'Meu contato é (54) 99999-0000.', type:'text' },
  { author:'Construtora Senger', text:'Recebi.', type:'text' }
]);
assert.equal(leadComTelefone.clientName, 'Maria Prime');
assert.equal(leadComTelefone.phone, '', 'número citado na conversa não é identidade do cliente');
assert.equal(leadComTelefone.telefoneCitadoNaConversa, '54999990000', 'mas segue registrado como informação');
assert.equal(_nomesMesmoLead('maria prime', 'maria prime'), true);
assert.equal(_nomesMesmoLead('maria prime', 'maria'), false);
assert.equal(_nomesMesmoLead('maria souza', 'maria clara souza'), false);

// v1195 — o processamento da conversa importada saiu do app.js para o pedaço js/importacao.js,
// baixado só na hora em que o corretor importa. Este teste confere esse código como texto, então
// lê os dois arquivos juntos: os asserts abaixo valem exatamente sobre o mesmo código de antes.
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8')
  + '\n' + fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
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
