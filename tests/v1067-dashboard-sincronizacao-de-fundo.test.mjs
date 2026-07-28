import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1067 — a sincronização de fundo da Home (intervalo de 30s e retorno de aba, ambos já
// chamavam carregarDashboard(true) desde muitas versões atrás) nunca teve efeito real: a
// função nem declarava o parâmetro force, então toda chamada caía direto no atalho de cache
// (state.itemsAtivos já populado) e nunca buscava dado novo no servidor. Isso também deixava
// incompleta a correção da v1066 (sincronizar Cérebro entre aparelhos): refreshAllSections()
// chamava carregarDashboard() sem force quando a Home estava ativa, então mesmo com a config
// nova já salva no localStorage, a fila continuava mostrando os MESMOS objetos de lead — e
// prioridadeAtendimento/scoreConversaoHoje cacheiam o score por objeto (WeakMap), então só um
// F5 completo (que cria objetos novos) fazia a fila recalcular de verdade.

{
  assert.match(app, /async function carregarDashboard\(force\)\{/,
    'carregarDashboard precisa declarar o parâmetro force');
  assert.match(app, /if\(t === "home"\) await carregarDashboard\(force\);/,
    'carregarTelaAtiva precisa repassar force pra carregarDashboard');
  assert.match(app, /if\(state\.active === "home"\) carregarDashboard\(true\);/,
    'refreshAllSections precisa forçar a atualização da Home (senão a fila fica com scores cacheados da config antiga)');

  const fnMatch = app.match(/async function carregarDashboard\(force\)\{[\s\S]*?\n\}\n/);
  assert.ok(fnMatch, 'carregarDashboard não encontrada por inteiro');
  const src = fnMatch[0];

  // Testes funcionais: simula a Home já carregada (state.itemsAtivos com dado) e confirma que
  // force=true busca de novo no servidor, enquanto force=false/undefined continua usando cache
  // (preservando o comportamento de navegação normal entre telas).
  async function rodar(force, itemsAtivos){
    const chamadas = { getLeadsData: 0, processar: [] };
    const state = { active: 'home', itemsAtivos, todosLeads: itemsAtivos };
    const qs = () => null;
    const getLeadsData = async (f) => { chamadas.getLeadsData++; return { ok:true, items:[{ id:'novo', etapa:'Contato' }] }; };
    const _processarDashboard = (data) => { chamadas.processar.push(data); };
    const fn = new Function(
      'state', 'qs', 'getLeadsData', '_processarDashboard',
      `${src}\nreturn carregarDashboard(${force === undefined ? '' : force});`
    );
    await fn(state, qs, getLeadsData, _processarDashboard);
    return chamadas;
  }

  const semForca = await rodar(undefined, [{ id:'a' }]);
  assert.equal(semForca.getLeadsData, 0,
    'sem force e com cache em memória, não deveria bater no servidor (navegação normal entre telas)');
  assert.equal(semForca.processar.length, 1, 'ainda assim precisa renderizar com o que já tem em cache');

  const comForca = await rodar(true, [{ id:'a' }]);
  assert.equal(comForca.getLeadsData, 1,
    'com force=true e cache em memória, precisa buscar dado novo no servidor (sync de fundo/config nova)');
  assert.equal(comForca.processar.length, 1, 'precisa renderizar o resultado buscado');

  const semCacheAinda = await rodar(undefined, []);
  assert.equal(semCacheAinda.getLeadsData, 1,
    'sem cache nenhum (primeira carga da Home), precisa buscar no servidor mesmo sem force');

  console.log('v1067 (Home): força busca nova no servidor quando o chamador pede (sync de fundo/config do Cérebro) — ok');
}

console.log('v1067-dashboard-sincronizacao-de-fundo: ok');
