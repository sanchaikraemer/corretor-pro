import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v821: a "Registrar observação" foi movida pro topo (card já aberto ao lado do lead),
// e removida dos accordions de baixo. Não pode duplicar.

// O textarea da observação tem id único — precisa aparecer EXATAMENTE UMA vez.
const ocorrencias = (app.match(/id="cp7ObsTexto"/g) || []).length;
assert.equal(ocorrencias, 1, 'cp7ObsTexto deve aparecer exatamente uma vez (id não pode duplicar)');

// O topo passou a ter dois cards lado a lado: o lead (hero) e a observação.
assert.match(app, /<div class="cp704-herorow">[\s\S]*?class="cp704-hero"[\s\S]*?cp704-obscard/,
  'o topo deve ter hero + card de observação (cp704-herorow)');

// A observação não pode mais ser um accordion recolhido embaixo.
assert.doesNotMatch(app, /<summary>Registrar observação<\/summary>/,
  'a observação não pode mais ser um accordion');

console.log('v821-observacao-topo: ok');
