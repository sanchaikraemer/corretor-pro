import fs from 'node:fs';
import assert from 'node:assert/strict';
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
// v897 — barra "Interesse do cliente" cheia em 100 mensagens do cliente (era 30).
assert.match(app, /const CP_TETO_BARRA_INTERESSE = 100;/, 'teto da barra = 100');
assert.doesNotMatch(app, /const CP_TETO_BARRA_INTERESSE = 30;/, 'não pode mais ser 30');
console.log('v897-teto-barra-100: ok');
