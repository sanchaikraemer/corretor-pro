import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1070 — dono reportou (com print do Desempenho): "Importações: 90" e "Análises feitas: 19" não
// batiam, mesmo cada importação passando pela IA. Causa: cpRegistrarAtividade("analise") só era
// chamada em dois lugares — reanalisar 1 lead (ui670Reanalisar, v929) e "Reanalisar todos"
// (executarReanaliseTudo, v971) — nenhum dos dois é o caminho de uma importação NOVA. A etapa
// "analisar" de processarStorageEmEtapas (que roda em TODA importação, via processFile) nunca
// registrava nada, então "Análises feitas" só contava reanálise manual, não a análise automática
// de cada conversa importada.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const iniFn = app.indexOf('async function processarStorageEmEtapas(bucket, path, fileName, options = {}){');
assert.ok(iniFn > -1, 'processarStorageEmEtapas não encontrada em app.js');
const fimFn = app.indexOf('\n}', iniFn);
const fnSrc = app.slice(iniFn, fimFn);

// Precisa registrar "analise" só depois que o resultado da IA passou pelas validações (sem
// sugestões pendentes, com as 3 mensagens), nunca antes de saber que a análise deu certo.
const marcaValidacao = 'A análise permanece pendente porque uma das três mensagens não passou pelas regras do Cérebro.';
const idxValidacao = fnSrc.indexOf(marcaValidacao);
const idxRegistro = fnSrc.indexOf('cpRegistrarAtividade("analise")');
assert.ok(idxValidacao > -1, 'checagem de sugestões pendentes não encontrada');
assert.ok(idxRegistro > -1, 'processarStorageEmEtapas precisa registrar a atividade "analise" no sucesso da análise');
assert.ok(idxRegistro > idxValidacao, 'o registro de "analise" precisa vir DEPOIS da validação das 3 mensagens (só conta análise que passou)');

// Precisa estar dentro de um try/catch mudo (mesmo padrão dos outros dois pontos de
// instrumentação) — nunca pode derrubar a importação se o localStorage falhar.
assert.match(fnSrc, /try\{ cpRegistrarAtividade\("analise"\); \}catch\(_\)\{\}/,
  'o registro precisa ser silencioso (try/catch vazio), igual aos outros pontos de instrumentação');

console.log('v1070-analise-conta-na-importacao: ok');
