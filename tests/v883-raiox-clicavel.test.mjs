import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v883 tornou o "Raio-X da carteira" clicável. v911 — o dono mandou REMOVER o Raio-X de vez:
// ele se baseava em etapa/proposta/visita (dados que o app não sabe). Este teste garante a remoção.

assert.doesNotMatch(app, /class="raiox-mobile"/, 'o Raio-X saiu da home');
assert.doesNotMatch(app, /function insightFocoHTML/, 'insightFocoHTML removido');
assert.doesNotMatch(app, /function abrirRaioX/, 'abrirRaioX removido');
assert.doesNotMatch(app, /function leadsRaioX/, 'leadsRaioX removido');
assert.doesNotMatch(app, /📊 Raio-X da carteira/, 'nenhum bloco "Raio-X da carteira" renderizado');

// abrirGrupoHome com lista avulsa continua existindo (ainda usado por outras telas).
const ag = app.match(/function abrirGrupoHome\(grupo, options=\{\}\)\{[\s\S]*?const arr =[^\n]*\n/)[0];
assert.match(ag, /const avulsa = Array\.isArray\(options\.leads\)/, 'abrirGrupoHome ainda aceita lista avulsa');

console.log('v883-raiox-clicavel: ok');
