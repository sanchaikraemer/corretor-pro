import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const checkStart = app.indexOf('async function _checkSharedImpl()');
const checkEnd = app.indexOf('async function checkShared()', checkStart);
assert.ok(checkStart >= 0 && checkEnd > checkStart, 'bloco checkShared precisa existir');
const check = app.slice(checkStart, checkEnd);

assert.match(check, /if\(!cameFromShare\)\{[\s\S]*return \{handled:false\};/, 'abertura normal deve encerrar antes de procurar ZIP pendente');
assert.ok(check.indexOf('if(!cameFromShare)') < check.indexOf('localizarSharePendente'), 'guarda de abertura normal deve vir antes da leitura do IndexedDB');
assert.match(check, /15\*60\*1000/, 'URL antiga de compartilhamento precisa expirar');
assert.match(check, /staleShare:true/, 'share antigo deve ser ignorado explicitamente');
// v1141 — a janela "Período dos áudios" deixou de existir (a importação usa o padrão do Cérebro),
// então não há mais modal residual pra limpar aqui. O que este teste guarda continua valendo: uma
// abertura normal do app, ou um compartilhamento antigo, NUNCA começa uma importação sozinho.
assert.doesNotMatch(app, /periodoAudioModal/, 'a janela do período não existe mais em nenhum lugar');

const processStart = app.indexOf('async function processFile(file, options = {})');
const processEnd = app.indexOf('async function readShareDebug()', processStart);
const process = app.slice(processStart, processEnd);
assert.match(process, /if\(pendingShareId\)[\s\S]*history\.replaceState\(null,'',location\.pathname\)/, 'falha de importação deve limpar a URL do Share Target');

const cacheStart = app.indexOf('async function localizarShareNoCache');
const cacheEnd = app.indexOf('function mostrarRecebimentoShare', cacheStart);
const cache = app.slice(cacheStart, cacheEnd);
assert.match(cache, /X-Shared-At/, 'fallback do cache precisa carregar o horário do compartilhamento');

console.log('v827-11-no-audio-modal-on-boot: ok');
