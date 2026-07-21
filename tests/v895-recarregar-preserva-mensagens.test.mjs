import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v895 — bug: marcar/desmarcar atendimento fazia a barra "Interesse do cliente" despencar
// (ex.: 108 -> 4 mensagens). Causa: recarregarLeadFoco recarregava o lead a partir da LISTA
// (que traz só um recorte das mensagens) e sobrescrevia o histórico completo já aberto.
// Correção: preserva as recentMessages/historyLoaded/messageCount quando a versão local é maior.

const fn = app.match(/async function recarregarLeadFoco\(id\)\{[\s\S]*?\n\}/)[0];
assert.ok(fn, 'recarregarLeadFoco precisa existir');
assert.match(fn, /const msgsLocal=Array\.isArray\(localAntes\?\.recentMessages\)/, 'lê as mensagens da versão aberta');
assert.match(fn, /if\(msgsLocal\.length>msgsFresh\.length\)\{/, 'só preserva quando a versão aberta tem mais mensagens');
assert.match(fn, /atualizado\.recentMessages=msgsLocal/, 'preserva o histórico completo no recarregamento');
assert.match(fn, /atualizado\.messageCount=localAntes\.messageCount/, 'preserva também a contagem total');

console.log('v895-recarregar-preserva-mensagens: ok');
