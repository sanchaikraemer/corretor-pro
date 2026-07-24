import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v981 — o dono atendeu mais de 10 leads no dia e o cartão "Você já atendeu os 10 de hoje"
// continuava mostrando "10", parado, como se tivesse travado. Causa: o texto usava sempre
// CP_DOSE_DIA (a META fixa, "10"), nunca o total REAL de atendidos hoje — então quem passava da
// meta via um número que não mudava mais pro resto do dia. Fix: usa cpAtendidosHojeTotal(items),
// a mesma contagem já usada pelo banner da Home (v980) — mostra 11, 12, etc. de verdade.

const iniRBH = app.indexOf('function renderBotoesHome(){');
const fimRBH = app.indexOf('\nfunction ', iniRBH + 1);
assert.ok(iniRBH !== -1 && fimRBH !== -1, 'renderBotoesHome não encontrada em app.js');
const rbh = app.slice(iniRBH, fimRBH);

assert.doesNotMatch(rbh, /Você já atendeu os \$\{CP_DOSE_DIA\} de hoje/,
  'o texto não pode mais depender do valor fixo da meta (CP_DOSE_DIA)');
assert.match(rbh, /Você já atendeu \$\{atendidosHojeReal\} hoje/,
  'o texto precisa mostrar o total real de atendidos hoje');
assert.match(rbh, /const atendidosHojeReal = typeof cpAtendidosHojeTotal === 'function' \? cpAtendidosHojeTotal\(items\)/,
  'o total real precisa vir de cpAtendidosHojeTotal(items) — a mesma contagem do banner da Home');

console.log('v981-dose-batida-mostra-total-real: ok');
