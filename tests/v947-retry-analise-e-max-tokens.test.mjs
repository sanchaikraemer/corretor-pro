import fs from 'node:fs';
import assert from 'node:assert/strict';

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const vercelConfig = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

// v947 — a chamada principal da IA (chamarGPT4Json dentro de analyzeWithBrain) não tinha nenhuma
// rede contra erro transitório (429/5xx/timeout) — diferente da transcrição, que já usa
// withRetries. Um erro passageiro da OpenAI descartava a análise inteira (mode:"erro_api").
// Também subiu o teto de max_tokens (2300 era apertado pra resumo + 12 campos de diagnóstico +
// 3 mensagens, arriscando truncamento silencioso do JSON).

// 1. isRetryableOpenAIError/withRetries existem e continuam genéricos (usados pela transcrição).
function extrai(nome) {
  const m = pipeline.match(new RegExp(`(?:async )?function ${nome}\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`));
  assert.ok(m, `${nome} não encontrada em api/_pipeline.js`);
  return m[0];
}
const isRetryableSrc = extrai('isRetryableOpenAIError');
const withRetriesSrc = extrai('withRetries');

// 2. O timeout de chamarGPT4Json passa a ser marcado como retentável (code ETIMEDOUT) — sem isso,
// um timeout nunca seria retentado por isRetryableOpenAIError (só reconhece status 429/5xx ou
// códigos de rede específicos, e o timeout antigo era um Error genérico sem nenhum dos dois).
const chamarGPT4JsonSrc = extrai('chamarGPT4Json');
assert.match(chamarGPT4JsonSrc, /err\.code = "ETIMEDOUT"/, 'o timeout da chamada principal é marcado como retentável');

// 3. analyzeWithBrain envolve a ÚNICA chamada com withRetries — 2 tentativas, não 3.
const inicio = pipeline.indexOf('export async function analyzeWithBrain');
const fim = pipeline.indexOf('export async function compararEvolucao', inicio);
const analyzeSrc = pipeline.slice(inicio, fim);
assert.match(analyzeSrc, /await withRetries\(\(\) => chamarGPT4Json\(/, 'a chamada principal usa withRetries');
assert.match(analyzeSrc, /\{\s*tries:\s*2,\s*baseDelayMs:\s*800\s*\}/, 'exatamente 2 tentativas com 800ms de backoff — não 3');

// 4. Restrição de tempo: 2 tentativas × timeout da análise + o backoff entre elas precisa caber
// com folga dentro do maxDuration:60 configurado no vercel.json para as rotas que chamam
// analyzeWithBrain (reanalisar-lead.js e processar-storage.js, via finalizarAnaliseDaConversa).
// Se algum dia subirem DIRECIONA_ANALYSIS_TIMEOUT_MS ou o número de tentativas sem checar essa
// conta, a função vai estourar o teto do Vercel e virar 504 no meio da execução (pior que o
// timeout de 26s isolado que existia antes).
const timeoutMatch = analyzeSrc.match(/DIRECIONA_ANALYSIS_TIMEOUT_MS \|\| (\d+)/);
assert.ok(timeoutMatch, 'timeout default da análise não encontrado');
const timeoutMs = Number(timeoutMatch[1]);
const piorCasoMs = 2 * timeoutMs + 800; // 2 tentativas + 1 espera de backoff entre elas
for (const rota of ['api/processar-storage.js', 'api/reanalisar-lead.js']) {
  const maxDurationMs = Number(vercelConfig.functions?.[rota]?.maxDuration || 0) * 1000;
  assert.ok(maxDurationMs > 0, `maxDuration de ${rota} não encontrado no vercel.json`);
  assert.ok(piorCasoMs < maxDurationMs - 5000,
    `pior caso do retry (${piorCasoMs}ms) precisa caber com folga (>=5s) dentro do maxDuration de ${rota} (${maxDurationMs}ms)`);
}

// 5. max_tokens da análise subiu (2300 era apertado) — continua configurável por env var.
const tokensMatch = analyzeSrc.match(/DIRECIONA_ANALYSIS_MAX_TOKENS \|\| (\d+)/);
assert.ok(tokensMatch, 'max_tokens default da análise não encontrado');
assert.ok(Number(tokensMatch[1]) > 2300, 'o teto de max_tokens da análise precisa ser maior que o antigo (2300)');

// 6. Comportamento real de withRetries/isRetryableOpenAIError (funções puras, sem dependências) —
// erro retentável se recupera na 2ª tentativa; erro não-retentável falha na hora, sem esperar.
const isRetryableOpenAIError = eval(`(${isRetryableSrc.replace(/^function/, 'function ')})`);
assert.equal(isRetryableOpenAIError({ code: 'ETIMEDOUT' }), true, 'timeout marcado (ETIMEDOUT) é retentável');
assert.equal(isRetryableOpenAIError({ status: 429 }), true, '429 é retentável');
assert.equal(isRetryableOpenAIError({ status: 400 }), false, '400 (erro do cliente) não é retentável');

const withRetries = eval(`(${withRetriesSrc.replace(/^async function/, 'async function ')})`);
let chamadas = 0;
const resultado = await withRetries(async () => {
  chamadas++;
  if (chamadas === 1) { const e = new Error('transitório'); e.status = 429; throw e; }
  return 'ok-na-segunda-tentativa';
}, { tries: 2, baseDelayMs: 1 });
assert.equal(resultado, 'ok-na-segunda-tentativa', 'recupera na 2ª tentativa após erro retentável');
assert.equal(chamadas, 2, 'tentou exatamente 2 vezes');

let chamadasNaoRetentavel = 0;
await assert.rejects(() => withRetries(async () => {
  chamadasNaoRetentavel++;
  const e = new Error('erro do cliente'); e.status = 400; throw e;
}, { tries: 3, baseDelayMs: 1 }));
assert.equal(chamadasNaoRetentavel, 1, 'erro não-retentável falha na 1ª tentativa, sem gastar as outras');

console.log('v947-retry-analise-e-max-tokens: ok');
