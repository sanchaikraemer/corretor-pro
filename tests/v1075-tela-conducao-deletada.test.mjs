import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1075 — pedido do dono (com print circulando a tela): DELETAR a tela "Condução" inteira —
// ela repetia o painel e as listas da Home. As listas da Home (grupos) viram o destino único:
// - card "Fazer agora"        → abrirFazerAgora (já existia)
// - card "Aguardando cliente" → abrirAguardandoCliente (nova, mesmo padrão)
// - card "Total de leads"     → abrirCarteiraAtiva (nova) — herdou o "Imprimir" (v1064) e o
//   "Excel", que só existiam na tela deletada (o Excel estava até ESCONDIDO por CSS lá).
// - sininho / insight / "Abrir prioridades de hoje" → abrirFazerAgora

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// 1. A tela e todo o código dela não existem mais (as DUAS gerações).
assert.ok(!html.includes('id="pipeline"'), 'a seção da tela Condução saiu do HTML');
assert.ok(!html.includes('Abrir Condução'), 'o botão "Abrir Condução" da Home saiu (a tela não existe)');
for (const nome of ['carregarPipeline', 'setPipelineTab', 'setPipelineOrdem', 'pipelineTabAtiva',
  'setPipelineVisualFiltro', 'pipelineVisualFiltro', 'cp788AbrirCarteiraAtiva', 'cp786AbrirConducao',
  'cp786AbrirPrioridadePrincipal', 'cp788LinhaConducao', 'ordenarLeadsPor', 'pipelineBoard']) {
  assert.ok(!app.includes(nome), `"${nome}" (código da tela deletada) não pode voltar pro app.js`);
}
assert.ok(!app.includes("show('pipeline')") && !app.includes('show("pipeline")'),
  'nada pode navegar pra tela deletada');
for (const sel of ['.pipe-tab', '.pipe-head', '.pipe-ordenar', '.ui-pipeline-kpis', '.ui-pipeline-list', '#pipeline']) {
  assert.ok(!css.includes(sel), `CSS da tela deletada (${sel}) não pode voltar`);
}

// 2. Rota antiga salva em algum aparelho não quebra o boot: cai na Home.
assert.match(app, /if\(t === "pipeline"\) t = "home";/, 'rota antiga da tela deletada precisa cair na Home');

// 3. As listas substitutas existem e os cards da Home apontam pra elas.
assert.match(app, /function abrirAguardandoCliente\(\)\{/, 'lista "Aguardando cliente" da Home existe');
assert.match(app, /function abrirCarteiraAtiva\(\)\{/, 'lista "Carteira ativa" da Home existe');
assert.match(app, /onclick="abrirCarteiraAtiva\(\)"><span>Total de leads<\/span>/,
  'card "Total de leads" abre a lista da Home');
assert.match(app, /onclick="abrirAguardandoCliente\(\)"><span>Aguardando cliente<\/span>/,
  'card "Aguardando cliente" abre a lista da Home');
assert.match(html, /onclick="abrirFazerAgora\(\)"/, '"Abrir prioridades de hoje" aponta pra lista da Home');

// 4. Imprimir (v1064) e Excel continuam vivos, agora na lista "Carteira ativa".
const carteira = app.match(/function abrirCarteiraAtiva\(\)\{[\s\S]*?\n\}/)[0];
assert.match(carteira, /imprimirCarteiraAtiva\(\)/, 'o Imprimir lista continua vivo');
assert.match(carteira, /exportarLeadsCSV\(this\)/, 'o Excel continua vivo');
assert.match(app, /options\.acoesHtml/, 'abrirGrupoHome aceita botões de ação no cabeçalho');

// 5. Sininho não pode levar pra tela deletada.
// v1205 — o painel do sino (Central de atenção) foi removido; ele abre a Agenda direto. O que
// este teste garante segue igual: nada aponta pra Condução, e a fila do dia continua sendo a
// lista "Fazer agora" da Home.
assert.match(html, /id="topBell"[^>]*onclick="show\('agenda'\)"/, 'o sino aponta pra Agenda, nunca pra Condução');
assert.match(app, /function abrirFazerAgora\(/, 'a lista "Fazer agora" da Home continua sendo a fila do dia');

console.log('v1075-tela-conducao-deletada: ok');
