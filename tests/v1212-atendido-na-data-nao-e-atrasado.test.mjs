import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1212 — relato do dono (11/08/2026, print da Agenda): o lead "Bocorni" estava em
// "Atrasados — retome ou descarte" por causa do lembrete de 10/08, mas o próprio cadastro mostrava
// que ele havia sido atendido em 10/08. Ou seja: o compromisso foi CUMPRIDO no dia marcado e o app
// cobrava assim mesmo no dia seguinte.
//
// A régua antiga (v1199) só perdoava quem tivesse sido atendido HOJE — o que resolve o dia do
// compromisso, mas não o dia seguinte. Agora o atendimento feito NA DATA do compromisso (ou depois)
// cumpre aquele compromisso.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function extrair(nome, marcaFim){
  const ini = app.indexOf(nome);
  assert.ok(ini > -1, `não achei ${nome}`);
  const fim = app.indexOf(marcaFim, ini);
  assert.ok(fim > ini, `não achei o fim de ${nome}`);
  return app.slice(ini, app.lastIndexOf('}', fim) + 1);
}

const fonteJaAtendido = extrair('function cpCompromissoJaAtendido(l, ts){', 'window.cpCompromissoJaAtendido=');
const fonteAtrasado = extrair('function cp786CompromissoAtrasado(l){', 'window.cp786CompromissoAtrasado=');

const DIA = 24 * 60 * 60 * 1000;
const ts = (iso, hora = '12:00') => Date.parse(`${iso}T${hora}:00-03:00`);
const HOJE = '2026-08-11';

// Stubs: só o que a função precisa do resto do app, com o mesmo contrato de lá.
const ui671DiasAte = (iso) => Math.round((ts(String(iso).slice(0, 10)) - ts(HOJE)) / DIA);
const cp786DataTs = (data, hora = '12:00') => ts(String(data).slice(0, 10), hora);
const ultimoAtendimentoTs = (l) => Number(l?.__atendidoTs || 0);

const cpCompromissoJaAtendido = new Function('ultimoAtendimentoTs', `${fonteJaAtendido}\nreturn cpCompromissoJaAtendido;`)(ultimoAtendimentoTs);
const cp786CompromissoAtrasado = new Function(
  'leadEhAtivo', 'ehContatadoHoje', 'ui671DiasAte', 'cp786DataTs', 'compromissosDispensados', 'cpCompromissoJaAtendido',
  `${fonteAtrasado}\nreturn cp786CompromissoAtrasado;`
)(() => true, () => null, ui671DiasAte, cp786DataTs, () => new Set(), cpCompromissoJaAtendido);

const leadComLembrete = (extra = {}) => ({ id: 'x', etapa: 'Ativo', analysis: { lembrete: { quando: `${'2026-08-10'}T10:00:00-03:00` } }, ...extra });

// 1. O caso do dono: lembrete de 10/08 e atendimento em 10/08 → cumprido, não é atrasado.
assert.equal(
  cp786CompromissoAtrasado(leadComLembrete({ __atendidoTs: ts('2026-08-10', '09:30') })),
  null,
  'atendimento no dia do compromisso cumpre o compromisso'
);

// 2. Atendimento DEPOIS da data também cumpre.
assert.equal(
  cp786CompromissoAtrasado(leadComLembrete({ __atendidoTs: ts('2026-08-11', '08:00') })),
  null,
  'atendimento depois da data também cumpre'
);

// 3. Atendimento ANTES da data não cumpre nada — continua atrasado.
const antes = cp786CompromissoAtrasado(leadComLembrete({ __atendidoTs: ts('2026-08-08', '15:00') }));
assert.ok(antes && antes.dias === 1, 'atendimento anterior à data não pode apagar o atrasado');

// 4. Sem nenhum atendimento, segue atrasado (a régua não pode virar peneira).
const semAtendimento = cp786CompromissoAtrasado(leadComLembrete());
assert.ok(semAtendimento && semAtendimento.dias === 1, 'sem atendimento o compromisso continua atrasado');

// 5. Compromisso confirmado (não só lembrete) segue a mesma régua.
const comCompromisso = (atendidoTs) => ({
  id: 'y', etapa: 'Ativo',
  __atendidoTs: atendidoTs,
  analysis: { confirmedAppointments: [{ data: '2026-08-09', oQue: 'visita', trechoLiteral: 'combinado dia 9' }] }
});
assert.equal(cp786CompromissoAtrasado(comCompromisso(ts('2026-08-09', '16:00'))), null, 'visita atendida no dia marcado não é atrasado');
assert.ok(cp786CompromissoAtrasado(comCompromisso(0)), 'visita sem atendimento nenhum continua atrasada');

// 6. A comparação é por DIA no fuso de São Paulo (compromisso das 14h atendido às 9h do mesmo dia
//    está cumprido — ninguém registra atendimento com cronômetro).
assert.equal(cpCompromissoJaAtendido({ __atendidoTs: ts('2026-08-10', '09:00') }, ts('2026-08-10', '14:00')), true, 'mesmo dia, hora anterior: cumprido');
assert.equal(cpCompromissoJaAtendido({ __atendidoTs: ts('2026-08-09', '23:00') }, ts('2026-08-10', '00:30')), false, 'dia anterior não cumpre');
assert.equal(cpCompromissoJaAtendido({ __atendidoTs: 0 }, ts('2026-08-10')), false, 'lead nunca atendido não cumpre nada');
assert.equal(cpCompromissoJaAtendido({ __atendidoTs: ts('2026-08-10') }, 0), false, 'sem data de compromisso não há o que cumprir');

// 7. A lista de vencidos DENTRO do lead usa a mesma régua (senão o contador diz uma coisa e a
//    lista do lead diz outra).
const fonteVencidos = extrair('function cpCompromissosVencidosDoLead(l){', 'window.cpCompromissosVencidosDoLead=');
assert.match(fonteVencidos, /if\(cpCompromissoJaAtendido\(l, cp786DataTs\(data,'12:00'\)\)\) continue;/, 'a lista de vencidos do lead precisa respeitar o atendimento na data');

console.log('v1212-atendido-na-data-nao-e-atrasado: ok');
