import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v931 — dois prints do dono: (1) o tile "Agenda" da Home levava pra Condução do atendimento
// (aba "Agenda" de lá, cp786AbrirConducao('programados')) em vez da tela Agenda de verdade
// (aba de baixo) — "agenda vai pra condução, e nao pode, tenque ir pra agenda, isso é óbvio".
// (2) o NÚMERO do tile também não batia com a tela Agenda real: 11 na Home vs 3 na Agenda —
// porque cp786Categoria conta como "programados" também compromisso VENCIDO (fica em destaque
// até ser atendido, decisão de outra tela), e a tela Agenda nunca lista vencido de lead ativo.

// 1. O tile agora navega pra tela Agenda de verdade (mesma função da aba de baixo), não pra Condução.
const iniRBH = app.indexOf('renderResumoDia = function(items){');
const fimRBH = app.indexOf('\n};', iniRBH) + 3;
assert.ok(iniRBH !== -1, 'renderResumoDia não encontrada em app.js');
const rbh = app.slice(iniRBH, fimRBH);
assert.match(rbh, /onclick="show\('agenda'\)"><span>Agenda<\/span>/, 'o tile Agenda deve abrir a tela Agenda (show(\'agenda\')), não a Condução');
assert.doesNotMatch(rbh, /cp786AbrirConducao\('programados'\)/, 'o tile Agenda não pode mais abrir a Condução');

// 2. O número do tile vem de cpAgendaContagem (mesma régua da tela Agenda), não de cp786Categoria.
assert.match(rbh, /const compromissos ?= ?cpAgendaContagem\(ativos\)/, 'a contagem do tile Agenda deve vir de cpAgendaContagem');

// 3. cpAgendaContagem — o número do tile precisa bater com a tela Agenda.
//
// v1093 — A PREMISSA ORIGINAL DESTE TESTE ENVELHECEU. Em v931 o vencido não podia contar porque
// "a tela Agenda nunca lista vencido de lead ativo". Só que a v1011 criou a seção "Atrasados" no
// TOPO da tela Agenda — desde então o vencido É listado lá, e o tile da Home passou a mostrar
// MENOS do que a tela, escondendo justamente o item mais urgente. O dono mandou corrigir:
// "então deve constar como atrasado".
// A regra que este teste protege continua a mesma — tile e tela contam a MESMA coisa —, só que
// agora essa mesma coisa inclui o atrasado.
const fnSrc = app.match(/function cpAgendaResumo\(items\)\{[\s\S]*?\n\}/)[0];
const contagemSrc = app.match(/function cpAgendaContagem\(items\)\{[^\n]*\}/)[0];
const lembreteTsSrc = app.match(/function lembreteTs\(l\)\{[\s\S]*?\n\}/)[0];
assert.ok(fnSrc && contagemSrc && lembreteTsSrc, 'cpAgendaResumo/cpAgendaContagem/lembreteTs não encontradas em app.js');

const hoje = new Date(); hoje.setHours(10,0,0,0);
const futuro = new Date(Date.now() + 5*86400000);
const vencido = new Date(Date.now() - 5*86400000);

// As duas funções auxiliares ficam sob controle do teste (é o que decide quem está atrasado).
const { cpAgendaContagem, cpAgendaResumo } = eval(`
  const cp786CompromissoAtrasado = (l) => String(l.id||'').startsWith('vencido') ? { dias: 5 } : null;
  const cpCompromissosVencidosDoLead = (l) => (l._vencidos || []);
  ${lembreteTsSrc}
  ${fnSrc}
  ${contagemSrc}
  ({ cpAgendaContagem, cpAgendaResumo });
`);

const items = [
  { id:'hoje1', analysis:{ lembrete:{ quando: hoje.toISOString() } } },
  { id:'futuro1', analysis:{ lembrete:{ quando: futuro.toISOString() } } },
  { id:'vencido1', analysis:{ lembrete:{ quando: vencido.toISOString() } } }, // agora conta, como ATRASADO
  { id:'comp1', analysis:{ confirmedAppointments:[{ oQue:'visita' }, { oQue:'ligação' }] } },
  { id:'nada', analysis:{} },
];

assert.equal(cpAgendaContagem(items), 5,
  'hoje(1) + futuro(1) + 2 compromissos confirmados + 1 atrasado = 5');
assert.equal(cpAgendaContagem([items[2]]), 1,
  'compromisso atrasado sozinho conta 1 — ele é listado na tela Agenda, então precisa constar no tile');

const resumo = cpAgendaResumo(items);
assert.equal(resumo.atrasados, 1, 'o resumo precisa separar quantos estão atrasados (é o que o sino destaca)');
assert.equal(resumo.agendados, 4, 'e quantos estão apenas agendados');
assert.equal(resumo.total, resumo.agendados + resumo.atrasados, 'o total é a soma dos dois');

console.log('v931-agenda-tile-bate-com-agenda: ok');
