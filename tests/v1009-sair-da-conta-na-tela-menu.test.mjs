import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1009 — o dono procurou o "Sair da conta" na tela Menu ("Mais") e ele só existia no menu
// lateral (☰). Agora existe um cartão "Conta" na tela Menu, com o nome de quem está logado e
// o botão de sair — visível apenas quando há sessão de login (aparelhos na chave compartilhada
// não veem nada).

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /class="card compact cp-sair-conta" style="display:none"/, 'o cartão Conta precisa começar escondido (só aparece com sessão)');
assert.match(index, /id="cpNomeUserMenu"/, 'o cartão precisa mostrar o nome de quem está logado');
assert.match(index, /onclick="cpSairDaConta\(\)"/, 'o botão do cartão precisa chamar o mesmo sair da conta');

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
assert.match(app, /querySelectorAll\("\.cp-sair-conta"\)/, 'com sessão, o app precisa revelar o cartão Conta da tela Menu');
assert.match(app, /cpNomeUserMenu/, 'o nome logado precisa ser preenchido também no cartão da tela Menu');

console.log('v1009-sair-da-conta-na-tela-menu: ok');
