import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v1080 — o dono mandou 3 prints em sequência da MESMA importação (Marcos Pinzon, 60,2 MB):
// primeiro a etapa "Analisando" parecendo travada, depois "Salvando — salvando no banco de
// dados... (94%)" parada por minutos (15:05 e 15:07, sem nenhuma mudança), e o card de
// instruções/"Arquivo selecionado"/botões "Nova análise"/"Diagnóstico" reaparecendo por cima
// do andamento (deveria continuar escondido, ver v1077/v1078).
//
// Causas reais encontradas:
// 1. `salvarLeadPendente`/`atualizarLeadComEvolucao` chamavam ./api/lead-update com fetch()
//    cru, sem nenhum limite de tempo — se a rede travasse, a tela ficava presa em "Salvando"
//    PARA SEMPRE, sem erro nenhum aparecer (diferente do resto do app, que já usa
//    fetchComTimeout em toda gravação importante).
// 2. `renderProcessedResult` (chamado dentro de uploadLargeZipToSupabase, dentro de
//    processFile) dispara esse salvamento SEM esperar (sem await) — processFile terminava e
//    seu `finally` desligava o modo limpo do card ANTES do salvamento de verdade terminar,
//    reexibindo título/instruções/arquivo/botões durante "Salvando"/"Concluído".

const ini = app.indexOf('async function processFile(file, options = {}){');
assert.ok(ini > -1, 'processFile não encontrada em app.js');
const fim = app.indexOf('\nasync function readShareDebug', ini);
assert.ok(fim > ini, 'fim de processFile não encontrado');
const processFileBloco = app.slice(ini, fim);

// 1. processFile só desliga o modo limpo no finally se NÃO tiver concluído com sucesso —
//    senão quem desliga é o próprio salvamento, só quando ele de fato terminar.
assert.match(processFileBloco, /let concluidaComSucesso = false;/,
  'processFile precisa rastrear se a importação terminou com sucesso');
assert.match(processFileBloco, /concluidaComSucesso = true;\s*\n\s*return true;/,
  'o caminho de sucesso precisa marcar concluidaComSucesso antes de retornar');
assert.match(processFileBloco, /if\(!concluidaComSucesso\) qs\("#importCard"\)\?\.classList\.remove\("cp-import-rodando"\)/,
  'o finally só pode desligar o modo limpo quando a importação NÃO terminou com sucesso (senão quem desliga é o salvamento)');

// 2. salvarLeadPendente e atualizarLeadComEvolucao usam fetchComTimeout (não fetch cru) pra
//    gravar no banco — sem isso, uma rede travada prendia a tela em "Salvando" pra sempre.
const salvarIni = app.indexOf('async function salvarLeadPendente(){');
const salvarFim = app.indexOf('\nasync function descartarLeadPendente', salvarIni);
const salvarBloco = app.slice(salvarIni, salvarFim);
assert.match(salvarBloco, /fetchComTimeout\("\.\/api\/lead-update",\s*\{[\s\S]*?action:\s*"salvar-novo"/,
  'salvarLeadPendente precisa usar fetchComTimeout (com limite de tempo) pra salvar-novo');
assert.doesNotMatch(salvarBloco, /await fetch\("\.\/api\/lead-update"/,
  'salvarLeadPendente não pode mais usar fetch cru sem limite de tempo');

const atualizarIni = app.indexOf('async function atualizarLeadComEvolucao(){');
const atualizarFim = app.indexOf('\nasync function salvarLeadPendente', atualizarIni);
const atualizarBloco = app.slice(atualizarIni, atualizarFim);
assert.match(atualizarBloco, /fetchComTimeout\("\.\/api\/lead-update",\s*\{[\s\S]*?action:\s*"atualizar-com-evolucao"/,
  'atualizarLeadComEvolucao precisa usar fetchComTimeout (com limite de tempo)');
assert.doesNotMatch(atualizarBloco, /await fetch\("\.\/api\/lead-update"/,
  'atualizarLeadComEvolucao não pode mais usar fetch cru sem limite de tempo');

// 3. As duas funções desligam o modo limpo do card no fim de verdade (sucesso E falha) —
//    senão o card de instruções fica escondido pra sempre se o salvamento falhar, ou
//    reaparece cedo demais se ninguém desligar no sucesso.
for (const [nome, bloco] of [['salvarLeadPendente', salvarBloco], ['atualizarLeadComEvolucao', atualizarBloco]]) {
  const ocorrencias = (bloco.match(/qs\("#importCard"\)\?\.classList\.remove\("cp-import-rodando"\)/g) || []).length;
  assert.ok(ocorrencias >= 2, `${nome} precisa desligar o modo limpo tanto no sucesso quanto na falha (achei ${ocorrencias})`);
}

// 4. Erro final traduzido (não mais err.message cru) nas duas funções.
assert.match(salvarBloco, /toast\("Não foi possível salvar: "\s*\+\s*userFriendlyError\(err\)\)/,
  'salvarLeadPendente precisa traduzir o erro final com userFriendlyError');
assert.match(atualizarBloco, /toast\("Não foi possível atualizar: "\s*\+\s*userFriendlyError\(err\)\)/,
  'atualizarLeadComEvolucao precisa traduzir o erro final com userFriendlyError');

console.log('v1080-salvar-lead-timeout-e-modo-limpo: ok');
