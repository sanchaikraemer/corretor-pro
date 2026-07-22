import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v910 — tela Atendimentos por dia: colunas LIMPAS. Sem caixa/fundo em cada dia (ficava feio),
// prédio maior ocupando a coluna, e só uma divisória fininha entre os dias.

const day = css.match(/\.cp788-day\{[^}]*\}/)[0];
assert.doesNotMatch(day, /background:rgba\(7,52,64/, 'a coluna do dia não tem mais fundo/caixa');
assert.doesNotMatch(day, /border:1px solid rgba\(255,255,255,\.10\);border-radius:16px/, 'sem borda de card ao redor da coluna');
assert.match(css, /\.cp788-day:not\(:last-child\)\{border-right:1px solid/, 'só uma divisória fina entre os dias');
assert.match(css, /\.cp788-day \.cp788-predio\{width:100%;max-width:110px;height:auto/, 'prédio grande (ocupa a coluna)');

// No celular, empilha por dia na vertical (sem rolagem horizontal das 7 colunas).
assert.match(css, /@media\(max-width:720px\)\{[\s\S]*?\.cp788-days\{flex-direction:column/, 'mobile: dias empilhados na vertical');
assert.match(css, /@media\(max-width:720px\)\{[\s\S]*?\.cp788-day-list\{flex-basis:100%;flex-direction:row;flex-wrap:wrap/, 'mobile: nomes viram chips que quebram linha');

console.log('v910-atendimentos-limpo: ok');
