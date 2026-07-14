import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v819: o produto não pode mais aparecer duplicado nas tags do topo do lead —
// ele já é exibido em "Detalhes comerciais".
assert.doesNotMatch(app, /<span class="cp704-tag">\$\{escapeHtml\(produto\)\}<\/span>/,
  'o produto não pode aparecer nas tags do topo do lead');
assert.doesNotMatch(app, /mc=cp704Modelo\(lead\), produto=cp704Produto/,
  'a variável produto ficou sem uso e não deve ser recriada');

console.log('v819-hero-produto: ok');
