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

// 1. A dose do dia vem da FILA RANQUEADA completa, e o extra (state.fazerAgoraExtra)
// puxa além da meta.
// v1139 — a Home passou a puxar a fila JÁ com as vagas de resgate aplicadas
// (cpFilaFazerAgoraComResgates, que por dentro é a mesma cpFilaFazerAgora reordenada);
// o fallback continua sendo a fila ranqueada crua.
assert.match(rbh, /let filaRanqueada ?= ?typeof cpFilaFazerAgoraComResgates ?=== ?'function' ?\? ?cpFilaFazerAgoraComResgates\(items\)/,
  'a dose deve vir da fila com as vagas de resgate (v1139)');
assert.match(rbh, /typeof cpFilaFazerAgora === 'function' \? cpFilaFazerAgora\(items\) : \[\]/,
  'o fallback continua sendo a fila ranqueada completa (cpFilaFazerAgora)');
assert.match(rbh, /const extraHoje ?= ?Math\.max\(0, ?Number\(state\.fazerAgoraExtra\|\|0\)\)/,
  'renderBotoesHome deve ler state.fazerAgoraExtra pra puxar mais um');
assert.match(rbh, /const dose ?= ?filaRanqueada\.slice\(0, ?quantosMostrar\)/,
  'a dose = topo da fila ranqueada até a meta (+ extras)');

// 2. v1278 — o botão "Atender mais um" (um cliente por clique) foi SUBSTITUÍDO pela lista da
// fila logo abaixo da lista do dia. O que continua garantido aqui: sobrando fila, ela aparece.
assert.match(rbh, /filaAbaixoHtml\(disponiveisParaPuxar\)/, 'o resto da fila precisa ser listado embaixo da lista do dia');
assert.doesNotMatch(rbh, /cpAtenderMaisUmHoje\(\)/, 'o botão "Atender mais um" da Home saiu na v1278');

// 3. O card amarelo antigo NÃO existe mais em lugar nenhum da Home.
assert.doesNotMatch(rbh, /Meta de hoje batida/, 'o card "Meta de hoje batida" foi removido (pedido do dono)');
assert.doesNotMatch(rbh, /Nenhum lead prioritário/, 'o card "Nenhum lead prioritário" foi removido (pedido do dono)');

// 4. v1278 — cpAtenderMaisUmHoje não existe mais em lugar nenhum do app; quem revela mais fila
// agora é cpMostrarMaisFilaHoje, que abre o próximo BLOCO da lista (não um cliente por clique).
assert.doesNotMatch(app, /function cpAtenderMaisUmHoje/, 'cpAtenderMaisUmHoje foi removida na v1278');
assert.doesNotMatch(app, /window\.cpAtenderMaisUmHoje/, 'cpAtenderMaisUmHoje não pode continuar exposta no window');
assert.doesNotMatch(app, /cpAtenderMaisUmHoje\(\)/, 'nada pode mais chamar cpAtenderMaisUmHoje');
const fnSrc = app.match(/function cpMostrarMaisFilaHoje\(\)\{[\s\S]*?\n\}/);
assert.ok(fnSrc, 'cpMostrarMaisFilaHoje não encontrada em app.js');
assert.match(fnSrc[0], /state\.cp1278FilaLimite ?=/, 'cpMostrarMaisFilaHoje aumenta o limite da lista da fila');
assert.match(fnSrc[0], /renderBotoesHome\(\)/, 'cpMostrarMaisFilaHoje re-renderiza a Home depois de abrir mais fila');
assert.match(app, /window\.cpMostrarMaisFilaHoje ?= ?cpMostrarMaisFilaHoje/, 'cpMostrarMaisFilaHoje precisa estar no window');

// 5. O botão "Atender +1" da lista do card "Fazer agora" (outra tela) NÃO foi mexido — ele tem
// contador próprio e continua puxando de um em um lá dentro.
assert.match(app, /b\.textContent ?= ?'Atender \+1'/, 'o "Atender +1" do card "Fazer agora" continua existindo');

console.log('v925-vamos-atender-mais-um: ok');
