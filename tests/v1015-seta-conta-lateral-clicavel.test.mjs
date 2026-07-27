import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1015 — o dono percebeu que o cartão da conta na barra lateral (avatar + nome + setinha "⌄")
// parecia clicável (a setinha sugere um menu/dropdown), mas era um <div> sem nenhum onclick — a
// seta não abria nada. Como a única ação que já existe pra esse cartão é "Sair da conta" (o botão
// já ficava logo abaixo dele, sempre visível quando logado), o cartão virou um <button> de
// verdade que dispara a mesma ação — a seta deixa de ser uma promessa vazia.

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

assert.match(index, /<button type="button" class="cp-sidebar-user" id="cpSidebarUserBtn" onclick="cpSairDaConta\(\)"/,
  'o cartão da conta na lateral precisa ser um botão de verdade que chama cpSairDaConta()');
assert.doesNotMatch(index, /<div class="cp-sidebar-user">/, 'não pode mais existir a versão antiga em <div> sem ação nenhuma');

// O avatar/nome/setinha continuam dentro, exatamente como antes (só a tag mudou de div pra button).
assert.match(index, /<button type="button" class="cp-sidebar-user"[^>]*>\s*<span class="cp-avatar" id="cpAvatarUser">C<\/span><span><b id="cpNomeUser">Corretor<\/b><small>Corretor<\/small><\/span><span class="cp-user-chevron">⌄<\/span>\s*<\/button>/,
  'avatar, nome e setinha precisam continuar dentro do botão, sem mudar a estrutura visual');

// CSS precisa neutralizar a aparência padrão de <button> (fonte, alinhamento, cursor, largura) —
// senão o botão nativo do navegador quebraria o visual que já existia no <div>.
const iniRegra = css.indexOf('.cp-sidebar-user{');
const fimRegra = css.indexOf('}', iniRegra);
const regra = css.slice(iniRegra, fimRegra);
assert.match(regra, /font:inherit!important/, 'precisa resetar a fonte padrão de <button>');
assert.match(regra, /text-align:left!important/, 'precisa resetar o alinhamento padrão de <button> (center)');
assert.match(regra, /cursor:pointer!important/, 'precisa indicar visualmente que agora é clicável');
assert.match(regra, /width:100%!important/, 'precisa ocupar a largura da barra lateral, igual ao <div> antigo');

console.log('v1015-seta-conta-lateral-clicavel: ok');
