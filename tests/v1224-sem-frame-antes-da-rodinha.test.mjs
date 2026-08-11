import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1224 — "quando eu vou exportar um lead, em vez de começar já do zero e ir crescendo a rodinha,
// ele ainda mostra uma tela, um frame, uma coisa antes de começar, que dá a impressão de ser erro"
// (dono, 11/08/2026).
//
// Causa: quem compartilha a conversa cai em /?source=share-target&…, e quem manda a tela cheia da
// importação aparecer é o app.js — que é um MÓDULO, ou seja, só roda depois que a página inteira
// foi lida. Nesse intervalo o celular pinta o app normal (Home, esqueleto de leads, faixa de
// instalar). É o frame que ele via.
//
// A correção não pode depender do app.js: precisa valer na PRIMEIRA pintura.

// ── 1. A marca é posta no <head>, antes de qualquer pintura, e antes do app.js ─────────────────
const posHead = html.indexOf('</head>');
const posMarca = html.indexOf('cp-entrando-pelo-share');
const posAppJs = html.indexOf('src="/app.js');
assert.ok(posMarca > -1, 'a marca de abertura por compartilhamento precisa existir');
assert.ok(posMarca < posHead, 'ela tem que ser posta no <head> — depois já é tarde, a tela pintou');
assert.ok(posMarca < posAppJs, 'e antes do app.js, que é módulo e só roda no fim');

const script = html.slice(html.lastIndexOf('<script>', posMarca), html.indexOf('</script>', posMarca));
assert.match(script, /p\.has\("shared"\) \|\| p\.get\("source"\) === "share-target" \|\| p\.has\("share-target"\)/,
  'reconhece as três formas de endereço que o compartilhamento usa');
// Rede de segurança: ninguém pode ficar preso numa tela de 0% se a conversa não chegar.
assert.match(script, /setTimeout\(function\(\)\{ document\.documentElement\.classList\.remove\("cp-entrando-pelo-share"\); \}, 8000\);/,
  'se a importação não assumir, a marca sai sozinha e o app aparece');

// ── 2. O CSS mostra a rodinha em 0% e esconde o app — sem depender de JS nenhum ────────────────
assert.match(styles, /html\.cp-entrando-pelo-share #cpImportOverlay\[hidden\]\{display:grid\}/,
  'a tela cheia aparece mesmo antes de o app.js mandar');
assert.match(styles, /html\.cp-entrando-pelo-share \.app,[\s\S]{0,120}visibility:hidden\}/,
  'e o app fica escondido atrás dela (é ele que aparecia como "outra tela")');
// A rodinha nasce em 0% no próprio HTML — é isso que faz ela "crescer do zero" como ele pediu.
assert.match(html, /<div class="cpio-pct" id="cpioPct">0%<\/div>/, 'a rodinha começa em 0%');
assert.match(html, /stroke-dashoffset="351\.9"/, 'com o anel vazio');

// ── 3. A marca sai quando o app assume, quando a abertura não é de compartilhamento, e quando o
//      aviso de erro precisa aparecer (senão ela cobriria o próprio aviso).
{
  const visivel = app.slice(app.indexOf('export function cpImportOverlayVisivel(mostrar){'));
  assert.match(visivel.slice(0, 700), /classList\.remove\("cp-entrando-pelo-share"\)/,
    'quando o app assume a tela cheia, a marca sai');
  const semShare = app.slice(app.indexOf('if(!cameFromShare){'), app.indexOf('if(!cameFromShare){') + 500);
  assert.match(semShare, /classList\.remove\("cp-entrando-pelo-share"\)/,
    'abertura normal não pode herdar a marca de um endereço antigo');
  const semWorker = app.slice(app.indexOf("if(erroUrl==='sem-worker'){"), app.indexOf("if(erroUrl==='sem-worker'){") + 600);
  assert.match(semWorker, /classList\.remove\("cp-entrando-pelo-share"\)/,
    'o aviso de conversa que não chegou precisa ficar visível, não atrás da tela cheia');
}

// ── 4. Medido no navegador (Chromium, 412×915, rede lenta), quadro a quadro, sobre public/:
//      compartilhando  → 69 quadros: 68 com a tela cheia, ZERO com o app aparecendo, 1º quadro "0%"
//      abertura normal → 74 quadros: nenhuma tela cheia, app desde o começo
//      (o roteiro está no scratchpad da sessão; aqui fica o registro do que foi medido).

console.log('v1224-sem-frame-antes-da-rodinha: ok');
