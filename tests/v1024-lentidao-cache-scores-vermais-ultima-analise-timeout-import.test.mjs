import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const leadUpdateSrc = fs.readFileSync(new URL('../api/lead-update.js', import.meta.url), 'utf8');

// v1024 — lista de 7 pontos que o dono mandou de uma vez, testando o site de verdade:
// 1) cartão da lateral removido — coberto por tests/v1015 (atualizado) e tests/v1007/v1017.
// 2) "Última análise" não atualizava depois de reimportar (Beato Broks) — Parte A abaixo.
// 3) Importação com "tempo esgotado" — Parte B abaixo.
// 4) "Ver mais" nas mensagens apagava tudo e subia pro topo — Parte C abaixo.
// 5) Transcrição em tempo real na observação por áudio — pedido/pergunta de viabilidade, não
//    virou código nesta versão (ver NOTAS-v1024.md pra explicação dada ao dono).
// 6) "Hoje" reabria o último lead em vez de ir pra Home — sem bug de lógica encontrado (o
//    clique já limpava state.lead/focoLeadId antes de mandar renderizar a Home); a causa real
//    era o próprio item 7 (o render ficava lento/parado bem na hora do clique). Resolvido como
//    consequência da Parte D abaixo.
// 7) Site travado/lento (mouse/clique ~5s, hard refresh ~30s+), mesmo depois do fix de cache do
//    servidor na v1017 — Parte D abaixo: achado real do lado do NAVEGADOR (thread principal
//    travando), não só rede.

function extrairFn(nome) {
  const marcadores = [`async function ${nome}(`, `function ${nome}(`];
  let ini = -1;
  for (const m of marcadores) { ini = app.indexOf(m); if (ini > -1) break; }
  assert.ok(ini > -1, `${nome} não encontrada em app.js`);
  const fim = app.indexOf('\n}\n', ini);
  assert.ok(fim > ini, `não achei o fim de ${nome} em app.js`);
  return app.slice(ini, fim + 2); // +2 inclui o "\n}" de fechamento (fim aponta pro \n antes dele)
}

// ===================== Parte A — "Última análise" atualiza ao reimportar =====================

{
  const marcador = 'async function acaoAtualizarComEvolucao(body, res, organizationId) {';
  const ini = leadUpdateSrc.indexOf(marcador);
  assert.ok(ini > -1, 'acaoAtualizarComEvolucao não encontrada em api/lead-update.js');
  const fim = leadUpdateSrc.indexOf('\nasync function acaoEtapa', ini);
  assert.ok(fim > ini, 'não achei o fim de acaoAtualizarComEvolucao');
  const corpo = leadUpdateSrc.slice(ini, fim);
  assert.match(corpo, /reanalisadoEm:\s*concluidaEm/,
    'reimportar precisa atualizar reanalisadoEm — senão "Última análise" (que prioriza reanalisadoEm sobre geradoEm) continua mostrando uma data antiga de uma reanálise manual anterior');
  console.log('v1024 (Última análise): reimportar atualiza reanalisadoEm — ok');
}

// ===================== Parte B — importação tenta de novo antes de desistir =====================

{
  const src = extrairFn('processarStorageEmEtapas');
  // As 3 etapas (preparar/transcrever/analisar) precisam ter a MESMA rede de segurança: até 2
  // tentativas antes de estourar erro pro corretor. "transcrever" já tinha isso; "preparar" e
  // "analisar" ganharam agora — o servidor tem maxDuration:60 (vercel.json), menor que os prazos
  // do navegador (90s/70s/150s), então um ZIP grande o bastante é morto pela Vercel antes do
  // navegador desistir sozinho — sem re-tentativa automática, o corretor tinha que clicar
  // "tentar de novo" manualmente (relatado: "na segunda ou terceira vez dava certo").
  const tentativas = (src.match(/tentativa\s*<=\s*2\s*&&\s*!(prep|resposta|result)/g) || []).length;
  assert.equal(tentativas, 3, `preparar, transcrever e analisar precisam ter a mesma rede de 2 tentativas (achei ${tentativas})`);
  assert.match(src, /if\(!prep\) throw erroPrep/, 'preparar precisa desistir com um erro claro depois de esgotar as tentativas');
  assert.match(src, /if\(!result\) throw erroAnalise/, 'analisar precisa desistir com um erro claro depois de esgotar as tentativas');
  console.log('v1024 (timeout na importação): preparar/analisar também tentam de novo automaticamente — ok');
}

// ===================== Parte C — "Ver mais" reabre o histórico e rola até ele de verdade =====================

{
  const ini = app.indexOf('window.cp704HistoryToggle=async function(){');
  assert.ok(ini > -1, 'window.cp704HistoryToggle não encontrada em app.js');
  const fim = app.indexOf('\n  };', ini);
  assert.ok(fim > ini, 'não achei o fim de cp704HistoryToggle');
  const src = app.slice(ini, fim);
  assert.doesNotMatch(src, /querySelectorAll\('\.cp704-details'\)/,
    'o seletor antigo (.cp704-details) nunca encontrava a seção de mensagens — não pode sobrar');
  assert.match(src, /document\.querySelector\('#cp704HistCard'\)/, 'precisa mirar o card certo (#cp704HistCard)');
  assert.match(src, /hist\.hidden\s*=\s*false/, 'precisa reabrir o card na hora (senão o re-render deixa "hidden" do HTML padrão)');
  assert.match(src, /hist\.scrollIntoView/, 'precisa rolar até o card reaberto');
  console.log('v1024 (ver mais): reabre o histórico completo e rola até ele, sem precisar clicar em "Mensagens" de novo — ok');
}

// ===================== Parte D — lentidão: sem recomputar o mesmo lead várias vezes por render =====================

{
  // 1. prioridadeAtendimento cacheia por objeto de lead (a função pesada de verdade virou
  // _prioridadeAtendimentoCalcular; o nome público agora é só um wrapper com cache).
  assert.match(app, /const _prioridadeCache = new WeakMap\(\);/, 'precisa existir o cache de prioridadeAtendimento');
  const wrapperPA = extrairFn('prioridadeAtendimento');
  assert.match(wrapperPA, /_prioridadeCache\.has\(l\)/, 'prioridadeAtendimento precisa checar o cache antes de calcular de novo');
  assert.match(wrapperPA, /_prioridadeAtendimentoCalcular\(l\)/, 'prioridadeAtendimento precisa delegar o cálculo de verdade pro helper');

  // Comportamento real do cache (isolado, sem depender da conta pesada de verdade):
  // _prioridadeAtendimentoCalcular é STUBADA aqui só pra contar quantas vezes é chamada.
  const cacheado = eval(`
    let chamadas = 0;
    const _prioridadeCache = new WeakMap();
    function _prioridadeAtendimentoCalcular(l){ chamadas++; return { score: l.id, chamadas }; }
    ${wrapperPA}
    ({ prioridadeAtendimento, contador: () => chamadas });
  `);
  const leadA = { id: 'a' }, leadB = { id: 'b' };
  cacheado.prioridadeAtendimento(leadA);
  cacheado.prioridadeAtendimento(leadA);
  cacheado.prioridadeAtendimento(leadA);
  cacheado.prioridadeAtendimento(leadB);
  assert.equal(cacheado.contador(), 2, 'com o MESMO objeto de lead chamado 3x, o cálculo de verdade só pode rodar 1 vez (+1 pro outro lead) — antes rodava toda vez');

  // 2. scoreConversaoHoje: mesmo padrão de cache (usado por compararPrioridadeAtendimento, que
  // roda dentro de vários .sort() em renderListasHome).
  assert.match(app, /const _conversaoHojeCache = new WeakMap\(\);/, 'precisa existir o cache de scoreConversaoHoje');
  const wrapperSCH = extrairFn('scoreConversaoHoje');
  assert.match(wrapperSCH, /_conversaoHojeCache\.has\(l\)/, 'scoreConversaoHoje precisa checar o cache antes de calcular de novo');
  assert.match(wrapperSCH, /_scoreConversaoHojeCalcular\(l\)/, 'scoreConversaoHoje precisa delegar o cálculo de verdade pro helper');

  console.log('v1024 (lentidão — cache por lead): prioridadeAtendimento/scoreConversaoHoje não recalculam à toa — ok');
}

{
  // 3. cpFilaFazerAgora: cpProbabilidadeFechamento (não cacheada — eval'ada isolada em vários
  // testes existentes, v943/v944/v914) precisa ser calculada 1x por lead ANTES do .sort(), não
  // dentro do comparador (que rodaria a mesma conta várias vezes pra cada lead).
  const fdsSrc = app.match(/function cpFimDeSemana\(\)\{[\s\S]*?\n\}/)[0];
  const filaSrc = app.match(/function cpFilaFazerAgora\(items\)\{[\s\S]*?\n\}/)[0];
  assert.match(filaSrc, /score:\s*cpProbabilidadeFechamento\(l\)/, 'cpFilaFazerAgora precisa calcular o score uma vez por lead, guardado, antes de ordenar');
  assert.doesNotMatch(filaSrc, /cpProbabilidadeFechamento\(b\) - cpProbabilidadeFechamento\(a\)/, 'o comparador não pode mais chamar cpProbabilidadeFechamento de novo (recomputava várias vezes por lead)');

  let chamadas = 0;
  const fila = eval(`
    const CP_DOSE_DIA = 10;
    const leadEhAtivo = () => true;
    const ehContatadoHoje = (l) => !!l.__hoje;
    const mensagensDoCliente = (l) => Number(l.__msgs||0);
    const cp786TemCompromisso = () => false;
    const emJanelaDeEspera = () => false;
    // v1057 — cpFilaFazerAgora exige atendimento marcado (ultimoAtendimentoTs); stub simples pra
    // não afetar o que este teste realmente cobre (nº de chamadas de cpProbabilidadeFechamento).
    const ultimoAtendimentoTs = (l) => l.__atendido ? 1 : 0;
    const analiseAtualValida752 = () => false;
    function cpProbabilidadeFechamento(l){ contarChamada(); return Number(l.__msgs||0); }
    ${fdsSrc}
    ${filaSrc}
    cpFilaFazerAgora;
  `, undefined);
  // eval acima referencia contarChamada — precisa existir no escopo antes de rodar a fila.
  globalThis.contarChamada = () => { chamadas++; };
  const pool = [
    { id: 'a', __msgs: 5, __atendido: true }, { id: 'b', __msgs: 12, __atendido: true }, { id: 'c', __msgs: 1, __atendido: true },
    { id: 'd', __msgs: 8, __atendido: true }, { id: 'e', __msgs: 20, __atendido: true }
  ];
  const ordenado = fila(pool).map(l => l.id);
  assert.deepEqual(ordenado, ['e', 'b', 'd', 'a', 'c'], 'ordenação continua igual (maior probabilidade primeiro)');
  assert.equal(chamadas, pool.length, `cpProbabilidadeFechamento precisa ser chamada exatamente 1x por lead elegível (achei ${chamadas} chamadas pra ${pool.length} leads) — o .sort() antigo chamava várias vezes à toa pra cada lead`);
  delete globalThis.contarChamada;

  console.log('v1024 (lentidão — cpFilaFazerAgora): probabilidade de fechamento calculada 1x por lead, ordenação preservada — ok');
}

console.log('v1024-lentidao-cache-scores-vermais-ultima-analise-timeout-import: ok');
