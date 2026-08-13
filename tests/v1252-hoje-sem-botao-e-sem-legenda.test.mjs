import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1252 — PEDIDO DIRETO DO DONO, com print do celular e as duas coisas circuladas de vermelho na
// tela Hoje ("tire isso daí no Mobile onde circulei" / "o botão de importar que já falei mil vez
// que não precisa aí nem aquela legenda fora de contexto que não dá pra entender nada"):
//
//   1. O botão "Enviar conversa do WhatsApp" que a v1248 pôs no alto da Hoje (só no celular).
//      Ele comia uma faixa inteira logo abaixo da saudação e empurrava a lista de clientes pra
//      baixo. A ação continua existindo em "Mais" → "Enviar conversa do WhatsApp" e no cartão do
//      Menu; no computador, no item do menu da esquerda.
//   2. A legenda "Barra/número: mensagens do cliente (90 dias)..." (v1203/v1204), que no celular
//      ficava solta entre a busca e a lista.
//
// A legenda NÃO foi apagada do app: no computador ela continua (lá cabe em uma linha, colada na
// lista que explica) — por isso o teste da v1203 segue valendo. O que este teste tranca é que no
// CELULAR ela não apareça, e que o botão não volte pra tela Hoje.

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// ── 1. O botão sumiu da tela Hoje, de verdade (marcação e estilo) ────────────────────────────
assert.doesNotMatch(html, /id="btnImportarHome"/,
  'o botão de enviar conversa não pode voltar pra tela Hoje — o dono pediu pra tirar');
assert.doesNotMatch(html, /cp1248-importar/,
  'não pode sobrar nem a marcação do botão antigo na tela Hoje');
assert.doesNotMatch(css, /^\s*\.cp1248-importar[\s{,]/m,
  'não pode sobrar estilo do botão antigo (regra órfã volta a valer se alguém recriar a marcação)');

// O caminho pra enviar a conversa continua existindo no celular — tirar o botão não pode ter
// deixado o dono sem nenhuma porta de entrada. No celular ele é: barra de baixo "Mais" → cartão
// "Enviar conversa", que leva pra mesma tela (data-target="zip").
const cartaoMenu = html.match(/<button[^>]*data-target="zip"[^>]*>[\s\S]{0,400}?menu-card-titulo">Enviar conversa</);
assert.ok(cartaoMenu,
  'sem o botão da Hoje, o cartão "Enviar conversa" do Menu é o caminho do celular — ele precisa continuar lá');

// ── 2. A legenda não aparece no celular ──────────────────────────────────────────────────────
// Continua no código (desktop), mas escondida na largura de celular — o app trata "celular" como
// max-width:999px em todo o resto do estilo, então a regra tem que usar a MESMA régua.
assert.match(app, /class="cp-hoje-legenda"/,
  'a legenda continua existindo pro computador — o pedido era tirar do celular');
const regra = app.match(/@media\(max-width:(\d+)px\)\{\.cp-hoje-legenda\{display:none\}\}/);
assert.ok(regra, 'não achei a regra que esconde a legenda no celular');
assert.equal(regra[1], '999',
  `a legenda tem que sumir na mesma largura que o app chama de celular (999px), não em ${regra[1]}px`);

console.log('v1252-hoje-sem-botao-e-sem-legenda: ok');
