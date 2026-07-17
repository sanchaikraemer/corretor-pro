import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v866 #6: a tela Desempenho tinha DOIS painéis com os mesmos números. O de baixo
// ("Ritmo comercial", renderizado em #relatorioBody) foi removido.
assert.doesNotMatch(html, /id="relatorioBody"/, 'o painel duplicado (#relatorioBody) precisa sair da tela Desempenho');

// v866 #7: o Menu (Configurações) repetia itens que já estão no menu lateral. Esses cards saíram.
for(const titulo of ['Condução do atendimento', 'Gerador de proposta', 'Cérebro Comercial', 'Relatório', 'Arquivados']){
  assert.doesNotMatch(
    html,
    new RegExp('menu-card-titulo">' + titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `o card "${titulo}" precisa sair do Menu (já está no menu lateral)`
  );
}
// Os que NÃO estão na lateral continuam no Menu.
for(const titulo of ['Importar conversa', 'Como usar', 'O que a IA aprendeu', 'Vendas registradas', 'Instalar app']){
  assert.match(html, new RegExp('menu-card-titulo">' + titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `o card "${titulo}" deve continuar no Menu`);
}

// v866 #8: "Reanalisar" ganhou destaque e virou o primeiro botão do topo do lead.
assert.match(app, /cp704-reanalyse cp704-reanalyse-destaque/, 'o Reanalisar precisa ter a classe de destaque');
assert.match(app, /\.cp704-reanalyse-destaque\{/, 'o CSS de destaque do Reanalisar precisa existir');
const acoes = app.match(/<div class="cp704-top-actions">[\s\S]*?<\/div>/);
assert.ok(acoes, 'não achei a barra de ações do topo do lead');
assert.ok(
  acoes[0].indexOf('Reanalisar') < acoes[0].indexOf('Agendar retorno'),
  'o Reanalisar precisa vir antes de "Agendar retorno" (primeiro/acesso rápido)'
);

console.log('v866-ui-limpeza: ok');
