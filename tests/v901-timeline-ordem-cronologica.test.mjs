import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v901 — a linha do tempo do histórico estava misturando o horário das mensagens. O merge
// que monta recentMessages ordena por `iso`, mas as mensagens manuais/copiadas guardam `iso`
// em UTC enquanto exibem data/hora no fuso BR — inconsistente, embaralhando a ordem visível.
// A correção passa a ordenar pela data/hora EXIBIDA (cp704MsgTsCronologico) antes de renderizar.

// 1. cp704MsgTsCronologico executa e deriva um timestamp comparável de date/time BR.
const fn = app.match(/function cp704MsgTsCronologico\(m\)\{[\s\S]*?\n  \}/)[0];
const cp704MsgTsCronologico = eval(`(${fn.replace(/^function cp704MsgTsCronologico/, 'function')})`);

const bomDia = { date: '21/07/2026', time: '11:56', iso: '2026-07-21T14:56:00Z', text: 'Bom dia' };
const voceCerto = { date: '21/07/2026', time: '12:24', iso: '2026-07-21T15:24:00Z', text: 'Certo amigo' };
const abrs = { date: '21/07/2026', time: '11:58', iso: '2026-07-21T14:58:00Z', text: 'Abrs' };

// Ordena pela hora exibida: 11:56 < 11:58 < 12:24
const ordenado = [voceCerto, bomDia, abrs].slice()
  .sort((a,b)=>cp704MsgTsCronologico(a)-cp704MsgTsCronologico(b));
assert.deepEqual(ordenado.map(m=>m.time), ['11:56','11:58','12:24'], 'ordena pela hora exibida');

// 2. Quando não há date/time BR, cai no iso.
const soIso = { iso: '2026-07-20T10:00:00Z' };
const soIso2 = { iso: '2026-07-21T10:00:00Z' };
assert.ok(cp704MsgTsCronologico(soIso) < cp704MsgTsCronologico(soIso2), 'fallback usa iso');

// 3. cp704TimelineHtml ordena o array `all` por cp704MsgTsCronologico antes de renderizar.
const timeline = app.match(/function cp704TimelineHtml\(lead\)\{[\s\S]*?const total=all\.length;/)[0];
assert.match(timeline, /\.sort\(\(a,b\)=>cp704MsgTsCronologico\(a\)-cp704MsgTsCronologico\(b\)/,
  'a timeline ordena cronologicamente pela hora exibida');

console.log('v901-timeline-ordem-cronologica: ok');
