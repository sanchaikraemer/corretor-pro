import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v891 — o "Desmarcar" quebrava o layout (5º botão grande no grid) e dava timeout/abort.

// 1. Layout: "Desmarcar" é um link discreto (cp704-desmarcar), não um botão-pill, e no mobile
//    ocupa a linha inteira embaixo do grid 2x2.
assert.match(app, /class="cp704-desmarcar" onclick="ui667DesmarcarAtendido/, 'Desmarcar usa a classe de link discreto');
assert.match(app, /\.cp704-desmarcar\{[^}]*text-decoration:underline/, 'estilo de link (sublinhado) para o Desmarcar');
// v892: discreto, sem ocupar a linha toda (o dono não quer tanto destaque).
assert.match(app, /\.cp704-desmarcar\{justify-self:start;width:auto/, 'no mobile o Desmarcar é discreto (não ocupa a linha inteira)');
assert.doesNotMatch(app, /\.cp704-desmarcar\{grid-column:1\/-1/, 'não deve mais esticar na linha inteira');

// 2. Robustez: otimista (desmarca na tela antes da rede), timeout generoso (cold start) e
//    reverte se a API falhar.
const fn = app.match(/window\.ui667DesmarcarAtendido=async function\(btn\)\{[\s\S]*?\n\};/)[0];
assert.match(fn, /const snapshot=/, 'guarda snapshot pra reverter');
assert.match(fn, /ui667RemoverAtendidoLocal\(lead\);[\s\S]*?renderLeadFoco\(lead\);[\s\S]*?try\{/, 'desmarca otimista antes do fetch');
assert.match(fn, /fetchComTimeout\([^;]*?,30000\)/, 'timeout generoso de 30s (cold start do serverless)');
assert.match(fn, /lead\.analysis\.aprendizado\.eventos=snapshot/, 'reverte a tela se o servidor falhar');

console.log('v891-desmarcar-layout-robusto: ok');
