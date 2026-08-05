import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1133 — relato do dono, com print da Agenda: **"deletei e não saiu daí"**. Ele excluiu o lembrete
// vencido de um atrasado ("Atrasado há 1 dia (era 03/08)") e o cartão continuou na lista, no mesmo
// lugar, como se nada tivesse acontecido.
//
// A exclusão FUNCIONAVA — o servidor apagava o lembrete de verdade. O que não acontecia era a tela
// mudar. carregarAgenda() começa assim:
//
//     if(state.todosLeads?.length){ renderAgenda({ items: state.todosLeads }); return; }
//
// ou seja: redesenha a partir da carteira que já está na memória e NEM CHEGA a buscar o dado novo.
// invalidarLeadsCache() limpa o cache de rede, mas não mexe em state.todosLeads — então a Agenda se
// redesenhava idêntica, com o lembrete que acabara de ser apagado. Só saindo e voltando da tela (ou
// dando F5) a lista ficava certa.
//
// É a MESMA classe de erro que a v1125 corrigiu no arquivar (a Home também renderiza de uma lista em
// memória, e o número de "Arquivados" não subia). Por isso a correção segue o padrão de lá: atualizar
// a carteira em memória para o estado que o servidor acabou de gravar.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// 1) A função que sincroniza a memória existe e mexe nas TRÊS listas de onde as telas renderizam.
//    Deixar uma de fora é como o bug volta: a tela que lê a lista esquecida continua desatualizada.
// ---------------------------------------------------------------------------
const fnSrc = app.match(/function cpAtualizarLembreteLocal\(id, lembrete\)\{[\s\S]*?\n\}/);
assert.ok(fnSrc, 'cpAtualizarLembreteLocal não encontrada em app.js');
for (const lista of ['state.todosLeads', 'state.leads', 'state.itemsAtivos']) {
  assert.ok(fnSrc[0].includes(lista),
    `${lista} precisa ser atualizada — é de listas assim que Agenda e Home redesenham, sem ir à rede`);
}
assert.match(fnSrc[0], /invalidarLeadsCache\(\)/, 'o cache de rede também precisa ser invalidado');

// ---------------------------------------------------------------------------
// 2) Comportamento de verdade: apagar tira o lembrete; remarcar troca a data; outros leads não
//    podem ser tocados.
// ---------------------------------------------------------------------------
const estado = {
  todosLeads: [
    { id: 'a', name: 'Giovana', analysis: { lembrete: { quando: '2026-08-03T12:00:00.000Z', motivo: 'Retomar contato' }, confirmedAppointments: [] } },
    { id: 'b', name: 'Luiz', analysis: { lembrete: { quando: '2026-08-20T12:00:00.000Z', motivo: 'Ligar' } } }
  ],
  leads: [{ id: 'a', name: 'Giovana', analysis: { lembrete: { quando: '2026-08-03T12:00:00.000Z' } } }],
  itemsAtivos: [{ id: 'a', name: 'Giovana', analysis: { lembrete: { quando: '2026-08-03T12:00:00.000Z' } } }]
};
const rodar = new Function('state', 'invalidarLeadsCache', `${fnSrc[0]}; return cpAtualizarLembreteLocal;`)(estado, () => {});

rodar('a', null);
assert.equal(estado.todosLeads[0].analysis.lembrete, undefined,
  'depois de excluir, o lembrete não pode continuar na carteira em memória — era exatamente isso que mantinha o cartão na tela');
assert.equal(estado.leads[0].analysis.lembrete, undefined, 'a lista de leads também precisa refletir');
assert.equal(estado.itemsAtivos[0].analysis.lembrete, undefined, 'e a lista de ativos, que a Home usa');
assert.ok(estado.todosLeads[1].analysis.lembrete, 'o lembrete de OUTRO lead não pode ser afetado');
assert.equal(estado.todosLeads[0].name, 'Giovana', 'o resto do lead precisa continuar intacto');

rodar('a', { quando: '2026-09-10T12:00:00.000Z', motivo: 'Remarcado' });
assert.equal(estado.todosLeads[0].analysis.lembrete.quando, '2026-09-10T12:00:00.000Z',
  'remarcar precisa gravar a data nova na memória, senão o cartão mostra a data antiga até sair da tela');

rodar('', null);
rodar(null, null);
assert.equal(estado.todosLeads.length, 2, 'id vazio não pode bagunçar a carteira');

// ---------------------------------------------------------------------------
// 3) As duas ações da Agenda precisam CHAMAR a sincronia — é o elo que faltava.
// ---------------------------------------------------------------------------
const remover = app.match(/async function removerLembrete\(id\)\{[\s\S]*?\n\}/)[0];
assert.match(remover, /cpAtualizarLembreteLocal\(id, null\)/,
  'excluir o lembrete precisa tirá-lo da memória, senão o cartão fica na Agenda ("deletei e não saiu daí")');
assert.match(remover, /if\(state\.active === "agenda"\) carregarAgenda\(\)/,
  'e precisa continuar mandando a Agenda se redesenhar');

const reagendar = app.match(/async function reagendarLembrete\(id, dateStr\)\{[\s\S]*?\n\}/)[0];
assert.match(reagendar, /cpAtualizarLembreteLocal\(id,/,
  'remarcar tem o mesmo problema: sem atualizar a memória, a data nova não aparece até sair da tela');

// ---------------------------------------------------------------------------
// 4) O atalho de memória da Agenda continua lá (é o que evita o "Carregando..." a cada volta), mas
//    a partir da v1135 ele parou de ser cego: pinta rápido a partir da memória E revalida quando a
//    memória não está em dia. Antes, uma camada acima já sabia que os dados tinham mudado e mandava
//    recarregar — e aqui dentro a Agenda se redesenhava do mesmo pedaço velho, anulando tudo.
//    Com a revalidação, esquecer de sincronizar a memória numa ação nova deixa a tela um pouco mais
//    lenta em vez de mostrar dado errado. A sincronia acima continua sendo exigida porque é ela que
//    evita o piscar; a revalidação é a rede de segurança.
// ---------------------------------------------------------------------------
assert.match(app, /renderAgenda\(\{ items: state\.todosLeads \}\);\s*\n\s*if\(cpCarteiraEstaEmDia\(\)\) return;/,
  'a Agenda precisa pintar da memória E revalidar quando ela não estiver em dia');
assert.match(app, /function cpCarteiraEstaEmDia\(\)\{[\s\S]*?carteiraRevisao\) === \(Number\(state\.dataRevision\)/,
  'a checagem precisa comparar a revisão em que a carteira foi preenchida com a revisão atual');

console.log('v1133-excluir-lembrete-sai-da-agenda: ok');
