import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url).pathname, 'utf8');

// v932 — pedido do dono (print da tela Agenda): o botão "💬 WhatsApp" que aparecia nos cards
// da Agenda (quando o lead tinha telefone) era desnecessário ali — "Ver análise" já leva pro
// lead, de onde dá pra abrir o WhatsApp. Removido só o botão do card da Agenda.

// v1233 — a função ganhou o parâmetro opcional da coluna de hora (horaHtml); a regra desta
// guarda (sem botão de WhatsApp no card) continua igual.
const ini = app.indexOf('function agendaCardHTML(l, extra, horaHtml){');
const fim = app.indexOf('\n}', ini) + 2;
assert.ok(ini !== -1, 'agendaCardHTML não encontrada em app.js');
const fn = app.slice(ini, fim);

assert.doesNotMatch(fn, /WhatsApp/, 'o card da Agenda não deve mais ter botão de WhatsApp');
assert.doesNotMatch(fn, /fonePhone/, 'variável fonePhone (só existia pro botão de WhatsApp) removida');
assert.match(fn, /Ver análise/, '"Ver análise" continua no card');
assert.match(fn, /reagendarControlHTML/, 'Reagendar continua no card');
assert.match(fn, /removerLembrete/, 'Excluir continua no card');

// v1293 — ATENÇÃO, ISTO ESTAVA ERRADO DESDE A v1076. Aqui estava escrito que "linkWhatsAppDireta
// segue usada em outro lugar do app (lead aberto)". Não seguia: o único chamador era o card do
// "top 3" da Home, que já estava sem porta de entrada. A tela do lead monta o link do WhatsApp
// por conta própria. A função saiu na faxina da v1293, junto com whatsappLink.
assert.ok(!/function linkWhatsAppDireta\(/.test(app),
  'linkWhatsAppDireta saiu na v1293 — se voltar, precisa voltar com uma tela chamando');

console.log('v932-agenda-sem-whatsapp: ok');
