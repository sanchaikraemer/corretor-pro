import fs from 'node:fs';
import assert from 'node:assert/strict';

// v918 — bug do print (Matheus Bruel): o corretor marcou "Atendido", voltou pra Home e o lead
// continuava aparecendo em "Oportunidades esquecidas" com o mesmo "187d parado" de antes, como
// se a marcação nunca tivesse acontecido.
//
// Causa: ui667MarcarAtendido aplica o atendimento localmente (correto, na hora) e dispara
// loadRecentLeads(false) em paralelo pra buscar a carteira atualizada do servidor. Só que esse
// fetch pode responder com uma versão do banco de ALGUNS INSTANTES ATRÁS (o mesmo caso que
// recarregarLeadFoco já trata pro lead aberto, só que aquele tratamento NUNCA cobria
// state.todosLeads/state.leads/state.itemsAtivos — as listas que alimentam a Home). Como
// loadRecentLeads SUBSTITUI esses arrays por objetos novos vindos do servidor, a marcação que
// tínhamos acabado de aplicar era apagada assim que esse fetch "atrasado" respondia — mesmo o
// clique tendo funcionado, o card ficava desatualizado até um F5.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v980: ganhou um 5º parâmetro opcional (detalhes) pra permitir marcar atendimento também ao
// salvar observação, não só pelo botão — mantendo o padrão { tipo, de } já usado no evento.
const aplicar = app.match(/function ui667AplicarAtendidoLocal\(lead, quando, dataBR, horaBR, detalhes[^)]*\)\{[\s\S]*?\n\}/);
const remover = app.match(/function ui667RemoverAtendidoLocal\(lead\)\{[\s\S]*?\n\}/);
const reconciliar = app.match(/function ui667ReconciliarAtendimentoLocal\(leadId, aplicarFn\)\{[\s\S]*?\n\}/);
assert.ok(aplicar && remover && reconciliar, 'não achei ui667AplicarAtendidoLocal/ui667RemoverAtendidoLocal/ui667ReconciliarAtendimentoLocal em app.js');

// Sandbox mínimo: state.active fica em 'lead' (não 'home'), então o ramo que recalcula a Home
// nem entra em jogo — este teste isola só a reconciliação dos arrays, que é a causa raiz do bug.
const state = { itemsAtivos: null, todosLeads: null, leads: null, active: 'lead', lead: { id: 'matheus' }, grupoAtivo: null };
const ui667ReconciliarAtendimentoLocal = eval(`
  ${aplicar[0]}
  ${remover[0]}
  (function(){ ${reconciliar[0]}; return ui667ReconciliarAtendimentoLocal; })()
`);

function leadCru(id){ return { id, name: 'Matheus Bruel', analysis: {} }; }

// 1. Estado inicial: o fetch "atrasado" já tinha respondido antes de marcarmos, deixando um
// objeto SEM o evento de atendimento (como se a marcação nunca tivesse ocorrido).
state.todosLeads = [leadCru('matheus')];
state.itemsAtivos = [leadCru('matheus')]; // objeto DIFERENTE (arrays independentes, como no app real)
state.leads = state.todosLeads.slice(0, 8);

// 2. loadRecentLeads(false) responde com uma versão do banco de "alguns instantes atrás" —
// SUBSTITUI os arrays por objetos novos, nenhum deles com o atendimento marcado.
state.todosLeads = [leadCru('matheus')];
state.leads = state.todosLeads.slice(0, 8);

// 3. A reconciliação roda no .then() do fetch (como no app real) e precisa reaplicar o
// atendimento em CIMA desses objetos novos — mesmo eles tendo acabado de substituir os antigos.
ui667ReconciliarAtendimentoLocal('matheus', item => {
  item.analysis = item.analysis || {};
  item.analysis.aprendizado = item.analysis.aprendizado || {};
  const eventos = item.analysis.aprendizado.eventos || [];
  eventos.push({ evento: 'contato_manual', detalhes: { tipo: 'Atendido', de: 'botao_atendido' }, quando: new Date().toISOString() });
  item.analysis.aprendizado.eventos = eventos;
});

for(const [nomeLista, lista] of [['todosLeads', state.todosLeads], ['itemsAtivos', state.itemsAtivos], ['leads', state.leads]]){
  const item = lista.find(l => l.id === 'matheus');
  assert.ok(item, `matheus deveria continuar em state.${nomeLista}`);
  const temEvento = (item.analysis?.aprendizado?.eventos || []).some(e => e.evento === 'contato_manual');
  assert.ok(temEvento, `state.${nomeLista}: a marcação de atendido precisa sobreviver ao fetch atrasado que substituiu os objetos`);
}

// 4. As duas chamadas reais (Marcar e Desmarcar) precisam encadear a reconciliação no fetch,
// não só disparar loadRecentLeads solto (era exatamente essa lacuna que perdia a marcação).
assert.match(app, /loadRecentLeads\(false\)\.then\(\(\) => ui667ReconciliarAtendimentoLocal\(lead\.id, item => ui667AplicarAtendidoLocal/,
  'ui667MarcarAtendido precisa reconciliar depois do fetch da carteira');
assert.match(app, /loadRecentLeads\(false\)\.then\(\(\) => ui667ReconciliarAtendimentoLocal\(lead\.id, item => ui667RemoverAtendidoLocal/,
  'ui667DesmarcarAtendido precisa reconciliar depois do fetch da carteira');

console.log('v918-atendido-sobrevive-fetch-atrasado: ok');
