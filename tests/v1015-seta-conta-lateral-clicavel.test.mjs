import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1015 — o dono percebeu que o cartão da conta na barra lateral (avatar + nome + setinha "⌄")
// parecia clicável (a setinha sugere um menu/dropdown), mas era um <div> sem nenhum onclick — a
// seta não abria nada. Como a única ação que já existia pra esse cartão era "Sair da conta" (o
// botão já ficava logo abaixo dele, sempre visível quando logado), o cartão virou um <button> de
// verdade que disparava a mesma ação.
//
// v1017 — o dono apontou o problema oposto: com o cartão CLICÁVEL chamando cpSairDaConta() e o
// botão dedicado "Sair da conta" logo abaixo fazendo exatamente a mesma coisa, os dois ficaram
// redundantes ("ambos servem pra mesma coisa"). Virou um <div> sem ação — a setinha "⌄" saiu
// junto, pra não voltar a prometer um menu que não existe.
//
// v1024 — o dono repetiu o pedido: mesmo virando só informativo (sem clique) na v1017, o cartão
// (avatar + nome) continuava na tela, do lado do botão "Sair da conta" — e pra ele os dois ainda
// "fazem a mesma coisa" (avatar+nome só reforça quem está logado, o que o botão "Sair da conta"
// já deixa claro). Dessa vez o cartão saiu inteiro da barra lateral — só sobra o botão dedicado.

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// 1. O cartão (div, avatar, nome) não pode mais existir na barra lateral.
assert.doesNotMatch(index, /id="cpSidebarUserBtn"/, 'o cartão da conta na lateral (div ou button) não pode mais existir');
assert.doesNotMatch(index, /class="cp-sidebar-user"/, 'a classe do cartão não pode mais aparecer no HTML');
assert.doesNotMatch(index, /id="cpAvatarUser"/, 'o avatar do cartão da lateral não pode mais existir');
assert.doesNotMatch(index, /id="cpNomeUser"/, 'o nome do cartão da lateral não pode mais existir (cpNomeUserMenu, na tela Menu, é outro elemento e continua existindo)');

// 2. "Sair da conta" (botão dedicado, com ícone e texto) continua sendo o único jeito de sair pela lateral.
assert.match(index, /<button type="button" class="sb-item" id="btnSairConta" style="display:none" onclick="cpSairDaConta\(\)">/,
  'o botão dedicado "Sair da conta" precisa continuar existindo e chamando cpSairDaConta()');

// 3. CSS do cartão removido não pode sobrar solto.
assert.doesNotMatch(css, /\.cp-sidebar-user/, 'nenhuma regra de CSS do cartão removido pode sobrar (nem a base, nem hover, nem transição)');
assert.doesNotMatch(css, /\.cp-avatar\{/, 'a regra .cp-avatar (só usada pelo cartão removido) não pode sobrar solta');
// .cp-profile (o botão de perfil redondo do topo, "Perfil", ainda existe e usa "span" da mesma
// família visual) precisa continuar estilizado — só o .cp-avatar (do cartão removido) saiu do combo.
assert.match(css, /\.cp-profile span\{display:grid!important/, 'o botão de perfil do topo (.cp-profile) precisa continuar com o mesmo visual de avatar redondo');
assert.match(index, /class="cp-profile desktop-only"/, 'o botão de perfil do topo (não é o cartão removido) continua existindo');

// 4. app.js não pode mais tentar atualizar elementos que não existem mais — só o nome dentro
// da tela Menu (cpNomeUserMenu) continua sendo atualizado.
const fnIni = app.indexOf('window.cpAtualizarIdentidadeVisivel = function()');
const fnFim = app.indexOf('\n  };', fnIni);
const fnSrc = app.slice(fnIni, fnFim);
assert.doesNotMatch(fnSrc, /cpNomeUser"|cpAvatarUser"/, 'cpAtualizarIdentidadeVisivel não pode mais mexer nos elementos removidos do cartão da lateral');
assert.match(fnSrc, /cpNomeUserMenu/, 'cpAtualizarIdentidadeVisivel continua atualizando o nome dentro da tela Menu');

console.log('v1015-seta-conta-lateral-clicavel: ok (atualizado na v1024 — cartão da lateral removido de vez, sem clique nem exibição)');
