import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v866 #6: a tela Desempenho tinha DOIS painéis com os mesmos números. O de baixo
// ("Ritmo comercial", renderizado em #relatorioBody) foi removido.
assert.doesNotMatch(html, /id="relatorioBody"/, 'o painel duplicado (#relatorioBody) precisa sair da tela Desempenho');

// v866 #7 / v873: o Menu não pode DUPLICAR o menu lateral no DESKTOP — mas no MOBILE (que não
// tem menu lateral) essas funções PRECISAM estar no Menu. Solução: os cards existem com a classe
// menu-nav-item e um CSS os esconde no desktop (min-width:1000px). Aqui garantimos as duas coisas.
for(const titulo of ['Condução do atendimento', 'Gerador de proposta', 'Cérebro Comercial', 'Desempenho', 'Arquivados']){
  assert.match(
    html,
    new RegExp('menu-card menu-nav-item[^>]*>\\s*<div class="menu-card-ico">[^<]*</div><div class="menu-card-txt"><div class="menu-card-titulo">' + titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `o card "${titulo}" precisa existir no Menu como menu-nav-item (mobile)`
  );
}
const cssLimpeza = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
assert.match(cssLimpeza, /@media\(min-width:1000px\)\{\s*\.menu-nav-item\{\s*display:none!important/, 'no desktop os itens do Menu que repetem a lateral precisam ficar escondidos');

// Os que NÃO estão na lateral continuam no Menu (em qualquer tela).
// (v904: o card "Vendas registradas" foi removido — só "Arquivar" existe como desfecho.)
for(const titulo of ['Importar conversa', 'Como usar', 'O que a IA aprendeu', 'Instalar app']){
  assert.match(html, new RegExp('menu-card-titulo">' + titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `o card "${titulo}" deve continuar no Menu`);
}

// v894: o topo do lead virou a barra de ícones (Modelo 2); Reanalisar continua sendo o 1º.
const acoes = app.match(/cp704-toolbar">[\s\S]{0,1700}/);
assert.ok(acoes, 'não achei a barra de ícones do topo do lead');
assert.ok(
  acoes[0].indexOf('Reanalisar') < acoes[0].indexOf('Agendar'),
  'o Reanalisar precisa vir antes de "Agendar" (primeiro/acesso rápido)'
);

console.log('v866-ui-limpeza: ok');
