import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v821 moveu a "Registrar observação" pro topo; a v1365 (ordem do dono, 22/08/2026) desceu o
// card pro painel lateral — a inteligência vem primeiro. O que sobrevive da v821: o card é
// aberto (não accordion) e o id não pode duplicar.

// O textarea da observação tem id único — precisa aparecer EXATAMENTE UMA vez.
const ocorrencias = (app.match(/id="cp7ObsTexto"/g) || []).length;
assert.equal(ocorrencias, 1, 'cp7ObsTexto deve aparecer exatamente uma vez (id não pode duplicar)');

// v1365 — a observação DESCEU por ordem do dono (avaliação de 22/08/2026): o topo é só nome +
// situação, e a hierarquia que ele paga pra ver ("o que faço agora / o que mando") vem antes do
// resto. O card continua inteiro (não virou accordion), só mudou de lugar: painel lateral.
assert.match(app, /<aside class="cp704-secondary">[\s\S]*?cp704-obscard/,
  'o card de observação vive no painel lateral, depois da inteligência');
assert.ok(!/<div class="cp704-herorow">/.test(app),
  'o topo não pode voltar a dividir espaço com a observação (hero é só nome + situação)');
assert.match(app, /<section class="cp704-hero">[\s\S]{0,400}cp704-situation/,
  'o hero mostra nome + situação em uma frase');

// A observação não pode mais ser um accordion recolhido embaixo.
assert.doesNotMatch(app, /<summary>Registrar observação<\/summary>/,
  'a observação não pode mais ser um accordion');

console.log('v821-observacao-topo: ok');
