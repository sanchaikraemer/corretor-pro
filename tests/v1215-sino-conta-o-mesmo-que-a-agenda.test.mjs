import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1215 — print do dono (11/08/2026, 13:21): o sino do topo avisava "2" e a tela Agenda listava
// "LEMBRETES DE HOJE (1)", sem nenhuma seção de atrasados. Dois números pro mesmo dia.
//
// Causa: o número do sino (atualizarSinoAgenda) e as listas da Agenda (carregarAgenda) eram dois
// cálculos parecidos escritos em lugares diferentes. Quando a v1199 ensinou a Agenda a tirar da
// lista do dia quem já foi atendido hoje, o sino não ficou sabendo — e continuou cobrando um
// cliente que já tinha saído da tela. Somava a isso o fato de marcar atendimento redesenhar só a
// barra de compromissos do topo, nunca o sino.
//
// Correção: uma fonte única (cpAgendaDoDia) alimenta as duas telas, o sino conta PESSOAS (quem
// tem lembrete E compromisso no mesmo dia é um cliente só) e toda marcação de atendimento
// recalcula os dois avisos juntos.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function extrair(nome){
  const re = new RegExp(`function ${nome}\\(([^)]*)\\)\\{[\\s\\S]*?\\n\\}`);
  const m = app.match(re);
  assert.ok(m, `função ${nome} não encontrada em app.js`);
  return m[0];
}

// ─── 1. A fonte é uma só ──────────────────────────────────────────────────────────────────────
{
  assert.match(extrair('atualizarSinoAgenda'), /cpAgendaDoDia\(ativos\)/,
    'o sino precisa contar a partir da mesma função que monta as listas da Agenda');
  const agenda = app.match(/async function carregarAgenda\(\)\{[\s\S]*?\n\}\n/)[0];
  assert.match(agenda, /=\s*cpAgendaDoDia\(items\)/,
    'a tela Agenda precisa montar as listas do dia pela fonte única');
  // Nada de recalcular o dia por fora: era exatamente essa cópia paralela que divergiu.
  assert.doesNotMatch(extrair('atualizarSinoAgenda'), /confirmedAppointments/,
    'o sino não pode voltar a ter régua própria de compromisso');
}

// ─── 2. O comportamento: quem foi atendido hoje sai do dia (lista E sino) ─────────────────────
{
  const src = extrair('cpAgendaDoDia') + '\n' + extrair('lembreteTs');
  const hoje = new Date(); hoje.setHours(14, 0, 0, 0);

  const montar = (atendidos, atrasadoIds = []) => eval(`
    const ehContatadoHoje = (l) => ${JSON.stringify(atendidos)}.includes(l.id) ? { evento: 'contato_manual' } : null;
    const cp786CompromissoAtrasado = (l) => ${JSON.stringify(atrasadoIds)}.includes(l.id) ? { dias: 3 } : null;
    ${src}
    ({ cpAgendaDoDia });
  `).cpAgendaDoDia;

  const items = [
    { id: 'mateus', analysis: { lembrete: { quando: hoje.toISOString() } } },
    { id: 'ja-atendido', analysis: { lembrete: { quando: hoje.toISOString() } } }
  ];

  // Ninguém atendido ainda: os dois são do dia.
  assert.equal(montar([])(items).lembretesHoje.length, 2);

  // O caso do print: um dos dois já foi atendido hoje. A Agenda mostrava 1 — o sino dizia 2.
  const r = montar(['ja-atendido'])(items);
  assert.equal(r.lembretesHoje.length, 1, 'quem foi atendido hoje sai da lista do dia');
  assert.equal(r.lembretesHoje[0].id, 'mateus');

  // Compromisso confirmado de HOJE segue a mesma régua; o de amanhã não é afetado.
  const comItems = [
    { id: 'visita-hoje', analysis: { confirmedAppointments: [{ oQue: 'visita', quando: 'hoje às 15h' }] } },
    { id: 'visita-amanha', analysis: { confirmedAppointments: [{ oQue: 'visita', quando: 'amanhã cedo' }] } }
  ];
  const c1 = montar([])(comItems);
  assert.equal(c1.compHoje.length, 1);
  assert.equal(c1.compAmanha.length, 1);
  const c2 = montar(['visita-hoje', 'visita-amanha'])(comItems);
  assert.equal(c2.compHoje.length, 0, 'compromisso de hoje some quando o cliente é atendido hoje');
  assert.equal(c2.compAmanha.length, 1, 'compromisso de amanhã não pode sumir por causa de hoje');
}

// ─── 3. O sino conta PESSOAS, não linhas ──────────────────────────────────────────────────────
{
  // Um cliente com lembrete de hoje E compromisso de hoje aparece em duas seções da Agenda, mas é
  // uma pessoa só esperando por você — o sino não pode dizer 2. E quem já está sendo cobrado como
  // atrasado não pode ser somado de novo na conta do dia.
  const contar = (buckets) => {
    const chave = (l) => String(l?.id || '');
    const atrasadosIds = new Set(buckets.atrasados.map(x => chave(x.l)));
    const hojeIds = new Set();
    for (const l of [...buckets.lembretesHoje, ...buckets.compHoje]) {
      const k = chave(l);
      if (!atrasadosIds.has(k)) hojeIds.add(k);
    }
    return { agendaN: hojeIds.size, atrasadosN: atrasadosIds.size };
  };

  const umSo = contar({
    lembretesHoje: [{ id: 'ana' }],
    compHoje: [{ id: 'ana', _ap: {} }],
    atrasados: []
  });
  assert.equal(umSo.agendaN, 1, 'um cliente com lembrete e compromisso no mesmo dia conta 1');

  const comAtraso = contar({
    lembretesHoje: [{ id: 'ana' }, { id: 'bruno' }],
    compHoje: [],
    atrasados: [{ l: { id: 'bruno' }, at: { dias: 2 } }]
  });
  assert.equal(comAtraso.atrasadosN, 1);
  assert.equal(comAtraso.agendaN, 1, 'quem já é cobrado como atrasado não conta também como do dia');

  // A conta que vai pro sino continua somando os dois grupos (regra da v1093).
  assert.match(extrair('atualizarSinoAgenda'), /state\.agendaCount\s*=\s*agendaN\s*\+\s*atrasadosN/);
}

// ─── 4. Marcar atendimento acerta o sino na hora, não só a barra do topo ──────────────────────
{
  assert.match(app, /function cpAtualizarAvisosAgenda\(\)\{/,
    'precisa existir um ponto único que refaz barra do topo + sino');
  const avisos = extrair('cpAtualizarAvisosAgenda');
  assert.match(avisos, /carregarAgendaTopo/, 'a barra de compromissos do topo continua sendo redesenhada');
  assert.match(avisos, /atualizarSinoAgenda\(memoria\)/,
    'o sino precisa usar a carteira que já está em memória, com a marcação recém-aplicada');

  // Os dois botões (marcar e desmarcar) e o ponto de reconciliação usado por cópia de mensagem,
  // observação e agendamento passaram a chamar isso.
  assert.doesNotMatch(app, /carregarAgendaTopo\?\.\(\);\n\s*loadRecentLeads/,
    'marcar/desmarcar atendimento não pode mais atualizar só a barra do topo');
  assert.match(extrair('ui667ReconciliarAtendimentoLocal'), /cpAtualizarAvisosAgenda/,
    'toda marcação de atendimento passa por aqui — o sino precisa se acertar junto');
}

console.log('v1215-sino-conta-o-mesmo-que-a-agenda: ok');
