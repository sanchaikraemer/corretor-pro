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

// 2. A barra de ações do lead (cp704QuickActions) perdeu o grupo "Encerramento" (Vendido),
//    mas manteve Arquivar e Excluir definitivamente.
const quick = app.match(/function cp704QuickActions\(lead,mc\)\{[\s\S]*?\n  \}/)[0];
assert.doesNotMatch(quick, /Encerramento/, 'sem grupo Encerramento');
assert.doesNotMatch(quick, /marcarVendido/, 'sem ação de vender');
assert.match(quick, /arquivarLead\(/, 'mantém Arquivar');
assert.match(quick, /excluirLeadDefinitivo\(/, 'mantém Excluir definitivamente');

// 3. As ações do lead (viraram ícones no topo na v908) e a barra rápida ui683 não têm Vendido.
const toolbar904 = app.match(/<div class="cp704-toolbar">[\s\S]*?<\/div><\/div>/)[0];
assert.doesNotMatch(toolbar904, /marcarVendido|abrirVenda|>Vendido</, 'ações do topo sem venda');
assert.doesNotMatch(app, /abrirVenda\(\$\{id\},\$\{nome\}\)/, 'barra rápida sem Vendido');

// 4. Leads já marcados Vendido/Perdido/Geladeira aparecem como "Arquivado" (sem esses rótulos).
const jornada = app.match(/function cp704Jornada\(lead, mc\)\{[\s\S]*?\n  \}/)[0];
assert.doesNotMatch(jornada, /label:'Vendido'/, 'jornada não rotula Vendido');
assert.doesNotMatch(jornada, /label:'Perdido'/, 'jornada não rotula Perdido');
assert.match(jornada, /normal==='Vendido' \|\| normal==='Perdido' \|\| normal==='Geladeira'/, 'os três viram Arquivado');

// 5. As telas/cards de venda saíram do app.
assert.doesNotMatch(html, /Vendas registradas/, 'sem menu/tela "Vendas registradas"');
assert.doesNotMatch(html, /cp-metric-revenue/, 'sem tile de receita no Desempenho');
assert.doesNotMatch(html, /id="vendas"/, 'sem a tela #vendas');

// 6. O arquivo (Arquivados) segue reunindo Geladeira + Perdido antigos num lugar só.
// v952: a antiga função duplicada de carregarGeladeira (que este teste mirava sem querer,
// com aspas duplas) foi removida — só sobra a versão real, com aspas simples.
assert.match(app, /\['Geladeira','Perdido'\]\.includes\(normalizarEtapa\(l\.etapa\)\)/,
  'Arquivados reúne Geladeira e Perdido antigos');

console.log('v904-somente-arquivar: ok');
