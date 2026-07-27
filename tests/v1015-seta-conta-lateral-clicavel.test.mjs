import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1015 — o dono percebeu que o cartão da conta na barra lateral (avatar + nome + setinha "⌄")
// parecia clicável (a setinha sugere um menu/dropdown), mas era um <div> sem nenhum onclick — a
// seta não abria nada. Como a única ação que já existia pra esse cartão era "Sair da conta" (o
// botão já ficava logo abaixo dele, sempre visível quando logado), o cartão virou um <button> de
// verdade que disparava a mesma ação.
//
// v1017 — o dono apontou o problema oposto: com o cartão CLICÁVEL chamando cpSairDaConta()
// e o botão dedicado "Sair da conta" logo abaixo fazendo exatamente a mesma coisa, os dois
// ficaram redundantes ("ambos servem pra mesma coisa"). Volta a ser um <div> sem ação — a
// setinha "⌄" (que não abre mais nada) saiu junto, pra não voltar a prometer um menu que não
// existe. "Sair da conta" (o botão dedicado, com ícone e texto claro) segue sendo o único
// caminho pra encerrar a sessão.

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

assert.match(index, /<div class="cp-sidebar-user" id="cpSidebarUserBtn">/,
  'o cartão da conta na lateral precisa voltar a ser um <div> sem ação — "Sair da conta" já existe logo abaixo');
assert.doesNotMatch(index, /<button[^>]*class="cp-sidebar-user"/, 'não pode mais existir a versão em <button> que chamava cpSairDaConta() ao clicar no cartão');
assert.doesNotMatch(index, /cp-user-chevron/, 'a setinha "⌄" saiu do cartão — não pode sugerir uma interação que não existe');

// Avatar/nome continuam dentro, exatamente como antes (só a setinha e a tag <button> saíram).
assert.match(index, /<div class="cp-sidebar-user" id="cpSidebarUserBtn">\s*<span class="cp-avatar" id="cpAvatarUser">C<\/span><span><b id="cpNomeUser">Corretor<\/b><small>Corretor<\/small><\/span>\s*<\/div>/,
  'avatar e nome precisam continuar dentro do cartão, sem mudar a estrutura visual');

// "Sair da conta" (botão dedicado, com ícone e texto) continua sendo o único jeito de sair pela lateral.
assert.match(index, /<button type="button" class="sb-item" id="btnSairConta" style="display:none" onclick="cpSairDaConta\(\)">/,
  'o botão dedicado "Sair da conta" precisa continuar existindo e chamando cpSairDaConta()');

// CSS não pode mais indicar que o cartão é clicável (sem cursor:pointer, sem chevron).
const iniRegra = css.indexOf('.cp-sidebar-user{');
const fimRegra = css.indexOf('}', iniRegra);
const regra = css.slice(iniRegra, fimRegra);
assert.doesNotMatch(regra, /cursor:pointer/, 'o cartão não pode mais parecer clicável (sem cursor de mãozinha)');
assert.match(regra, /width:100%!important/, 'precisa continuar ocupando a largura da barra lateral');
assert.doesNotMatch(css, /\.cp-sidebar-user:hover\{background/, 'não pode sobrar destaque de FUNDO no hover de um elemento que não é mais interativo');
assert.doesNotMatch(css, /\.cp-user-chevron\{/, 'a regra da setinha (removida do HTML) não pode sobrar solta no CSS');

console.log('v1015-seta-conta-lateral-clicavel: ok (atualizado na v1017 — cartão volta a ser só informativo)');
