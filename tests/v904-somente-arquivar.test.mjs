import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// v904 — o dono não usa Vendido/Perdido/Geladeira: só "Arquivar" deve existir como desfecho.
// Removidos os botões de saída e as telas de venda; o que já estava marcado assim vira "Arquivado".

// 1. Nenhum botão "Vendido" ou "Perdido" sobra na interface.
assert.doesNotMatch(app, />Vendido</, 'sem botão Vendido no app.js');
assert.doesNotMatch(app, />Perdido</, 'sem botão Perdido no app.js');
assert.doesNotMatch(html, />Vendido</, 'sem botão Vendido no index.html');
assert.doesNotMatch(html, />Perdido</, 'sem botão Perdido no index.html');

// 2. v1186 — este item mirava `cp704QuickActions`, o painel de ações do lead. A auditoria de
//    09/08/2026 descobriu que esse painel PAROU DE SER DESENHADO na v908 (as ações principais
//    subiram pra barra de ícones do topo) e ninguém percebeu: ele continuou no arquivo, e este
//    teste continuou passando porque conferia o texto do arquivo, não a tela. O painel virou
//    `cp1186MaisOpcoes`, agora de fato desenhado, com os dois botões que tinham ficado sem porta
//    de entrada — e a checagem passa a exigir que ele seja CHAMADO, não só que exista.
const quick = app.match(/function cp1186MaisOpcoes\(lead\)\{[\s\S]*?\n  \}/)[0];
assert.doesNotMatch(quick, /Encerramento/, 'sem grupo Encerramento');
assert.doesNotMatch(quick, /marcarVendido/, 'sem ação de vender');
assert.match(quick, /excluirLeadDefinitivo\(/, 'mantém Excluir definitivamente');
assert.match(app, /\$\{cp1186MaisOpcoes\(lead\)\}/,
  'o bloco de mais opções precisa ser DESENHADO na tela do lead — foi por não ser que dois botões sumiram');
// Arquivar continua existindo, agora na barra do topo (não pode ser duplicado aqui).
assert.doesNotMatch(quick, /arquivarLead\(/, 'Arquivar já está na barra do topo — não pode aparecer duas vezes');

// 3. As ações do lead (viraram ícones no topo na v908) e a barra rápida ui683 não têm Vendido.
const toolbar904 = app.match(/<div class="cp704-toolbar">[\s\S]*?<\/div><\/div>/)[0];
assert.doesNotMatch(toolbar904, /marcarVendido|abrirVenda|>Vendido</, 'ações do topo sem venda');
assert.doesNotMatch(app, /abrirVenda\(\$\{id\},\$\{nome\}\)/, 'barra rápida sem Vendido');

// 4. Leads já marcados Vendido/Perdido/Geladeira (dados legados) aparecem como "Arquivado" (sem
// esses rótulos). v1186 — este item mirava a função do funil de 6 etapas, que a v889 tirou do
// cabeçalho do lead a pedido do dono e a auditoria de 09/08/2026 removeu do arquivo. A regra em si
// não mudou de lugar: quem colapsa Vendido/Perdido/Geladeira num rótulo só é `normalizarEtapa`,
// na origem (v1069) — conferido no item 6 logo abaixo. Aqui fica a garantia de que os rótulos
// antigos não voltam a aparecer como etiqueta em lugar nenhum.
assert.doesNotMatch(app, /label:'Vendido'/, 'nenhuma tela pode rotular Vendido');
assert.doesNotMatch(app, /label:'Perdido'/, 'nenhuma tela pode rotular Perdido');
assert.match(app, /const ETAPA_ARQUIVADO\s*=/, 'a constante do valor gravado no banco precisa continuar');

// 5. As telas/cards de venda saíram do app.
assert.doesNotMatch(html, /Vendas registradas/, 'sem menu/tela "Vendas registradas"');
assert.doesNotMatch(html, /cp-metric-revenue/, 'sem tile de receita no Desempenho');
assert.doesNotMatch(html, /id="vendas"/, 'sem a tela #vendas');

// 6. O arquivo (Arquivados) segue reunindo os antigos Geladeira/Vendido/Perdido num lugar só —
// v1069: normalizarEtapa já colapsa todos eles em "Geladeira" na origem, então carregarGeladeira
// só precisa comparar com esse único valor (Perdido nunca mais é um resultado possível).
// v952: a antiga função duplicada de carregarGeladeira (que este teste mirava sem querer,
// com aspas duplas) foi removida — só sobra a versão real, com aspas simples.
assert.match(app, /normalizarEtapa\(l\.etapa\) === 'Geladeira'/,
  'Arquivados reúne os antigos Vendido/Perdido/Geladeira, todos normalizados pra Geladeira');

console.log('v904-somente-arquivar: ok');
