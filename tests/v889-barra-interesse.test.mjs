import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v889 — barra de "Interesse do cliente" no lugar do funil "passo X de 6". Mede mensagens
// DO CLIENTE (não as minhas), teto 30 = cheia. O ranking "Fazer agora" usa a mesma régua.

// 1. mensagensDoCliente executa: conta só as do cliente, ignora as minhas e itens manuais.
const fn = app.match(/function mensagensDoCliente\(l\)\{[\s\S]*?\n\}/)[0];
const mensagensDoCliente = eval(`
  const BUSINESS_RE = /senger|construtora|imobili/i;
  function ehMsgDoCliente(m, pn){
    const autor=String(m?.author||'').trim(); if(!autor||autor==='Sistema') return false;
    if(BUSINESS_RE.test(autor)) return false;
    if(/^(sanchai|corretor)$/i.test(autor)) return false; // "eu"
    return true;
  }
  ${fn}
  mensagensDoCliente;
`);
const lead = { name: 'Claudia', recentMessages: [
  { author: 'Claudia', text: 'oi', source: 'whatsapp' },       // cliente
  { author: 'Claudia', text: 'quero visitar', source: 'whatsapp' }, // cliente
  { author: 'Sanchai', text: 'te mando os detalhes', source: 'whatsapp' }, // eu
  { author: 'Sanchai', text: 'visita feita', source: 'manual', type: 'visita' }, // manual
  { author: 'Claudia', text: '', source: 'whatsapp' },          // vazia, ignora
]};
assert.equal(mensagensDoCliente(lead), 2, 'conta só as 2 mensagens reais da cliente');

// 2. A barra usa mensagensDoCliente e o teto de 30, no lugar do badge de jornada.
assert.match(app, /const CP_TETO_BARRA_INTERESSE = 100;/, 'teto da barra = 100 mensagens do cliente');
const barra = app.match(/function cp704BarraInteresse\(lead\)\{[\s\S]*?\n  \}/)[0];
assert.match(barra, /mensagensDoCliente\(lead\)/, 'a barra conta mensagens do cliente');
assert.match(barra, /Interesse do cliente/, 'a barra tem o rótulo "Interesse do cliente"');
assert.match(barra, /n\/teto\*100/, 'preenchimento proporcional ao teto');

// 3. O ranking "Fazer agora" passa a contar só mensagens do cliente (mesma régua).
const nota = app.match(/function cpNotaPrioridade\(l\)\{[\s\S]*?\n\}/)[0];
assert.match(nota, /mensagensDoCliente\(l\)/, 'o ranking usa mensagens do cliente');
assert.doesNotMatch(nota, /totalMensagensLead/, 'o ranking não usa mais o total de mensagens');

console.log('v889-barra-interesse: ok');
