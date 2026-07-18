import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v873: no CELULAR não há menu lateral (a barra de baixo só tem Hoje/Atendimentos/Agenda/Mais),
// então o Menu é o único acesso a Condução, Propostas, Cérebro, Desempenho e Arquivados. A v866
// tinha removido esses itens do Menu (certo pro desktop, que tem a lateral) e sumiu com eles no
// mobile. Agora eles voltam como "menu-nav-item" (escondidos só no desktop) e navegam certo.

const destinos = [
  ['pipeline', 'Condução do atendimento'],
  ['propostas', 'Gerador de proposta'],
  ['relatorio', 'Desempenho'],
  ['geladeira', 'Arquivados'],
];
for(const [alvo, titulo] of destinos){
  assert.match(
    html,
    new RegExp('menu-card menu-nav-item go" data-target="' + alvo + '"[\\s\\S]*?menu-card-titulo">' + titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `"${titulo}" precisa navegar pra ${alvo} no Menu (mobile)`
  );
}
// Cérebro Comercial usa onclick (abre a aba do cérebro).
assert.match(html, /menu-card menu-nav-item" onclick="show\('cerebro'\);icTab\('cerebro'\)"[\s\S]*?Cérebro Comercial/, 'Cérebro Comercial precisa abrir a tela do cérebro');

// Escondidos no desktop, visíveis no mobile.
assert.match(css, /@media\(min-width:1000px\)\{\s*\.menu-nav-item\{\s*display:none!important/, 'menu-nav-item some no desktop');

console.log('v873-menu-mobile: ok');
