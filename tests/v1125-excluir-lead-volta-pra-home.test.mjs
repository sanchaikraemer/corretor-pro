import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1125 — relato do dono: "depois q excluir um lead, ele deve voltar a tela da home, e nao ficar
// travado ali sem fazer nada."
//
// Causa: abrir um lead liga o MODO DETALHE (ui667ModoDetalheLead(true)), que põe a classe
// lead-foco-aberto no body E display:none!important direto no cabeçalho da Home, nos cartões de
// números, no top3 e na coluna lateral. Os dois caminhos de exclusão só zeravam state.lead /
// focoLeadId e chamavam show("home") — nada disso desliga o modo detalhe. A Home voltava a ser a
// tela ativa, mas escondida, com o lead apagado ainda desenhado: tela morta.
//
// Correção: os dois caminhos passam por cpVoltarProHomeSemLead(), que limpa o lead pelo caminho
// oficial (cpClearLeadState → ui667ModoDetalheLead(false)), sai de qualquer lista aberta e
// redesenha a Home — o mesmo caminho já provado do botão "Voltar".

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const pega = (re, oque) => {
  const m = app.match(re);
  assert.ok(m, `não achei ${oque} no app.js`);
  return m[0];
};
// Sem os comentários — eles citam o jeito antigo de propósito, e não podem ser confundidos com código.
const semComentarios = txt => txt.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

// 1) O caminho único de volta pra Home existe e faz as quatro coisas que importam.
const helper = pega(/function cpVoltarProHomeSemLead\(\)\{[\s\S]*?\n\}/, 'cpVoltarProHomeSemLead');
assert.match(helper, /cpClearLeadState\(\)/,
  'precisa limpar o lead pelo caminho oficial — é ele que desliga o modo detalhe');
assert.match(helper, /state\.grupoAtivo\s*=\s*null/,
  'precisa sair da lista de onde o lead foi aberto (ele não existe mais lá)');
assert.match(helper, /show\("home"/, 'precisa ativar a tela Hoje');
assert.match(helper, /renderBotoesHome\(\)/, 'precisa redesenhar a Home, senão a área do lead fica lá');

// cpClearLeadState é quem desliga o modo detalhe — se isso mudar, o resto do teste vira teatro.
const limpar = pega(/function cpClearLeadState\(\)\{[\s\S]*?\n\}/, 'cpClearLeadState');
assert.match(limpar, /ui667ModoDetalheLead\(false\)/,
  'cpClearLeadState precisa desligar o modo detalhe (é o que devolve cabeçalho e cartões)');

// 2) Os dois caminhos de exclusão usam o helper — e nenhum deles volta ao show("home") pelado.
const doModal = pega(/async function excluirLeadDoModal\(id, nome\)\{[\s\S]*?\n\}/, 'excluirLeadDoModal');
assert.match(doModal, /cpVoltarProHomeSemLead\(\)/, 'excluir pelo modal precisa voltar pra Home limpa');
assert.doesNotMatch(semComentarios(doModal), /show\("home"\)/, 'show("home") pelado deixava o modo detalhe ligado');
// Cancelar a confirmação (ou erro) não pode tirar o corretor da tela do cliente.
assert.match(doModal, /const apagou = await apagarLead\(id, nome\);[\s\S]*if\(apagou\) cpVoltarProHomeSemLead\(\)/,
  'só volta pra Home se o lead foi mesmo apagado');

const definitivo = pega(/async function excluirLeadDefinitivo\(id, nome\)\{[\s\S]*?\n\}/, 'excluirLeadDefinitivo');
assert.match(definitivo, /cpVoltarProHomeSemLead\(\)/, 'excluir definitivamente precisa voltar pra Home limpa');
assert.doesNotMatch(semComentarios(definitivo), /show\("home"\)/, 'show("home") pelado deixava o modo detalhe ligado');

// O "lead fantasma" (já não existe no banco) segue o mesmo caminho.
const fantasma = pega(/function cpSumirComLeadFantasma\(id\)\{[\s\S]*?\n\}/, 'cpSumirComLeadFantasma');
assert.match(fantasma, /cpVoltarProHomeSemLead\(\)/, 'o fantasma também precisa devolver a Home inteira');

// 3) apagarLead informa se apagou de verdade (é o que sustenta o "if(apagou)" acima).
const apagar = pega(/async function apagarLead\(id, nome\)\{[\s\S]*?\n\}/, 'apagarLead');
assert.match(apagar, /toast\("Lead apagado\."\);[\s\S]*?return true;/, 'sucesso devolve true');
assert.match(apagar, /\n  return false;\n\}$/, 'cancelamento/erro devolvem valor falso');

// 4) O lead apagado sai TAMBÉM de state.itemsAtivos — é o cache que a Home usa antes de ir na
//    rede; sem isso ele continuava aparecendo nas listas e nos contadores até um F5.
const caches = pega(/function removerLeadDosCaches\(id\)\{[\s\S]*?\n\}/, 'removerLeadDosCaches');
for (const lista of ['todosLeads', 'leads', 'itemsAtivos']) {
  assert.ok(new RegExp(`state\\.${lista} = state\\.${lista}\\.filter`).test(caches),
    `o lead apagado precisa sair de state.${lista}`);
}

// 5) Comportamento isolado do helper: com o modo detalhe ligado e uma lista aberta, ele devolve
//    a Home limpa (sem lead, sem lista, tela = home).
const estado = { lead: { id: 7 }, focoLeadId: '7', analysis: {}, sequencia: {}, grupoAtivo: '__fazeragora', active: 'home' };
const chamadas = [];
const fn = new Function('state', 'cpClearLeadState', 'show', 'renderBotoesHome', 'cpReplaceRoute',
  'cpRouteForScreen', `${helper}\nreturn cpVoltarProHomeSemLead;`);
fn(estado,
  () => { chamadas.push('limpou'); estado.lead = null; estado.focoLeadId = null; estado.analysis = null; estado.sequencia = null; },
  (t) => { chamadas.push('show:' + t); estado.active = t; },
  () => chamadas.push('redesenhou'),
  () => {}, () => ({}))();

assert.deepEqual(chamadas, ['limpou', 'show:home', 'redesenhou'], 'ordem: limpa o lead, mostra a Home, redesenha');
assert.equal(estado.lead, null, 'nenhum lead em foco');
assert.equal(estado.grupoAtivo, null, 'nenhuma lista aberta');
assert.equal(estado.active, 'home', 'a tela ativa é a Hoje');

// ---------------------------------------------------------------------------------------------
// Segundo relato do dono, no mesmo dia: "arquivei um lead, foi pra home automaticamente e tá
// certo, porém não aumentou o número de arquivados, tive que atualizar a página."
//
// Causa: ARQUIVAR usava removerLeadDosCaches, que tira o lead de TODAS as listas — inclusive de
// state.todosLeads, a carteira inteira, que é de onde o card "Arquivados" (v1124) tira o número.
// O lead sumia em vez de mudar de etapa, então o contador não mexia até um F5.
// ---------------------------------------------------------------------------------------------

const marcar = pega(/function cpMarcarEtapaLocal\(id, etapa\)\{[\s\S]*?\n\}/, 'cpMarcarEtapaLocal');

// Arquivar troca a etapa (não remove) e reativar desfaz — os dois usam o mesmo caminho.
const arquivarBloco = pega(/if\(arquivando\)\{\n\s*\/\/ Sai dos atendimentos[\s\S]*?return;/, 'o bloco de arquivar');
assert.match(arquivarBloco, /cpMarcarEtapaLocal\(id, etapa\)/,
  'arquivar precisa trocar a etapa na carteira, não sumir com o lead');
assert.match(arquivarBloco, /cpVoltarProHomeSemLead/,
  'arquivar volta pra Home pelo mesmo caminho da exclusão (senão o cabeçalho fica escondido)');

const reativar = pega(/async function reativarLeadArquivado\(id, btn\)\{[\s\S]*?\n\}/, 'reativarLeadArquivado');
assert.match(reativar, /cpMarcarEtapaLocal\(id, "Ativo"\)/,
  'reativar precisa devolver o lead pra etapa Ativo nas listas em memória');

// Comportamento isolado: arquivar mantém o lead na carteira (com a etapa nova) e o tira dos
// ativos; reativar faz o caminho de volta. É isso que faz o card "Arquivados" mexer na hora.
function rodarMarcar(estado, id, etapa) {
  const normalizarEtapa = e => String(e || '').trim();
  const ETAPA_ARQUIVADO = 'Geladeira';
  const fn = new Function('state', 'invalidarLeadsCache', 'normalizarEtapa', 'ETAPA_ARQUIVADO', 'loadTodosLeadsBusca',
    `${marcar}\nreturn cpMarcarEtapaLocal;`);
  fn(estado, () => {}, normalizarEtapa, ETAPA_ARQUIVADO, undefined)(id, etapa);
  return estado;
}
const contarArquivadosDe = st => st.todosLeads.filter(l => l.etapa === 'Geladeira').length;

const st = {
  todosLeads: [{ id: 1, etapa: 'Ativo' }, { id: 2, etapa: 'Ativo' }, { id: 3, etapa: 'Geladeira' }],
  itemsAtivos: [{ id: 1, etapa: 'Ativo' }, { id: 2, etapa: 'Ativo' }],
  leads: [{ id: 1, etapa: 'Ativo' }, { id: 2, etapa: 'Ativo' }]
};
assert.equal(contarArquivadosDe(st), 1, 'ponto de partida: 1 arquivado');

rodarMarcar(st, 2, 'Geladeira');
assert.equal(contarArquivadosDe(st), 2, 'arquivar sobe o número de arquivados NA HORA (era o bug)');
assert.equal(st.todosLeads.length, 3, 'o lead arquivado continua na carteira inteira, não some dela');
assert.deepEqual(st.itemsAtivos.map(l => l.id), [1], 'e sai dos atendimentos ativos');

rodarMarcar(st, 2, 'Ativo');
assert.equal(contarArquivadosDe(st), 1, 'reativar desce o número de arquivados na hora');
assert.deepEqual(st.itemsAtivos.map(l => l.id).sort(), [1, 2], 'e o lead volta pros ativos');

console.log('v1125-excluir-lead-volta-pra-home: ok');
