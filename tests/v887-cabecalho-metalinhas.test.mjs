import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v887 — cabeçalho do lead: (1) horário sem desencontro e (2) as 3 metalinhas padronizadas
// (uma embaixo da outra), em vez de 1 em cima + 2 juntas com " · " embaixo.

// 1. "Última mensagem" puxa a hora da PRÓPRIA última mensagem real (mesma do histórico),
//    não o lead.lastInteractionAt (ISO/UTC) que deslocava 3h ao converter pra São Paulo.
assert.match(app, /const ultimaMsgReal=\(typeof cp786UltimaMensagemReal==='function'\)\?cp786UltimaMensagemReal\(lead\):null;/,
  'deve buscar a última mensagem real');
assert.match(app, /const last=\(ultimaMsgReal&&ultimaMsgReal\.m\)\?cp704DataHora\(ultimaMsgReal\.m\):/,
  '"Última mensagem" deve formatar a hora da mensagem real (bate com o histórico)');

// 2. As 3 metalinhas são divs separadas (padronizadas), sem o join " · " de mensagem+atendimento.
assert.match(app, /`<div class="cp704-metaline">\$\{escapeHtml\(`Última mensagem — \$\{last\}`\)\}<\/div>`/,
  '"Última mensagem" deve ser uma metalinha própria');
assert.match(app, /`<div class="cp704-metaline">\$\{escapeHtml\(`Último atendimento — \$\{atendimento\}`\)\}<\/div>`/,
  '"Último atendimento" deve ser uma metalinha própria');
assert.doesNotMatch(app, /Última mensagem — \$\{last\}`:'',atendimento\?`Último atendimento/,
  'mensagem e atendimento não podem mais ficar juntos numa linha com " · "');

console.log('v887-cabecalho-metalinhas: ok');
