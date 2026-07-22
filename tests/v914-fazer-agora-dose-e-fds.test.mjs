import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v914 — "Fazer agora": todo dia útil até 10 (rank por msgs do cliente), botão "Atender +1",
// fim de semana = "Final de semana". + Atendimentos no PC: sem rolagem horizontal, nomes finos.

// 1. cpFilaFazerAgora reformada + executável.
const fdsSrc = app.match(/function cpFimDeSemana\(\)\{[\s\S]*?\n\}/)[0];
const filaSrc = app.match(/function cpFilaFazerAgora\(items\)\{[\s\S]*?\n\}/)[0];
const fila = eval(`
  const CP_DOSE_DIA = 10;
  const leadEhAtivo = () => true;
  const ehContatadoHoje = (l) => !!l.__hoje;
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  const cp786TemCompromisso = () => false;
  const diasParado = (l) => Number(l.__parado||0);
  ${fdsSrc}
  ${filaSrc}
  cpFilaFazerAgora;
`);
// Num dia de semana (2ª a 6ª) rankeia por mensagens do cliente; atendido-hoje sai.
const hoje = new Date();
const ehFds = hoje.getDay() === 0 || hoje.getDay() === 6;
const pool = [
  { id:'a', __msgs:3, __parado:10 },
  { id:'b', __msgs:9, __parado:2 },
  { id:'c', __msgs:9, __parado:40 },
  { id:'d', __msgs:5, __parado:1, __hoje:true }, // atendido hoje → fora
  { id:'e', __msgs:0, __parado:99 },             // sem msg do cliente → fora
];
const r = fila(pool).map(l => l.id);
if(ehFds){
  assert.deepEqual(r, [], 'fim de semana → fila vazia');
} else {
  assert.deepEqual(r, ['c','b','a'], 'rank por msgs do cliente (desempate: mais parado); sem atendido-hoje/sem-msg');
}

// 2. Dose helper + botão Atender +1 + fim de semana no card.
// v924: a dose é a META do dia (10) menos quem já foi atendido hoje (cpAtendidosHojeTotal) —
// ver tests/v924-fazer-agora-meta-decrescente.test.mjs pra cobertura completa do comportamento.
assert.match(app, /function cpFazerAgoraDose\(items\)\{ return cpFimDeSemana\(\) \? 0 : Math\.max\(0, CP_DOSE_DIA - cpAtendidosHojeTotal\(items\)\); \}/, 'dose = meta menos atendidos hoje, 0 no fds');
assert.match(app, /Atender \+1/, 'botão "Atender +1"');
assert.match(app, /Final de semana/, 'card mostra "Final de semana"');
assert.match(css, /\.cp-atender-mais\{/, 'CSS do botão Atender +1');

// 3. Atendimentos no PC: grid de 7 colunas (sem rolagem horizontal) e nomes finos (sem negrito).
assert.match(css, /\.cp788-days\{display:grid;grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/, 'PC: 7 colunas preenchem a largura (sem rolagem)');
assert.match(css, /\.cp788-day-name\{[^}]*font-weight:600/, 'nomes sem negrito');
assert.match(css, /\.cp788-day-name\{[^}]*font-size:11px/, 'nomes com fonte menor');

console.log('v914-fazer-agora-dose-e-fds: ok');
