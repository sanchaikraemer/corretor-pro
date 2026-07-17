import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v870: quando o app NÃO está instalado, o convite "Baixar app" precisa aparecer já ao abrir
// o link (no topo da Hoje) — sem ter que ir em Configurações. Antes o #bannerInstalar existia
// mas vinha VAZIO, então nada aparecia.

// Existe só um #bannerInstalar e ele está PREENCHIDO (não mais vazio).
assert.equal((html.match(/id="bannerInstalar"/g) || []).length, 1, 'deve existir exatamente um #bannerInstalar');
assert.doesNotMatch(html, /<div id="bannerInstalar" hidden><\/div>/, 'o banner não pode mais vir vazio');
assert.match(html, /id="bannerInstalarBtn"[^>]*>Baixar app</, 'o banner precisa ter o botão "Baixar app"');
assert.match(html, /id="bannerInstalarFechar"/, 'o banner precisa ter o botão de fechar (mantém a lógica do PWA)');
assert.match(html, /id="bannerInstalarDica"/, 'o banner precisa ter a dica do passo a passo (iPhone etc.)');

// Está no TOPO da Hoje: aparece antes da grade de conteúdo.
assert.ok(
  html.indexOf('id="bannerInstalar"') < html.indexOf('class="home-grid"'),
  'o banner precisa ficar no topo da Hoje (antes do conteúdo)'
);

// Estilo do banner existe.
assert.match(css, /\.cp-install-banner\{/, 'o CSS do banner precisa existir');

console.log('v870-banner-instalar: ok');
