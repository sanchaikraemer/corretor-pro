import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v882 — bug do print: o corretor atendeu a Sara HOJE (marcou dentro do lead), mas na home
// ela continuava "parado 144d" e na lista de "Oportunidades esquecidas" (e virava "Parada de
// maior valor" no Raio-X). Causa: tudo media só a idade da última MENSAGEM do WhatsApp,
// ignorando o último ATENDIMENTO. diasParado() passa a considerar o atendimento.

// Extrai diasParado + dependências (diasCalendarioBR, ultimoAtendimentoTs) e executa de verdade.
const diasCal = app.match(/function diasCalendarioBR\(quando\)\{[\s\S]*?\n\}/);
const tipos = app.match(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/);
const ultAt = app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/);
const diasPar = app.match(/function diasParado\(l\)\{[\s\S]*?\n\}/);
assert.ok(diasCal && tipos && ultAt && diasPar, 'não achei diasParado + dependências em app.js');
const diasParado = eval(`${diasCal[0]}\n${tipos[0]}\n${ultAt[0]}\n${diasPar[0]}\n; diasParado`);

const hojeISO = new Date().toISOString();

// 1. Sara: última mensagem há 144 dias, MAS atendida hoje → parado = 0 (não é esquecida).
const sara = {
  daysSinceLastInteraction: 144,
  daysSinceClientReply: 144,
  analysis: { aprendizado: { eventos: [{ evento: 'contato_manual', quando: hojeISO }] } }
};
assert.equal(diasParado(sara), 0, 'lead atendido hoje deve contar parado=0, não 144');
assert.ok(!(diasParado(sara) >= 7), 'lead atendido hoje não pode entrar em "Oportunidades esquecidas"');

// 2. Sem atendimento nenhum: mantém a idade da última mensagem.
assert.equal(
  diasParado({ daysSinceClientReply: 144, daysSinceLastInteraction: 200 }),
  144,
  'sem atendimento, usa daysSinceClientReply'
);

// 3. Atendimento ANTIGO não zera um lead que voltou a esfriar: pega o toque mais recente.
const antigo = {
  daysSinceClientReply: 3,
  analysis: { aprendizado: { eventos: [{ evento: 'contato_manual', quando: '2020-01-01T12:00:00Z' }] } }
};
assert.equal(diasParado(antigo), 3, 'com mensagem mais recente que o atendimento, usa a mensagem');

// 4. Lead sem nenhum sinal de data → Infinity (nunca tocado), ainda tratável pelo >=7.
assert.equal(diasParado({}), Infinity, 'sem dado de data nenhum, retorna Infinity');

// 5. v1095 — as duas funções que este trecho verificava (leadsEsquecidos e radarRowHTML) foram
// REMOVIDAS junto com a seção "Oportunidades esquecidas", por ordem do dono: um cliente só pode
// ser Ativo ou Arquivado, sem nenhum outro nome. O que continua valendo — e é o que este teste
// realmente protege — é a regra de diasParado (contar a partir do último ATENDIMENTO, não da
// última mensagem), que segue viva em quem ainda a usa.
assert.doesNotMatch(app, /function leadsEsquecidos\b/, 'a lista de "esquecidos" não pode voltar');
assert.doesNotMatch(app, /function radarRowHTML\b/, 'o cartão da lista removida não pode voltar');

const usos = [...app.matchAll(/diasParado\(/g)].length;
assert.ok(usos >= 2, `diasParado precisa continuar sendo usada de verdade (achei ${usos} usos)`);

console.log('v882-parado-considera-atendimento: ok');
