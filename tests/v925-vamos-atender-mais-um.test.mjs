import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v925 — pedido do dono: bater a meta de hoje ("Fazer agora: 0") não devia só mostrar "Tudo em
// dia" — o objetivo do app é converter venda, então na tela some um convite pra continuar:
// "Vamos atender mais um?", puxando mais um lead da fila além da meta (mesmo mecanismo de
// "Atender +1" que já existia em abrirFazerAgora, via state.fazerAgoraExtra).

const iniRBH = app.indexOf('function renderBotoesHome(){');
const fimRBH = app.indexOf('\nfunction ', iniRBH + 1);
assert.ok(iniRBH !== -1 && fimRBH !== -1, 'renderBotoesHome não encontrada em app.js');
const rbh = app.slice(iniRBH, fimRBH);

// 1. O extra pedido na sessão (mesma variável do abrirFazerAgora) é puxado da FILA RANQUEADA
// completa (cpFilaFazerAgora — a mesma que alimenta o número e o "Atender +1"), não só do balde
// categorizado "acao-hoje" (que pode estar vazio com tudo "aguardando cliente" — v926).
assert.match(rbh, /const extraHoje ?= ?Math\.max\(0, ?Number\(state\.fazerAgoraExtra\|\|0\)\)/,
  'renderBotoesHome deve ler state.fazerAgoraExtra');
assert.match(rbh, /const filaCompleta ?= ?typeof cpFilaFazerAgora ?=== ?'function' ?\? ?cpFilaFazerAgora\(items\) ?: ?\[\]/,
  'o extra deve vir da fila ranqueada completa (cpFilaFazerAgora), não só do balde categorizado');
assert.match(rbh, /const urgentes ?= ?doseBase\.concat\(extrasPuxados\)/, 'a dose mostrada = base categorizada + extras puxados da fila completa');

// 2. Quando a meta bate (urgentes vazio) mas ainda tem gente na fila COMPLETA, convida a continuar.
assert.match(rbh, /const disponiveisParaPuxar ?= ?filaCompleta\.filter\(l ?=> ?!idsNaDoseBase\.has\(String\(l\.id\)\)\)/,
  'disponibilidade pra puxar mais deve vir da fila completa, não só do balde categorizado (v926)');
assert.match(rbh, /else if\(disponiveisParaPuxar\.length\)/, 'o convite aparece quando sobra gente na fila completa');
assert.match(rbh, /Meta de hoje batida/i, 'mensagem de meta batida presente');
assert.match(rbh, /Vamos atender mais um\?/, 'texto do convite "Vamos atender mais um?"');
assert.match(rbh, /onclick="cpAtenderMaisUmHoje\(\)"/, 'o botão chama cpAtenderMaisUmHoje()');

// 3. "Ver todas as oportunidades" continua acessível mesmo nesse estado (temLista considera a fila completa).
assert.match(rbh, /const temLista ?= ?urgentes\.length ?> ?0 ?\|\| ?retomada\.length ?> ?0 ?\|\| ?disponiveisParaPuxar\.length ?> ?0/,
  'temLista deve considerar disponiveisParaPuxar (fila completa), não só o balde categorizado');

// 4. cpAtenderMaisUmHoje existe, soma o extra e re-renderiza a Home, exposta no window.
const fnSrc = app.match(/function cpAtenderMaisUmHoje\(\)\{[\s\S]*?\n\}/);
assert.ok(fnSrc, 'cpAtenderMaisUmHoje não encontrada em app.js');
assert.match(fnSrc[0], /state\.fazerAgoraExtra ?= ?Math\.max\(0, ?Number\(state\.fazerAgoraExtra\|\|0\)\) ?\+ ?1/,
  'cpAtenderMaisUmHoje incrementa o mesmo contador usado no abrirFazerAgora');
assert.match(fnSrc[0], /renderBotoesHome\(\)/, 'cpAtenderMaisUmHoje re-renderiza a Home depois de puxar mais um');
assert.match(app, /window\.cpAtenderMaisUmHoje ?= ?cpAtenderMaisUmHoje/, 'cpAtenderMaisUmHoje precisa estar no window');

console.log('v925-vamos-atender-mais-um: ok');
