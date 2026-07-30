import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1081 — bug relatado pelo dono no computador: ao clicar dentro de "Registrar observação"
// a tela pulava pra outro lugar e o que ele digitava não aparecia (só conseguiu escrever e
// salvar na 3ª vez que reabriu o lead).
//
// Duas causas somadas:
//   1. o detalhe do lead é remontado do zero mais de uma vez (memória → servidor, reanálise,
//      atendimento) e a remontagem destruía o campo de observação em uso — texto e cursor iam
//      embora e a página pulava de posição;
//   2. sem foco em nenhum campo, as teclas soltas do desktop (h/m/z/c) viravam navegação, então
//      a digitação levava o corretor pra outra tela.

// ---------- 1. renderLeadFoco preserva o campo através da remontagem ----------
const corpoRender = app.slice(app.indexOf('function renderLeadFoco('));
const fimRender = corpoRender.indexOf('\nwindow.renderLeadFoco = renderLeadFoco;');
assert.ok(fimRender > 0, 'renderLeadFoco precisa existir e ser exportada');
const render = corpoRender.slice(0, fimRender);

const posCaptura = render.indexOf('cp7ObsEstado');
const posInnerHtml = render.indexOf('area.innerHTML=`<div class="cp704-lead">');
const posRestauro = render.indexOf('cp7ObsDepois');
assert.ok(posCaptura > 0, 'o estado do campo de observação precisa ser guardado antes da remontagem');
assert.ok(posInnerHtml > posCaptura, 'a captura precisa vir ANTES de trocar o conteúdo da área');
assert.ok(posRestauro > posInnerHtml, 'a restauração precisa vir DEPOIS de trocar o conteúdo da área');

// Texto, cursor e foco: os três precisam voltar, senão o corretor perde o que já escreveu.
assert.match(render, /cp7ObsDepois\.value = cp7ObsEstado\.valor/, 'o texto já digitado precisa voltar');
assert.match(render, /setSelectionRange\(cp7ObsEstado\.inicio, cp7ObsEstado\.fim\)/, 'o cursor precisa voltar pra onde estava');
assert.match(render, /cp7ObsDepois\.focus\(\{ preventScroll:true \}\)/, 'o foco volta pro campo sem fazer a tela pular');
assert.match(render, /focado: document\.activeElement === cp7ObsAntes/, 'precisa saber se o campo estava em uso');

// A posição da rolagem volta ao lugar — só em remontagem (na 1ª montagem nada muda).
assert.match(render, /const cp7JaTinhaDetalhe = !!area\.querySelector\('\.cp704-lead'\)/, 'só restaura rolagem quando já havia detalhe montado');
assert.match(render, /if\(cp7JaTinhaDetalhe && Math\.abs\(window\.scrollY - cp7RolagemPagina\) > 2\)/, 'a página volta pra onde o corretor estava');

// ---------- 2. tecla solta não navega mais por cima da digitação ----------
const iAtalhos = app.indexOf('document.addEventListener("keydown", (e) => {\n  // Ignora se está digitando');
assert.ok(iAtalhos > 0, 'o bloco de atalhos de teclado do desktop precisa existir');
const atalhos = app.slice(iAtalhos, iAtalhos + 1800);
const iMapa = atalhos.indexOf('const mapTeclas');
assert.ok(iMapa > 0, 'o mapa de teclas h/m/z/c continua sendo o alvo da trava');
const guardas = atalhos.slice(0, iMapa);

assert.match(guardas, /if\(state\.focoLeadId \|\| state\.lead\?\.id\) return;/, 'com um lead aberto, letra solta não pode navegar');
assert.match(guardas, /e\.ctrlKey \|\| e\.altKey \|\| e\.metaKey/, 'combinação do navegador não é atalho do app');
assert.match(guardas, /e\.isComposing/, 'acento/ç (teclado ABNT) não pode virar navegação');
// A trava tem que valer pra TODOS os atalhos, inclusive "/" e 1/2/3 — não só pras letras.
assert.ok(guardas.indexOf('state.focoLeadId') < atalhos.indexOf('e.key === "/"'),
  'a trava precisa vir antes de qualquer atalho, inclusive "/" e 1/2/3');

console.log('v1081-observacao-nao-perde-texto-nem-foco: ok');
