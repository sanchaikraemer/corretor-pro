import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../api/cerebro-config.js', import.meta.url), 'utf8');
const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

assert.match(html, /id="cerebroRegrasTexto"/);
assert.match(html, /id="cerebroObjecoesTexto"/);
assert.doesNotMatch(html, /id="cerebroAddRegra"/);
assert.doesNotMatch(html, /id="cerebroAddObjecao"/);
assert.doesNotMatch(html, /id="cerebroNovaRegra"/);
assert.doesNotMatch(html, /id="cerebroNovaObjecao"/);
assert.match(app, /regrasTexto:\s*qs\("#cerebroRegrasTexto"\)/);
assert.match(app, /objecoesTexto:\s*qs\("#cerebroObjecoesTexto"\)/);
// acrescentarRegraAoBloco existia só pra alimentar as sugestões de áudio/print/vídeo-link —
// todas removidas (v919/v920), então a função virou órfã e saiu junto.
assert.doesNotMatch(app, /function acrescentarRegraAoBloco/);
assert.doesNotMatch(app, /cerebroRegras\.push/);
assert.match(api, /regrasTexto:/);
assert.match(api, /objecoesTexto:/);
assert.match(pipeline, /REGRAS COMERCIAIS \(siga integralmente/);
assert.match(pipeline, /SINAIS DE OBJEÇÃO E COMO CONDUZIR/);
console.log('v858-cerebro-blocos-texto: ok');
