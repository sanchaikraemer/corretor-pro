import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../api/reanalisar-lead.js', import.meta.url), 'utf8');

// v893 — bug: desmarcou (toast ok) mas o botão continuou "Atendido hoje". Causa: só removia o
// evento do botão (botao_atendido), mas "Atendido hoje" liga com QUALQUER contato_manual do dia.
// Correção: desmarcar limpa TODO contato_manual de hoje, então ehContatadoHoje vira false.

// API: filtro não restringe mais a botao_atendido.
const bloco = api.slice(api.indexOf('body?.action === "desmarcar-atendido"'), api.indexOf('reagendar-lembrete'));
assert.doesNotMatch(bloco, /detalhes\?\.de !== "botao_atendido"/, 'API não pode limitar a remoção ao botão');
assert.match(bloco, /e\?\.evento !== "contato_manual" \|\| !e\?\.quando\) return true/, 'API remove qualquer contato_manual do dia');

// Front: remoção local idem.
const fn = app.match(/function ui667RemoverAtendidoLocal\(lead\)\{[\s\S]*?\n\}/)[0];
assert.doesNotMatch(fn, /de!=='botao_atendido'/, 'remoção local não pode limitar ao botão');
assert.match(fn, /if\(e\?\.evento!=='contato_manual'\|\|!e\?\.quando\) return true/, 'remoção local considera todo contato_manual do dia');

console.log('v893-desmarcar-limpa-tudo: ok');
