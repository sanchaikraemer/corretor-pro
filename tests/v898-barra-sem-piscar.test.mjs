import fs from 'node:fs';
import assert from 'node:assert/strict';
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v898 — a barra "Interesse do cliente" piscava ao abrir (ex.: 4 -> 19): o lead abre com um
// recorte de mensagens da lista e ~700ms depois chega o histórico completo. Correção: a barra
// só mostra o número com historyLoaded; antes disso mostra "contando…".
const fn = app.match(/function cp704BarraInteresse\(lead\)\{[\s\S]*?\n  \}/)[0];
assert.match(fn, /const pronto = !!\(lead && lead\.historyLoaded\)/, 'só conta com o histórico completo carregado');
assert.match(fn, /pronto && typeof mensagensDoCliente==='function'/, 'não conta mensagens antes do histórico completo');
assert.match(fn, /contando mensagens…/, 'mostra "contando…" enquanto carrega');
console.log('v898-barra-sem-piscar: ok');
