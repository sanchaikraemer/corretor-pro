import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1077 — escolha do dono (modelo 2 da rodada de "carregando"): enquanto os leads chegam, a
// tela mostra a RODINHA CORAL girando + "Carregando os leads…" — nunca mais o esqueleto de
// quadros vazios que parecia tela travada (print dele na v1076). Vale pra abertura do app
// (HTML inicial), pro recarregamento da Home e pra tela Atendimentos.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// 1. O esqueleto congelado saiu de todo lugar.
for (const nome of ['cp-home-skeleton', 'cp-db-loading', 'cp-db-spinner', 'cp-side-skeleton']) {
  assert.ok(!html.includes(nome) && !app.includes(nome) && !css.includes(nome),
    `"${nome}" (esqueleto que parecia travado) não pode voltar`);
}

// 2. O loader novo está nos três pontos de carregamento.
assert.match(html, /<div id="leadFocoArea"><div class="cp-loading-leads"><div class="cp-loading-spinner"><\/div><b>Carregando os leads…<\/b>/,
  'a abertura do app mostra a rodinha com mensagem');
assert.match(html, /<div id="carteiraBody"><div class="cp-loading-leads">/,
  'a tela Atendimentos também abre com a rodinha');
assert.match(app, /focoSkel\.innerHTML = `<div class="cp-loading-leads">/,
  'o recarregamento vazio da Home usa a rodinha (não o esqueleto)');
assert.match(app, /cp694-loading cp-loading-leads/,
  'o embrulho com vigia de 9s usa o mesmo loader');
// v1146 — o vigia deixou de depender da tela ativa e passou a reconhecer também as mensagens de
// espera longa (relógio na tela + saída). O que este teste protege continua: ele identifica a tela
// de carregamento pelo texto, pra não sobrescrever conteúdo real.
assert.match(app, /Carregando os leads\|Ainda buscando sua carteira\|Sua carteira está demorando\/i\.test\(area\.textContent/,
  'o vigia reconhece o texto de carregamento (incluindo as mensagens de espera longa)');

// 3. A rodinha é CORAL (var(--lime) é o token coral da paleta) e gira.
assert.match(css, /\.cp-loading-spinner\{[^}]*border-top-color:var\(--lime\)[^}]*animation:cpLoadingGira/,
  'a rodinha precisa ser coral e girar');
assert.match(css, /@keyframes cpLoadingGira\{to\{transform:rotate\(360deg\)\}\}/, 'animação da rodinha existe');

// 4. homeAindaEmSkeleton continua sabendo quando a Home ainda está carregando.
assert.match(app, /\.skel-loading,\.cp-loading-leads,\.cp694-loading/,
  'homeAindaEmSkeleton reconhece o loader novo');

console.log('v1077-carregando-rodinha-coral: ok');
