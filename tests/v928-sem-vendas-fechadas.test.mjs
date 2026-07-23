import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// v928 — o dono repetiu (várias vezes) que não tem "vendas fechadas" no app: ele não marca
// Vendido, só Arquivar (decisão já tomada na v904, que tirou o botão "Vendido" e o tile de
// receita do Desempenho). Só que sobrou código morto por trás disso — cálculos de "vendas do
// mês"/"vendas da semana" que nunca alimentavam nada visível, e uma fatia "Vendas" ainda viva
// no card "Esta semana" da aba Aprendizado, mostrando sempre 0. Tudo removido.

// 1. Funções/telas inteiras de "vendas fechadas" não existem mais.
for(const nome of ['parseValorVenda', 'formatBRL', 'cpSaleValue', 'carregarVendas', 'carregarRelatorio', 'renderDesempenhoDash']){
  assert.doesNotMatch(app, new RegExp(`function ${nome}\\b`), `${nome} não deveria mais existir em app.js`);
}
assert.doesNotMatch(app, /const FUNIL_ETAPAS/, 'FUNIL_ETAPAS (dead code do relatório antigo) não deveria mais existir');
assert.doesNotMatch(app, /window\.carregarVendas\s*=/, 'window.carregarVendas não deveria mais ser atribuído');

// 2. Nenhum alvo de DOM relacionado a vendas é mais escrito.
assert.doesNotMatch(app, /cpSetText\("cpRevenue"/, 'cpRevenue não deve mais ser escrito');
assert.doesNotMatch(app, /"#kpiVendas"|"#kpiVendasValor"|"#vendasList"/, 'nenhum alvo de vendas deveria mais ser referenciado');

// 3. O dispatcher de telas não tenta mais abrir "vendas"/"relatorio" via as funções removidas.
assert.doesNotMatch(app, /t === "vendas"\) await carregarVendas/, 'dispatcher não deve mais chamar carregarVendas');
assert.doesNotMatch(app, /t === "relatorio"\) await carregarRelatorio/, 'dispatcher não deve mais chamar carregarRelatorio (dead)');

// 4. A faixa "Esta semana" (Aprendizado) não tem mais o tile "Vendas" — só as métricas de
// atividade que de fato refletem o uso real do app.
const iniRS = app.indexOf('async function carregarRelatorioSemana(){');
const fimRS = app.indexOf('\n}', iniRS);
assert.ok(iniRS !== -1 && fimRS !== -1, 'carregarRelatorioSemana não encontrada');
const rs = app.slice(iniRS, fimRS);
assert.doesNotMatch(rs, /kpiMini\("Vendas"/, 'a faixa "Esta semana" não deve mais mostrar o tile "Vendas"');
assert.match(rs, /kpiMini\("Novos leads"/, 'as demais métricas de atividade continuam');

// 5. Nada no HTML aponta mais pra telas/ids de vendas.
assert.doesNotMatch(html, /id="vendasList"|id="kpiVendas"|id="cpRevenue"|id="relatorioBody"/,
  'o HTML não deve mais ter elementos-alvo de vendas/relatório morto');

console.log('v928-sem-vendas-fechadas: ok');
