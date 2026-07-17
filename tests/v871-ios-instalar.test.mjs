import fs from 'node:fs';
import assert from 'node:assert/strict';

const pwa = fs.readFileSync(new URL('../js/pwa-install.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// v871: no iPhone/iPad não há instalação por 1 clique — só o caminho manual pelo Safari.
// O passo a passo agora é específico do iOS, o botão do banner vira "Como instalar", e há um
// "Continuar na web" pra quem tem Apple dispensar o convite e seguir no navegador.

// Detecção e texto de iOS.
assert.match(pwa, /function ehIOS\(\)/, 'precisa detectar iOS');
assert.match(pwa, /Adicionar à Tela de Início/, 'o passo a passo do iPhone precisa citar "Adicionar à Tela de Início"');
assert.match(pwa, /Safari/, 'precisa mencionar o Safari (única forma no iOS)');
// No iOS o banner mostra o passo a passo e relabela o botão.
assert.match(pwa, /bb\.textContent = "Como instalar"/, 'no iOS o botão vira "Como instalar"');

// Botão "Continuar na web" no banner + fiação.
assert.match(html, /id="bannerInstalarWeb"[^>]*>Continuar na web</, 'o banner precisa ter "Continuar na web"');
assert.match(pwa, /function fecharBannerInstalar\(\)/, 'precisa da função de dispensar o banner');
assert.match(pwa, /#bannerInstalarWeb"\)\?\.addEventListener\("click", fecharBannerInstalar\)/, '"Continuar na web" precisa dispensar o banner');
assert.match(css, /\.cp-install-web\{/, 'o CSS do "Continuar na web" precisa existir');

console.log('v871-ios-instalar: ok');
