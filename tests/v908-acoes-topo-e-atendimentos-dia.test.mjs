import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v908 — (13) as ações do lead subiram pra barra de ícones do topo; (12) tela Atendimentos por dia.

// 13: a barra de ícones do topo ganhou Proposta/Arquivar/Mensagens/Excluir (padrão .cp704-ico).
const toolbar = app.match(/<div class="cp704-toolbar">[\s\S]*?<span class="lb">Reanalisar<\/span>/)[0];
assert.match(toolbar, /<span class="lb">Proposta<\/span>/, 'ícone Proposta no topo');
assert.match(toolbar, /<span class="lb">Arquivar<\/span>/, 'ícone Arquivar no topo');
assert.match(toolbar, /<span class="lb">Mensagens<\/span>/, 'ícone Mensagens no topo');
assert.match(toolbar, /cp704-ico-danger[\s\S]*?<span class="lb">Excluir<\/span>/, 'ícone Excluir (danger) no topo');
// A função que abre o histórico e o card recolhível existem; o card antigo saiu.
assert.match(app, /window\.cp704ToggleHistorico=function\(\)\{/, 'toggle do histórico existe');
assert.match(app, /class="cp704-card cp704-hist-card" id="cp704HistCard" hidden/, 'card de mensagens recolhível');
assert.doesNotMatch(app, /Ferramentas e ações/, 'card "Ferramentas e ações" removido');
assert.doesNotMatch(app, /function cp704ToolsFlat/, 'cp704ToolsFlat removida');
assert.match(app, /\.cp704-ico-danger\{/, 'CSS do ícone de perigo');

// 12: tela Atendimentos por dia (colunas), nomes só (sem "atendido há X" nem produto).
assert.match(app, /class="cp788-days"/, 'grade de dias existe');
assert.match(app, /class="cp788-day-name"/, 'cada cliente é um nome clicável na coluna do dia');
assert.match(app, /perDay\[d\]\.itens\.push\(x\)/, 'agrupa atendimentos por dia');
assert.doesNotMatch(app, /function cp788LinhaAtendimento/, 'linha antiga (com "atendido há X" + produto) removida');
assert.doesNotMatch(app, /function cp788TempoAtendimento/, '"atendido há X" removido');
assert.match(css, /\.cp788-days\{display:flex/, 'CSS: colunas por dia (linha rolável)');
assert.match(css, /\.cp788-day \.cp788-predio\{width:100%;max-width:110px/, 'prédio grande, ocupando a coluna');

console.log('v908-acoes-topo-e-atendimentos-dia: ok');
