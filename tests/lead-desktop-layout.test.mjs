import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

assert.match(app,
  /\.cp704-lead\{[^}]*width:100%;[^}]*max-width:1180px/,
  'detalhe do lead deve aproveitar a largura disponível no desktop');
assert.match(app,
  /\.cp704-workspace\{display:grid;grid-template-columns:minmax\(0,1\.35fr\) minmax\(340px,\.82fr\)/,
  'desktop deve usar duas colunas: condução e informações complementares');
assert.match(app,
  /<div class="cp704-workspace">[\s\S]*?<main class="cp704-primary">[\s\S]*?<aside class="cp704-secondary">/,
  'render do lead deve separar conteúdo principal e painel lateral');
// v1365 — mudou por ordem do dono (avaliação de 22/08/2026): "Resumo e histórico deveriam poder
// recolher/expandir. Quem quer investigar abre; quem quer agir não precisa atravessar tudo."
// Detalhes comerciais continua no painel lateral, mas agora começa RECOLHIDO.
assert.match(app,
  /<aside class="cp704-secondary">[\s\S]*?<details class="cp704-details"><summary>Detalhes comerciais<\/summary>/,
  'Detalhes comerciais deve estar no painel lateral, recolhível');
assert.ok(!/<details class="cp704-details" open><summary>Detalhes comerciais/.test(app),
  'Detalhes comerciais não pode voltar a iniciar aberto (ordem do dono, v1365)');
assert.match(app,
  /@media\(max-width:999px\)\{[^}]*\.cp704-lead\{max-width:760px\}[^}]*\.cp704-workspace\{grid-template-columns:minmax\(0,1fr\)\}/,
  'tablet e celular devem voltar ao fluxo de uma coluna');

console.log('lead-desktop-layout: ok');
