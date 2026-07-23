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

// 3. cpAgendaContagem — comportamento: conta lembrete de hoje/futuro e compromissos confirmados;
// NÃO conta lembrete vencido (igual à tela Agenda, que não lista vencido de lead ativo).
const fnSrc = app.match(/function cpAgendaContagem\(items\)\{[\s\S]*?\n\}/)[0];
const lembreteTsSrc = app.match(/function lembreteTs\(l\)\{[\s\S]*?\n\}/)[0];
assert.ok(fnSrc && lembreteTsSrc, 'cpAgendaContagem/lembreteTs não encontradas em app.js');

const { cpAgendaContagem } = eval(`
  ${lembreteTsSrc}
  ${fnSrc}
  ({ cpAgendaContagem });
`);

const hoje = new Date(); hoje.setHours(10,0,0,0);
const futuro = new Date(Date.now() + 5*86400000);
const vencido = new Date(Date.now() - 5*86400000);

const items = [
  { id:'hoje1', analysis:{ lembrete:{ quando: hoje.toISOString() } } },
  { id:'futuro1', analysis:{ lembrete:{ quando: futuro.toISOString() } } },
  { id:'vencido1', analysis:{ lembrete:{ quando: vencido.toISOString() } } }, // não deve contar
  { id:'comp1', analysis:{ confirmedAppointments:[{ oQue:'visita' }, { oQue:'ligação' }] } },
  { id:'nada', analysis:{} },
];

assert.equal(cpAgendaContagem(items), 4, 'hoje(1) + futuro(1) + 2 compromissos confirmados = 4; vencido não conta');
assert.equal(cpAgendaContagem([items[2]]), 0, 'lembrete vencido sozinho conta 0 (some do tile, igual à tela Agenda)');

console.log('v931-agenda-tile-bate-com-agenda: ok');
