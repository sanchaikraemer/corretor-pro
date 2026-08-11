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

// 2. v1187 — este item mirava `cp704QuickActions`, o painel de ações do lead. Ele parou de ser
//    desenhado na v908 (as ações subiram pra barra de ícones do topo) e ficou centenas de
//    versões no arquivo sem
//    tela; a v1186 tentou devolvê-lo e o dono derrubou, porque o que ele oferecia já existe em
//    outro lugar (juntar cadastro repetido é resolvido na importação; excluir está em Editar).
//    O painel saiu de vez. A regra da v904 continua valendo onde as ações realmente moram.
const toolbar = app.match(/<div class="cp704-toolbar">[\s\S]*?<\/div><\/div>/)[0];
assert.doesNotMatch(toolbar, /Encerramento/, 'sem grupo Encerramento');
assert.doesNotMatch(toolbar, /marcarVendido/, 'sem ação de vender');
// v1210 — o botão desta posição passou a ser montado por cp704BotaoEtapa(lead): "Arquivar" quando
// o lead está ativo, "Reativar" quando já está arquivado (pedido do dono — antes só dava pra
// reativar pela lista da tela Arquivados). O desfecho continua sendo um só; o que mudou é que ele
// não é mais cravado no meio da barra.
assert.match(toolbar, /\$\{cp704BotaoEtapa\(lead\)\}/, 'a barra do topo monta o botão pelo estado do lead');
const botaoEtapa = app.match(/function cp704BotaoEtapa\(lead\)\{[\s\S]*?\n  \}/)[0];
assert.match(botaoEtapa, /arquivarLead\(/, 'Arquivar continua sendo o desfecho do lead ativo');
assert.match(botaoEtapa, /reativarLeadArquivado\(/, 'lead arquivado oferece Reativar no mesmo lugar');
assert.doesNotMatch(botaoEtapa, /marcarVendido|abrirVenda/, 'nenhum desfecho de venda volta por aqui');
assert.match(app, /id="editLeadExcluir"/, 'Excluir continua em Editar lead → Zona perigosa');

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
