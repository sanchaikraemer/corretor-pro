import fs from 'node:fs';
import assert from 'node:assert/strict';

// v980 — print do dono (24/07): a Home dizia "11 atendidos hoje" e a tela Atendimentos, no
// mesmo instante, listava 12 nomes reais pro dia de hoje. Causa: cpAtendidosHojeTotal (usada
// pela Home e pela dose de "Fazer agora") filtrava por leadEhAtivo, então um lead atendido E
// arquivado (Vendido/Perdido/Geladeira) no mesmo dia saía da conta — mas cp788RenderAtendimentos
// (tela Atendimentos) nunca teve esse filtro. A própria v907 (comentário em renderSaudacao) já
// dizia que a conta deveria incluir arquivados; só nunca tinha sido aplicado aqui de fato.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// renderSaudacao precisa delegar pra cpAtendidosHojeTotal, não ter sua própria conta divergente.
assert.match(app, /const tratadosHoje = cpAtendidosHojeTotal\(items\);/,
  'a saudação da Home precisa usar a MESMA função de contagem que a dose usa (cpAtendidosHojeTotal)');
assert.doesNotMatch(app, /for\(const l of items\)\{ if\(ehContatadoHoje\(l\)\) tratadosHoje\+\+; \}/,
  'a conta duplicada e divergente de tratadosHoje precisa ter sido removida');

const inicioDia = app.match(/function inicioDoDiaBR\(\)\{[\s\S]*?\n\}/);
const ehContatado = app.match(/function ehContatadoHoje\(l\)\{[\s\S]*?\n\}/);
const total = app.match(/function cpAtendidosHojeTotal\(items\)\{[\s\S]*?\n\}/);
assert.ok(inicioDia && ehContatado && total, 'não consegui extrair inicioDoDiaBR/ehContatadoHoje/cpAtendidosHojeTotal de app.js');

const cpAtendidosHojeTotalSandbox = eval(`
  let state = { todosLeads: [] };
  ${inicioDia[0]}
  ${ehContatado[0]}
  ${total[0]}
  cpAtendidosHojeTotal
`);

const agora = new Date().toISOString();
const evento = { evento: 'contato_manual', quando: agora };

// Cenário do print: 2 leads ativos atendidos hoje + 1 lead atendido hoje mas já arquivado
// (Geladeira). "items" (o que a Home usa pra montar a lista) só traz os 2 ativos — mas
// cpAtendidosHojeTotal, quando state.todosLeads está carregada, precisa enxergar os 3.
const ativo1 = { id: '1', etapa: 'Atendimento', analysis: { aprendizado: { eventos: [evento] } } };
const ativo2 = { id: '2', etapa: 'Negociação', analysis: { aprendizado: { eventos: [evento] } } };
const arquivadoHoje = { id: '3', etapa: 'Geladeira', analysis: { aprendizado: { eventos: [evento] } } };
const items = [ativo1, ativo2]; // já filtrado (leadEhAtivo) por quem chama, como no app real

// Sem state.todosLeads carregada ainda: cai pro fallback (items) — não pode quebrar em boot cedo.
assert.equal(cpAtendidosHojeTotalSandbox(items), 2, 'sem a base completa carregada, usa items como fallback');

// Com a base completa (equivalente a state.todosLeads = all, do jeito que _processarDashboard salva):
globalThis.__v980State = { todosLeads: [ativo1, ativo2, arquivadoHoje] };
const comBaseCompleta = eval(`
  let state = globalThis.__v980State;
  ${inicioDia[0]}
  ${ehContatado[0]}
  ${total[0]}
  cpAtendidosHojeTotal(${JSON.stringify(items)})
`);
assert.equal(comBaseCompleta, 3, 'com a carteira completa carregada, o lead arquivado hoje também precisa contar (era o bug: sumia, dando 2 em vez de 3)');
delete globalThis.__v980State;

console.log('v980-atendidos-hoje-inclui-arquivados: ok');
