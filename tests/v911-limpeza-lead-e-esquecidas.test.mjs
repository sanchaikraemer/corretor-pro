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

// 6. v1095 — "Oportunidades esquecidas" não foi mais reformada: foi REMOVIDA inteira, por ordem
// do dono ("só ativo ou arquivado, ponto final" — nenhum outro nome pra cliente). As duas funções
// que este bloco verificava saíram junto. O que passa a ser protegido aqui é a remoção.
assert.doesNotMatch(app, /function leadsEsquecidos\b/, 'a lista de "esquecidos" não pode voltar');
assert.doesNotMatch(app, /function radarRowHTML\b/, 'o cartão daquela lista não pode voltar');
assert.doesNotMatch(html, /Oportunidades esquecidas/i, 'nem o título pode reaparecer');

console.log('v911-limpeza-lead-e-esquecidas: ok');
