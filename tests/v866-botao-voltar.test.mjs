import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v866: o "‹ Voltar" (.cp704-back) — o botão mais usado — era só texto apagado
// (transparente, cor --muted, sem borda). Virou um pill de verdade: borda, fundo sutil,
// cantos arredondados e hover.

const base = app.match(/\.cp704-back\{[^}]*\}/);
assert.ok(base, 'a regra base .cp704-back precisa existir');
assert.match(base[0], /border-radius:999px/, 'o Voltar precisa virar pill (border-radius)');
assert.match(base[0], /border:1px/, 'o Voltar precisa ter borda');
assert.doesNotMatch(base[0], /background:transparent/, 'o Voltar não pode mais ser transparente/sem fundo');
assert.match(app, /\.cp704-back:hover\{/, 'o Voltar precisa ter estado de hover');

console.log('v866-botao-voltar: ok');
