import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v884 — o card "Fazer agora" vivia em 0 (numa carteira de imports antigos quase nada é
// "responder AGORA"), sem serventia. O dono pediu pra ele FUNCIONAR (não remover): passa a
// contar a ação real do dia = responder + RETOMAR, batendo com a saudação laranja do topo.

// 1. cpPrecisaAcaoHoje existe e combina "precisa responder" + "vale retomar", excluindo
//    quem já foi atendido hoje e quem tem compromisso futuro (Agenda).
const fn = app.match(/function cpPrecisaAcaoHoje\(l\)\{[\s\S]*?\n\}/);
assert.ok(fn, 'cpPrecisaAcaoHoje precisa existir');
const corpo = fn[0];
assert.match(corpo, /ehContatadoHoje\(l\)\)?\s*return false/, 'quem foi atendido hoje sai de "Fazer agora"');
assert.match(corpo, /cp786TemCompromisso\(l\)\)?\s*return false/, 'quem tem compromisso vai pra Agenda, não "Fazer agora"');
assert.match(corpo, /cp786Categoria\(l\)==='agora'\)?\s*return true/, 'quem precisa responder entra em "Fazer agora"');
assert.match(corpo, /entraEmRetomada\(l\)\)?\s*return true/, 'retomadas do dia entram em "Fazer agora"');

// 2. O card usa cpPrecisaAcaoHoje e abre a lista de ação de verdade (não mais o filtro 'agora'
//    do pipeline, que dava 0).
const rd = app.match(/renderResumoDia = function\(items\)\{[\s\S]*?\n\};/)[0];
assert.match(rd, /ativos\.filter\(cpPrecisaAcaoHoje\)\.length/, 'fazerAgora deve contar cpPrecisaAcaoHoje');
assert.match(rd, /onclick="abrirFazerAgora\(\)"/, 'o card "Fazer agora" deve abrir abrirFazerAgora()');
assert.doesNotMatch(rd, /onclick="cp786AbrirConducao\('agora'\)"/, 'o card não deve mais abrir o filtro vazio do pipeline');

// 3. abrirFazerAgora abre a lista avulsa (reaproveita abrirGrupoHome) e está no window.
const af = app.match(/function abrirFazerAgora\(\)\{[\s\S]*?\n\}/)[0];
assert.match(af, /ativos\.filter\(cpPrecisaAcaoHoje\)/, 'a lista aberta usa o mesmo critério do número');
assert.match(af, /abrirGrupoHome\('__fazeragora'/, 'abrirFazerAgora deve abrir a lista via abrirGrupoHome');
assert.match(app, /window\.abrirFazerAgora ?= ?abrirFazerAgora/, 'abrirFazerAgora precisa estar no window (onclick inline)');

console.log('v884-fazer-agora-retomadas: ok');
