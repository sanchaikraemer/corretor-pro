import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

assert.doesNotMatch(html, /cp-side-skeleton/, 'Home não pode iniciar com skeleton lateral permanente');
assert.match(html, /id="homeRight" hidden/, 'coluna lateral deve iniciar desativada');
assert.match(app, /function renderHomeRight\(items\)[\s\S]*?el\.innerHTML = "";[\s\S]*?el\.hidden = true;/,
  'renderHomeRight deve limpar e esconder a coluna');
assert.match(app, /function renderHomeFallbackSeguro\(items\)[\s\S]*?renderHomeRight\(\[\]\)/,
  'fallback precisa limpar a lateral');
assert.match(css, /#home \.home-grid\{grid-template-columns:minmax\(0,1fr\)!important\}/,
  'Home desktop deve usar toda a largura após remover a lateral');
console.log('home-right-cleanup: ok');
