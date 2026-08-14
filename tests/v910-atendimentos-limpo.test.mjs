import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v910 — tela Atendimentos por dia: colunas LIMPAS. Sem caixa/fundo em cada dia (ficava feio),
// prédio maior ocupando a coluna, e só uma divisória fininha entre os dias.

const day = css.match(/\.cp788-day\{[^}]*\}/)[0];
assert.doesNotMatch(day, /background:rgba\(7,52,64/, 'a coluna do dia não tem mais fundo/caixa');
assert.doesNotMatch(day, /border:1px solid rgba\(255,255,255,\.10\);border-radius:16px/, 'sem borda de card ao redor da coluna');
assert.match(css, /\.cp788-day:not\(:last-child\)\{border-bottom:1px solid/, 'só uma divisória fina entre os dias');

// v1276 — a tela passou a mostrar o mês inteiro (até 31 dias) e a pilha vertical que só existia no
// CELULAR virou o formato único: uma faixa por dia, no celular e no computador. Não há mais grade
// de 7 colunas pra desfazer em media query.
assert.match(css, /\.cp788-days\{display:flex;flex-direction:column/, 'os dias ficam um embaixo do outro, sempre');
assert.doesNotMatch(css, /\.cp788-days\{display:grid/, 'a grade de 7 colunas não pode voltar — o mês tem até 31 dias');
assert.match(css, /\.cp788-day \.cp788-predio\{order:-2;width:46px;max-width:46px;height:auto/, 'prédio pequeno na ponta da faixa');
assert.match(css, /\.cp788-day-list\{flex-basis:100%;display:flex;flex-direction:row;flex-wrap:wrap/, 'nomes viram chips que quebram linha');

console.log('v910-atendimentos-limpo: ok');
