import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v891 — o "Desmarcar" dava timeout/abort. (Layout resolvido na v894: virou o interruptor
// do ícone "Atendido" na barra de ícones, sem link solto — ver v894.)

// 1. Não há mais o link solto "Desmarcar" (virou interruptor do ícone Atendido).
assert.doesNotMatch(app, /class="cp704-desmarcar"/, 'o link solto "Desmarcar" saiu (virou interruptor)');

// 2. Robustez: otimista (desmarca na tela antes da rede), timeout generoso (cold start) e
//    reverte se a API falhar.
const fn = app.match(/window\.ui667DesmarcarAtendido=async function\(btn\)\{[\s\S]*?\n\};/)[0];
assert.match(fn, /const snapshot=/, 'guarda snapshot pra reverter');
assert.match(fn, /ui667RemoverAtendidoLocal\(lead\);[\s\S]*?renderLeadFoco\(lead\);[\s\S]*?try\{/, 'desmarca otimista antes do fetch');
assert.match(fn, /fetchComTimeout\([^;]*?,30000\)/, 'timeout generoso de 30s (cold start do serverless)');
assert.match(fn, /lead\.analysis\.aprendizado\.eventos=snapshot/, 'reverte a tela se o servidor falhar');

console.log('v891-desmarcar-layout-robusto: ok');
