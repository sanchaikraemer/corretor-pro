import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v925 (original) — bater a meta do dia não fecha a porta: dá pra puxar mais um lead da fila.
// v942 — o card grande "Meta de hoje batida" / "Nenhum lead prioritário" foi removido (pedido do
// dono). O mecanismo "Atender mais um" continua, agora como um botão discreto abaixo da lista dos
// leads do dia (mesma variável de sessão state.fazerAgoraExtra), puxando da FILA RANQUEADA
// completa (cpFilaFazerAgora).

const iniRBH = app.indexOf('function renderBotoesHome(){');
const fimRBH = app.indexOf('\nfunction ', iniRBH + 1);
assert.ok(iniRBH !== -1 && fimRBH !== -1, 'renderBotoesHome não encontrada em app.js');
const rbh = app.slice(iniRBH, fimRBH);

// 1. A dose do dia vem da FILA RANQUEADA completa (cpFilaFazerAgora), e o extra (state.fazerAgoraExtra)
// puxa além da meta.
assert.match(rbh, /let filaRanqueada ?= ?typeof cpFilaFazerAgora ?=== ?'function' ?\? ?cpFilaFazerAgora\(items\) ?: ?\[\]/,
  'a dose deve vir da fila ranqueada completa (cpFilaFazerAgora)');
assert.match(rbh, /const extraHoje ?= ?Math\.max\(0, ?Number\(state\.fazerAgoraExtra\|\|0\)\)/,
  'renderBotoesHome deve ler state.fazerAgoraExtra pra puxar mais um');
assert.match(rbh, /const dose ?= ?filaRanqueada\.slice\(0, ?quantosMostrar\)/,
  'a dose = topo da fila ranqueada até a meta (+ extras)');

// 2. Botão "Atender mais um" quando ainda há fila, chamando cpAtenderMaisUmHoje.
assert.match(rbh, /cp-atender-mais[\s\S]*?cpAtenderMaisUmHoje\(\)/, 'mostra o botão "Atender mais um" quando sobra fila');

// 3. O card amarelo antigo NÃO existe mais em lugar nenhum da Home.
assert.doesNotMatch(rbh, /Meta de hoje batida/, 'o card "Meta de hoje batida" foi removido (pedido do dono)');
assert.doesNotMatch(rbh, /Nenhum lead prioritário/, 'o card "Nenhum lead prioritário" foi removido (pedido do dono)');

// 4. cpAtenderMaisUmHoje continua: soma o extra e re-renderiza a Home, exposta no window.
const fnSrc = app.match(/function cpAtenderMaisUmHoje\(\)\{[\s\S]*?\n\}/);
assert.ok(fnSrc, 'cpAtenderMaisUmHoje não encontrada em app.js');
assert.match(fnSrc[0], /state\.fazerAgoraExtra ?= ?Math\.max\(0, ?Number\(state\.fazerAgoraExtra\|\|0\)\) ?\+ ?1/,
  'cpAtenderMaisUmHoje incrementa o mesmo contador (state.fazerAgoraExtra)');
assert.match(fnSrc[0], /renderBotoesHome\(\)/, 'cpAtenderMaisUmHoje re-renderiza a Home depois de puxar mais um');
assert.match(app, /window\.cpAtenderMaisUmHoje ?= ?cpAtenderMaisUmHoje/, 'cpAtenderMaisUmHoje precisa estar no window');

console.log('v925-vamos-atender-mais-um: ok');
