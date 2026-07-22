import fs from 'node:fs';
import assert from 'node:assert/strict';

const sw = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

assert.match(sw, /const shareId = createShareId\(\)/, 'cada compartilhamento deve receber ID próprio');
assert.match(sw, /status: 'pending'/, 'ZIP deve ficar pendente até confirmação do app');
assert.match(sw, /shareId=\$\{encodeURIComponent\(shareId\)\}/, 'redirect precisa carregar o ID do ZIP');
assert.match(sw, /X-Share-Id/, 'fallback do cache precisa identificar o compartilhamento');
assert.doesNotMatch(sw, /id: 'latest'/, 'service worker novo não pode sobrescrever todo compartilhamento em latest');

const checkStart = app.indexOf('async function _checkSharedImpl()');
const checkEnd = app.indexOf('async function checkShared()', checkStart);
const checkBlock = app.slice(checkStart, checkEnd);
assert.match(checkBlock, /state\.pendingSave && state\.pendingSharedRecordId/, 'resultado aguardando salvamento não pode processar o mesmo ZIP de novo na mesma aba');
assert.match(checkBlock, /Date\.now\(\)\+8000/, 'cold start deve aguardar a transação do service worker');
assert.match(app, /Com ID explícito, nunca pega um \"latest\" antigo/, 'share novo não pode abrir um ZIP antigo durante a espera');
assert.match(app, /headerId!==String\(idPreferido\)/, 'fallback legado do cache precisa pertencer ao share atual');
assert.match(checkBlock, /await processFile\(file,\{shareId:id\}\)/, 'processamento do ZIP precisa ser aguardado');
assert.doesNotMatch(checkBlock, /shareIdbDel\(/, 'leitor não pode apagar o ZIP antes do processamento');

const finalStart = app.indexOf('async function finalizarSharePendente');
const finalEnd = app.indexOf('window.finalizarSharePendente', finalStart);
const finalBlock = app.slice(finalStart, finalEnd);
assert.match(finalBlock, /shareIdbDel\(id\)/, 'ZIP só deve sair do IndexedDB na finalização');
assert.match(finalBlock, /apagarShareDoCache\(id\)/, 'ZIP só deve sair do cache na finalização');

const bootStart = app.indexOf('async function iniciarDireciona()');
const bootEnd = app.indexOf('requestAnimationFrame\(iniciarDireciona\)', bootStart);
const boot = app.slice(bootStart, bootEnd);
assert.ok(boot.indexOf('await checkShared()') < boot.indexOf('carregarDashboard()'), 'Share Target precisa ser tratado antes da Home');
assert.ok(boot.indexOf('await checkShared()') < boot.indexOf('getLeadsData(false)'), 'Share Target precisa ser tratado antes da leitura da carteira');
assert.match(app, /if\(window\.__cpShareImportActive \|\| state\?\.processing \|\| state\?\.pendingSharedRecordId\) return;/, 'checagem de versão não pode recarregar durante importação');
assert.match(app, /if\(window\.__cpShareImportActive \|\| state\?\.processing \|\| state\?\.pendingSharedRecordId\)\{/, 'controllerchange não pode interromper a importação');

const processStart = app.indexOf('async function processFile(file, options = {})');
const processEnd = app.indexOf('function formatShareDebug', processStart);
const processBlock = app.slice(processStart, processEnd);
assert.doesNotMatch(processBlock, /if\(pendingShareId\) await finalizarSharePendente/, 'processar não deve apagar o ZIP antes de salvar/atualizar o lead');
const saveStart = app.indexOf('async function salvarLeadPendente()');
const saveEnd = app.indexOf('async function descartarLeadPendente()', saveStart);
assert.match(app.slice(saveStart, saveEnd), /await finalizarSharePendente\(shareConcluidoId\)/, 'salvar o lead deve concluir e limpar o compartilhamento');
const updateStart = app.indexOf('async function atualizarLeadComEvolucao()');
const updateEnd = app.indexOf('async function salvarLeadPendente()', updateStart);
assert.match(app.slice(updateStart, updateEnd), /await finalizarSharePendente\(shareConcluidoId\)/, 'atualizar lead existente deve concluir e limpar o compartilhamento');

console.log('share-target-cold-start: ok');
