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

// 1. A meta efetiva de hoje soma o extra pedido na sessão (mesma variável do abrirFazerAgora).
assert.match(rbh, /const extraHoje ?= ?Math\.max\(0, ?Number\(state\.fazerAgoraExtra\|\|0\)\)/,
  'renderBotoesHome deve somar state.fazerAgoraExtra na meta efetiva de hoje');
assert.match(rbh, /const metaEfetiva ?= ?metaHoje ?\+ ?extraHoje/,
  'a meta efetiva = meta de hoje + o extra pedido');
assert.match(rbh, /urgentesRanqueados\.slice\(0, ?metaEfetiva\)/, 'a dose mostrada usa a meta efetiva (não só a meta crua)');

// 2. Quando a meta bate (urgentes vazio) mas ainda tem gente na fila, convida a continuar.
assert.match(rbh, /backlogAlemDaDose\.length/, 'checa se sobrou gente na fila além da meta batida');
assert.match(rbh, /Meta de hoje batida/i, 'mensagem de meta batida presente');
assert.match(rbh, /Vamos atender mais um\?/, 'texto do convite "Vamos atender mais um?"');
assert.match(rbh, /onclick="cpAtenderMaisUmHoje\(\)"/, 'o botão chama cpAtenderMaisUmHoje()');

// 3. "Ver todas as oportunidades" continua acessível mesmo nesse estado (temLista considera o backlog).
assert.match(rbh, /const temLista ?= ?urgentes\.length ?> ?0 ?\|\| ?retomada\.length ?> ?0 ?\|\| ?backlogAlemDaDose\.length ?> ?0/,
  'temLista deve considerar também o backlog além da dose');

// 4. cpAtenderMaisUmHoje existe, soma o extra e re-renderiza a Home, exposta no window.
const fnSrc = app.match(/function cpAtenderMaisUmHoje\(\)\{[\s\S]*?\n\}/);
assert.ok(fnSrc, 'cpAtenderMaisUmHoje não encontrada em app.js');
assert.match(fnSrc[0], /state\.fazerAgoraExtra ?= ?Math\.max\(0, ?Number\(state\.fazerAgoraExtra\|\|0\)\) ?\+ ?1/,
  'cpAtenderMaisUmHoje incrementa o mesmo contador usado no abrirFazerAgora');
assert.match(fnSrc[0], /renderBotoesHome\(\)/, 'cpAtenderMaisUmHoje re-renderiza a Home depois de puxar mais um');
assert.match(app, /window\.cpAtenderMaisUmHoje ?= ?cpAtenderMaisUmHoje/, 'cpAtenderMaisUmHoje precisa estar no window');

console.log('v925-vamos-atender-mais-um: ok');
