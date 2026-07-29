import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url).pathname, 'utf8');

// v931 — o dono percebeu que "Ver todas as oportunidades" (Home) e "Condução do atendimento"
// (Menu) levavam pro MESMO destino (show('pipeline')), sem nenhuma diferença — "não seja
// redundante". abrirTodosLeads/.navTodos/temLista (só existiam pra esse link da Home) saíram.

assert.doesNotMatch(app, /class="ver-todas"/, 'o botão duplicado não deve mais existir na Home');
assert.doesNotMatch(app, /onclick='abrirTodosLeads\(\)'/, 'sem onclick chamando abrirTodosLeads');
assert.doesNotMatch(app, /function abrirTodosLeads/, 'abrirTodosLeads (só usada por esse link) foi removida');
assert.doesNotMatch(app, /window\.abrirTodosLeads/, 'sem export órfão de abrirTodosLeads');
assert.doesNotMatch(app, /\.navTodos/, 'listener órfão .navTodos removido');
assert.doesNotMatch(app, /const temLista ?=/, 'temLista (só existia pra decidir mostrar o link) removida');

// v1075 — a própria tela Condução foi deletada (pedido do dono): as listas da Home são o
// único destino agora, então nenhum código pode voltar a navegar pra ela.
assert.doesNotMatch(app, /show\('pipeline'\)|show\("pipeline"\)/, 'nenhum código pode abrir a tela deletada');
assert.match(app, /function abrirFazerAgora\(/, 'a lista "Fazer agora" da Home é o destino vivo');

console.log('v931-sem-porta-redundante: ok');
