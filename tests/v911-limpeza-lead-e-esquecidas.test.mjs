import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// v911 — 6 remoções/limpezas pedidas pelo dono.

// 1. Chip/etiqueta (papel do contato) embaixo do nome do lead — removido.
assert.doesNotMatch(app, /class="cp704-tags"/, 'chip embaixo do nome do lead removido');
assert.doesNotMatch(app, /<span class="cp704-tag">\$\{escapeHtml\(cp704Text\(mc\?\.contato\?\.papel/,
  'sem o chip do papel do contato embaixo do nome');

// 2. Ícone "Excluir" saiu do topo do lead (fica só dentro do Editar).
assert.doesNotMatch(app, /title="Excluir definitivamente"><svg/, 'sem ícone Excluir no topo');
assert.match(app, /id="editLeadExcluir"/, 'Excluir continua dentro do Editar (Zona perigosa)');

// 3. "Como usar" saiu do Menu.
assert.doesNotMatch(html, /menu-card-titulo">Como usar/, 'card "Como usar" removido do Menu');

// 4. Raio-X da carteira removido de vez.
assert.doesNotMatch(app, /raiox-mobile|function insightFocoHTML|function abrirRaioX/, 'Raio-X removido');

// 5. "Últimos atendimentos" saiu da home.
assert.doesNotMatch(app, /abrirUltimosAtendimentos/, '"Últimos atendimentos" removido da home');

// 6. "Oportunidades esquecidas" reformada: fato real, mais antigos primeiro, máx 10.
const esq = app.match(/function leadsEsquecidos\(items\)\{[\s\S]*?\n\}/)[0];
assert.match(esq, /temAtendimentoManual\(l\) \|\| mensagensDoCliente\(l\) >= CP_MIN_MSGS_PRIORIDADE/, 'entra por fato real (atendeu ou conversou)');
assert.doesNotMatch(esq, /pesoRecuperacao|leadTemProposta|Visita\/Proposta|Negociação/, 'sem etapa/proposta no ranking');
assert.match(esq, /out\.sort\(\(a,b\) => b\.parado - a\.parado\)/, 'ordena por mais tempo parado (mais antigos primeiro)');
assert.match(esq, /out\.slice\(0, 10\)/, 'no máximo 10');
const radar = app.match(/function radarRowHTML\(l\)\{[\s\S]*?\n\}/)[0];
assert.doesNotMatch(radar, /Alta|Média|Baixa|negociação aberta|visita\/proposta em jogo/, 'sem rótulo Alta/Média nem etapa no card');
assert.match(radar, /você já atendeu|msg.* do cliente/, 'o card mostra o fato real');

console.log('v911-limpeza-lead-e-esquecidas: ok');
