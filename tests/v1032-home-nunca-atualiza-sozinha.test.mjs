import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1032 — investigação de segundo nível sobre o caso "Wilson atendido mas continua em
// Oportunidades esquecidas" (v1031 já tinha corrigido a causa mais comum: cópia de mensagem só
// atualizando UMA cópia do lead em memória). Um agente dedicado foi checar se sobrava algum outro
// caminho quebrado e achou uma causa bem mais funda, que explica por que o problema podia
// continuar aparecendo mesmo em telas que nunca passaram pelo bug da v1031: carregarDashboard()
// (a função que alimenta a Home — cartões do topo e as 3 listas, "Oportunidades esquecidas"
// inclusa) não tinha parâmetro "force" NENHUM. Ela sempre reaproveitava state.itemsAtivos se já
// tivesse alguma coisa — e state.itemsAtivos só é populado UMA VEZ, na primeira carga da Home
// dentro daquela sessão do navegador (aba aberta/PWA retomado sem fechar de verdade).
//
// Só que DUAS sincronizações automáticas achavam que estavam forçando atualização:
//   - o intervalo de 30s (app.js, dentro do setInterval): chamava carregarDashboard(true)
//   - a aba voltando a ficar visível (visibilitychange): também chamava carregarDashboard(true)
// Como a função não tinha parâmetro nenhum, esse "true" era descartado — as duas rotinas
// achavam que iam buscar dado novo no servidor e nunca buscavam. invalidarLeadsCache() (chamada
// nas duas rotinas também) por sua vez nunca zera state.itemsAtivos, só o cache de rede — então
// nem isso ajudava. Resultado: uma vez que a Home carrega pela primeira vez, ela só se atualiza
// de verdade por uma ação local explícita (marcar atendido etc — já corrigida na v1031) ou um
// F5/recarregamento completo da página. Isso é uma causa TOTALMENTE separada da v1031 e explica
// por que dava pra ver "Atendimentos" certo e "Oportunidades esquecidas" desatualizado ao mesmo
// tempo, sem precisar refazer nenhuma ação.
//
// Corrigido: carregarDashboard(force=false) agora aceita e respeita force de verdade (só reusa
// o que já está em memória quando force for false), carregarTelaAtiva repassa force pra Home do
// mesmo jeito que já repassava pra "carteira", e o esqueleto de carregamento só aparece quando a
// tela está mesmo vazia — uma sincronização de fundo com a lista já visível não pode apagar o
// que o corretor já está vendo na tela.

const ini = app.indexOf('async function carregarDashboard(force=false){');
assert.ok(ini > -1, 'carregarDashboard precisa aceitar o parâmetro force (com padrão false)');
const fim = app.indexOf('\nasync function _processarDashboard(data){', ini);
assert.ok(fim > ini, 'não encontrei o fim de carregarDashboard (função _processarDashboard logo em seguida)');
const src = app.slice(ini, fim);

// 1. O cache local só pode ser reusado quando NÃO for force.
assert.match(src, /const cached\s*=\s*\(!force\s*&&\s*state\.itemsAtivos\?\.length\)\s*\?\s*\{\s*items:\s*state\.itemsAtivos\s*\}\s*:\s*null;/,
  'force=true precisa pular o atalho de cache e ir buscar dado novo — antes ignorava force por completo');

// 2. force precisa chegar de verdade no pedido ao servidor (senão ainda podia cair no cache de
// 15s do próprio getLeadsData/servidor mesmo "forçando").
assert.match(src, /await getLeadsData\(force\)/, 'precisa repassar force pro getLeadsData, não chamar sem argumento');

// 3. O esqueleto de carregamento não pode mais aparecer sozinho numa sincronização de fundo
// (force=true com a lista já carregada) — só quando a tela está mesmo vazia.
assert.match(src, /if\(!state\.itemsAtivos\?\.length\)\{\s*\n\s*const focoSkel = qs\("#leadFocoArea"\);/,
  'esqueleto de carregamento precisa ficar condicionado a "ainda não tem nada na tela"');

// 4. A nova tentativa (quando o servidor responde ok:false) precisa preservar o force original,
// senão uma sincronização forçada que falhou vira uma tentativa "de mentirinha" ao repetir.
assert.match(src, /setTimeout\(\(\) => \{ if\(state\.active === "home"\) carregarDashboard\(force\); \}, 3000\);/,
  'a nova tentativa automática precisa repassar o mesmo force, não esquecer dele na repetição');

// 5. carregarTelaAtiva precisa repassar force pra Home do mesmo jeito que já faz pra "carteira"
// (esse mesmo bug existia nos dois lugares — só "carteira" estava correto).
const iniCTA = app.indexOf('function carregarTelaAtiva(t, force=false){');
const fimCTA = app.indexOf('window.carregarTelaAtiva = carregarTelaAtiva;', iniCTA);
assert.ok(iniCTA > -1 && fimCTA > iniCTA, 'carregarTelaAtiva não encontrada em app.js');
const blocoCTA = app.slice(iniCTA, fimCTA);
assert.match(blocoCTA, /if\(t === "home"\) await carregarDashboard\(force\);/,
  'carregarTelaAtiva precisa repassar force pro carregarDashboard da Home');
assert.match(blocoCTA, /else if\(t === "carteira"\) await carregarCarteira\(force\);/,
  '"carteira" precisa continuar recebendo force normalmente (referência do padrão já correto)');

// 6. Teste funcional: executa a função de verdade nos 3 cenários que importam.
const rodar = async (stateInicial, force) => {
  const chamadas = { getLeadsData: [], processarDashboard: [] };
  const elementos = {};
  const qs = (sel) => elementos[sel] || (elementos[sel] = { innerHTML: '' });
  const getLeadsData = async (f) => { chamadas.getLeadsData.push(f); return { ok:true, items:[{ id:'fresco', vindoDoServidor:true }] }; };
  const _processarDashboard = (data) => { chamadas.processarDashboard.push(data); };
  const fnFactory = new Function('state','qs','getLeadsData','_processarDashboard','force', `
    ${src}
    return carregarDashboard(force);
  `);
  await fnFactory(stateInicial, qs, getLeadsData, _processarDashboard, force);
  return { chamadas, elementos };
};

// 6a. Mutação local comum (force não passado): não pode ir na rede, tem que reusar o que já
// está em memória — comportamento de sempre, não pode regredir.
{
  const stateA = { active:'home', itemsAtivos:[{id:1}], todosLeads:[{id:1,extra:true}] };
  const { chamadas } = await rodar(stateA, false);
  assert.equal(chamadas.getLeadsData.length, 0, 'sem force, não pode buscar no servidor — precisa reusar o que já está em memória');
  assert.deepEqual(chamadas.processarDashboard[0], { items: stateA.todosLeads }, 'precisa reprocessar a partir do que já está em memória');
}

// 6b. Sincronização de fundo (force=true) com a lista JÁ visível — o caso que estava quebrado:
// precisa ir buscar de verdade no servidor, aplicar o dado fresco, e não pode piscar esqueleto.
{
  const stateB = { active:'home', itemsAtivos:[{id:1,velho:true}], todosLeads:[{id:1,velho:true}] };
  const { chamadas, elementos } = await rodar(stateB, true);
  assert.equal(chamadas.getLeadsData.length, 1, 'force=true precisa ir buscar dado novo no servidor — antes era descartado e nunca buscava');
  assert.equal(chamadas.getLeadsData[0], true, 'precisa repassar force=true pro getLeadsData (senão ainda podia cair no cache de 15s do servidor)');
  assert.deepEqual(chamadas.processarDashboard[0], { ok:true, items:[{ id:'fresco', vindoDoServidor:true }] },
    'precisa processar o dado FRESCO vindo do servidor (não o antigo que já estava em memória)');
  assert.equal(elementos['#leadFocoArea']?.innerHTML || '', '', 'sincronização de fundo com a lista já visível não pode apagar a tela com um esqueleto de carregamento');
}

// 6c. Primeira carga (tela ainda vazia), sem force: ainda precisa buscar no servidor E mostrar
// o esqueleto — não pode quebrar o caso mais comum de todos (abrir o app pela primeira vez).
{
  const stateC = { active:'home', itemsAtivos:[], todosLeads:[] };
  const { chamadas, elementos } = await rodar(stateC, false);
  assert.equal(chamadas.getLeadsData.length, 1, 'com a tela ainda vazia, precisa buscar no servidor mesmo sem force');
  assert.ok((elementos['#leadFocoArea']?.innerHTML || '').includes('skel-loading'), 'primeira carga (tela vazia) ainda precisa mostrar o esqueleto de carregamento');
}

console.log('v1032-home-nunca-atualiza-sozinha: ok');
