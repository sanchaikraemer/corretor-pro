import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1034 — o dono reportou que, ao voltar do WhatsApp pra registrar uma observação, o botão
// "Salvar observação" mostrou erro técnico cru na tela ("signal is aborted without reason" e,
// na tentativa seguinte, "Failed to fetch") — exatamente o cenário que fetchComTimeout já
// previa em comentário (rede "pendurada" reconectando depois de voltar de outro app), mas que
// cp7ObsSalvar ainda não tratava: só uma tentativa, e o erro cru (err.message) ia direto pra
// tela em vez de passar por userFriendlyError (já usado no fluxo de importar ZIP).

const ini = app.indexOf('window.cp7ObsSalvar = async function(btn){');
assert.ok(ini > -1, 'cp7ObsSalvar não encontrada em app.js');
const fim = app.indexOf('\nwindow.ui670Reanalisar', ini);
assert.ok(fim > ini, 'fim de cp7ObsSalvar não encontrado');
const bloco = app.slice(ini, fim);

// 1. Tenta de novo pelo menos uma vez antes de desistir (mesmo padrão do v1020).
const chamadas = bloco.match(/enviarObservacao\(\)/g) || [];
assert.ok(chamadas.length >= 2, 'precisa tentar enviar a observação pelo menos DUAS vezes antes de desistir');

// 2. O erro final mostrado ao corretor passa pela tradução amigável (não mais err.message cru).
assert.match(bloco, /status\.innerHTML\s*=\s*'<span style="color:var\(--risco\)">'\+escapeHtml\(userFriendlyError\(err\)\)/,
  'o erro final de salvar observação precisa usar userFriendlyError, não err.message cru');
assert.ok(!/escapeHtml\(String\(err\?\.message\|\|err\)\)/.test(bloco),
  'não pode mais mostrar err.message cru ("signal is aborted...", "Failed to fetch") na tela');

console.log('v1034-observacao-tenta-de-novo-e-erro-legivel: ok');
