import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// v929 — pedido do dono: Desempenho não pode duplicar a Home/Atendimentos. Ele listou 8
// métricas de atividade/resultado (escolheu o "Modelo 2 — lista de métricas" entre 4 opções):
// tempo no app, mensagens trocadas, empreendimentos negociados, leads atendidos, mensagens
// copiadas, análises feitas, importações e propostas feitas (com histórico).

// 1. A grade antiga "Visão geral da carteira" (que só repetia números da Home) saiu do HTML.
assert.doesNotMatch(html, /Visão geral da carteira/, 'o título antigo (duplicava a Home) deve sair');
assert.doesNotMatch(html, /class="cp-metrics"/, 'a grade de 4 tiles antiga deve sair');
assert.doesNotMatch(html, /id="cpNewLeads"|id="cpActiveDeals"|id="cpVisits"|id="cpProposals"/,
  'os alvos antigos (duplicavam Clientes ativos/Fazer agora/Compromissos/Aguardando) devem sair');
assert.match(html, /id="cpMetricasSemana"/, 'o novo contêiner da lista de métricas deve existir');

// 2. cpDesempenhoMetricas agrega as métricas a partir de dado real (não placeholder), somando
// o MÊS CORRENTE (dia 1 até hoje) — não mais "últimos 7 dias corridos" (trocado na v984, a
// pedido do dono: ele revisa Desempenho uma vez por mês, não por dia).
const iniHelper = app.indexOf('function cpInicioMesMs(){');
const iniFn = app.indexOf('function cpDesempenhoMetricas(items, all){');
const fim = app.indexOf('\nwindow.cpDesempenhoMetricas');
assert.ok(iniHelper !== -1 && iniFn !== -1 && fim !== -1, 'cpInicioMesMs/cpDesempenhoMetricas não encontradas em app.js');
// remove o "window.cpInicioMesMs = ..." no meio do trecho: não existe `window` neste eval isolado.
const fnSrc = app.slice(iniHelper, fim).replace(/^window\.cpInicioMesMs = cpInicioMesMs;\n/m, '');

// "dentro do mês" = ontem (sempre no mês corrente); "fora do mês" = mês passado (sempre antes
// do dia 1 corrente, não importa em que dia do mês o teste rodar).
const dentroDaJanela = new Date(Date.now() - 1*24*60*60*1000).toISOString();
const mesPassado = new Date(); mesPassado.setMonth(mesPassado.getMonth() - 1);
const foraDaJanela = mesPassado.toISOString();

const cpDesempenhoMetricas = eval(`
  const produtosLabel = (l) => l.__produto || "";
  const cpTempoAppSegundosHoje = () => 7380;   // 2h03
  const cpTempoAppMediaSegundos7d = () => 6120; // 1h42
  const cpContarAtividade = (chave, desde) => chave === "analise" ? 5 : 3;
  const cpFormatarDuracao = (s) => s + "s"; // não usado dentro da função, só no render
  ${fnSrc}
  cpDesempenhoMetricas;
`);

const items = [
  { id:'a', __produto:'Evolutti', recentMessages:[
    { iso: dentroDaJanela, type:'texto' },
    { iso: foraDaJanela, type:'texto' },
  ], analysis:{ aprendizado:{ eventos:[
    { evento:'contato_manual', quando: dentroDaJanela },
    { evento:'mensagem_copiada', quando: dentroDaJanela },
    { evento:'mensagem_copiada', quando: foraDaJanela }, // fora da janela: não conta
  ]}}},
  { id:'b', __produto:'Evolutti', recentMessages:[
    { iso: dentroDaJanela, type:'proposta' },
  ], analysis:{ aprendizado:{ eventos:[] }}},
  { id:'c', __produto:'Nova Vila Rica III', recentMessages:[], analysis:{ aprendizado:{ eventos:[
    { evento:'contato_manual', quando: foraDaJanela }, // fora da janela: não conta como atendido
  ]}}},
];
const all = items;

const m = cpDesempenhoMetricas(items, all);
assert.equal(m.mensagensTrocadas, 2, 'só conta mensagens dentro do mês corrente (a: 1 + b: 1)');
assert.equal(m.leadsAtendidos, 1, 'só o lead "a" tem contato_manual DENTRO do mês corrente');
assert.equal(m.mensagensCopiadas, 1, 'só a mensagem_copiada dentro da janela conta');
assert.equal(m.analisesFeitas, 5, 'vem de cpContarAtividade("analise", ...)');
assert.equal(m.importacoes, 3, 'vem de cpContarAtividade("importacao", ...)');
assert.equal(m.propostas.length, 1, 'um item recentMessages com type "proposta"');
assert.deepEqual(m.empreendimentos, [['Evolutti',2],['Nova Vila Rica III',1]], 'agrupa e ordena empreendimentos por quantidade de leads');
assert.equal(m.tempoHojeSeg, 7380, 'usa cpTempoAppSegundosHoje()');
assert.equal(m.tempoMedia7dSeg, 6120, 'usa cpTempoAppMediaSegundos7d()');

// 3. cpFormatarDuracao (a de verdade, não o stub) formata direito.
const fmtSrc = app.match(/function cpFormatarDuracao\(segundos\)\{[\s\S]*?\n\}/);
assert.ok(fmtSrc, 'cpFormatarDuracao não encontrada');
const cpFormatarDuracao = eval(`${fmtSrc[0]}\ncpFormatarDuracao;`);
assert.equal(cpFormatarDuracao(7380), '2h 03min', 'formata horas + minutos com zero à esquerda');
assert.equal(cpFormatarDuracao(300), '5min', 'só minutos quando < 1h');
assert.equal(cpFormatarDuracao(10), 'menos de 1min', 'texto amigável pra menos de 1 minuto');

// 4. Instrumentação: análise concluída e importação bem-sucedida registram atividade.
assert.match(app, /progresso\.done\("Análise concluída e salva\."\);\s*\n\s*try\{ cpRegistrarAtividade\("analise"\); \}catch\(_\)\{\}/,
  'o sucesso de "Reanalisar" (ui670Reanalisar) deve registrar a atividade "analise"');
assert.match(app, /const ok = await uploadLargeZipToSupabase\(working, \{ audioWindowDays, importId \}\);\s*\n\s*if\(!ok\) return false;\s*\n\s*\/\/ v929[\s\S]{0,200}cpRegistrarAtividade\("importacao"\);/,
  'o sucesso do upload do ZIP (processFile) deve registrar a atividade "importacao"');

// 5. "Propostas feitas" abre um histórico de verdade (reaproveita abrirGrupoHome).
assert.match(app, /function cpAbrirHistoricoPropostas\(\)\{[\s\S]*?abrirGrupoHome\("__propostas"/,
  'cpAbrirHistoricoPropostas deve reaproveitar abrirGrupoHome pra mostrar o histórico');
assert.match(app, /onclick="cpAbrirHistoricoPropostas\(\)"/, 'a linha "Propostas feitas" deve abrir o histórico ao clicar');

console.log('v929-desempenho-metricas-reais: ok');
