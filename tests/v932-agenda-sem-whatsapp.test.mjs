import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url).pathname, 'utf8');

// v932 — pedido do dono (print da tela Agenda): o botão "💬 WhatsApp" que aparecia nos cards
// da Agenda (quando o lead tinha telefone) era desnecessário ali — "Ver análise" já leva pro
// lead, de onde dá pra abrir o WhatsApp. Removido só o botão do card da Agenda.

const ini = app.indexOf('function agendaCardHTML(l, extra){');
const fim = app.indexOf('\n}', ini) + 2;
assert.ok(ini !== -1, 'agendaCardHTML não encontrada em app.js');
const fn = app.slice(ini, fim);

assert.doesNotMatch(fn, /WhatsApp/, 'o card da Agenda não deve mais ter botão de WhatsApp');
assert.doesNotMatch(fn, /fonePhone/, 'variável fonePhone (só existia pro botão de WhatsApp) removida');
assert.match(fn, /Ver análise/, '"Ver análise" continua no card');
assert.match(fn, /reagendarControlHTML/, 'Reagendar continua no card');
assert.match(fn, /removerLembrete/, 'Excluir continua no card');

// linkWhatsAppDireta segue usada em outro lugar do app (lead aberto) — não deve ser removida.
assert.match(app, /function linkWhatsAppDireta\(l\)\{/, 'linkWhatsAppDireta continua existindo (usada na tela do lead)');

console.log('v932-agenda-sem-whatsapp: ok');
