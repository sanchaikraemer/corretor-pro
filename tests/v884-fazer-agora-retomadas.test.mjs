import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v884/v885 — "Fazer agora" não é mais 0 (rígido) nem 207 (backlog inteiro): é a DOSE do dia
// (top CP_DOSE_DIA da fila ranqueada). O clique abre a dose + a fila de retomada (backlog).

// 1. cpPrecisaAcaoHoje = a categoria de ação (a fila do "Fazer agora").
assert.match(app, /function cpPrecisaAcaoHoje\(l\)\{ return cp786Categoria\(l\)==='agora'; \}/,
  'cpPrecisaAcaoHoje deve ser o alias de cp786Categoria==="agora"');

// 2. O card usa a DOSE (min(fila, CP_DOSE_DIA)) e abre a lista real.
const rd = app.match(/renderResumoDia = function\(items\)\{[\s\S]*?\n\};/)[0];
assert.match(rd, /const fila=cpFilaFazerAgora\(ativos\);/, 'renderResumoDia deve montar a fila ranqueada');
assert.match(rd, /Math\.min\(fila\.length, CP_DOSE_DIA\)/, 'fazerAgora deve ser a dose (teto CP_DOSE_DIA)');
assert.match(rd, /onclick="abrirFazerAgora\(\)"/, 'o card "Fazer agora" abre abrirFazerAgora()');
assert.doesNotMatch(rd, /onclick="cp786AbrirConducao\('agora'\)"/, 'não abre mais o filtro vazio do pipeline');

// 3. abrirFazerAgora mostra a dose e o backlog (resto) — nada some.
const af = app.match(/function abrirFazerAgora\(\)\{[\s\S]*?\n\}/)[0];
assert.match(af, /cpFilaFazerAgora\(ativos\)/, 'abrirFazerAgora usa a fila ranqueada');
assert.match(af, /slice\(0, CP_DOSE_DIA\)/, 'a dose é o top CP_DOSE_DIA');
assert.match(af, /slice\(CP_DOSE_DIA\)/, 'o resto (backlog) continua acessível');
assert.match(af, /abrirGrupoHome\('__fazeragora'/, 'abre a lista via abrirGrupoHome');
assert.match(app, /window\.abrirFazerAgora ?= ?abrirFazerAgora/, 'abrirFazerAgora precisa estar no window');

console.log('v884-fazer-agora-retomadas: ok');
