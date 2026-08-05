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

// 3. v1140 — o desenho mudou (caso real: análise que PRECISA de mais de 26s falhava sempre, nas
// duas tentativas iguais, e a importação morria aos 92%). A 1ª tentativa (modelo principal) ganha
// a janela grande; se ela falhar (timeout/429/5xx), a 2ª roda no modelo RÁPIDO com o tempo que
// sobrou do orçamento. A intenção original deste teste continua travada: erro passageiro não
// descarta a análise (sempre existe uma segunda chance) e o envelope cabe no maxDuration.
const inicio = pipeline.indexOf('export async function analyzeWithBrain');
const fim = pipeline.indexOf('export async function compararEvolucao', inicio);
const analyzeSrc = pipeline.slice(inicio, fim);
assert.match(analyzeSrc, /model: modeloAnalise\(\),[\s\S]*?timeout: janelaPrincipalMs/,
  '1ª tentativa: modelo principal com a janela grande');
assert.match(analyzeSrc, /model: modeloTarefasSimples\(\),[\s\S]*?timeout: sobraMs/,
  '2ª tentativa: modelo rápido com o tempo restante do orçamento');
assert.match(analyzeSrc, /modeloFallbackUsado = true/,
  'quando o modelo rápido salva a análise, o resultado registra isso (modeloFallback)');

// 4. Restrição de tempo (refeita na v1140): a janela da 1ª tentativa deixa espaço pro fallback
// dentro do orçamento, e o orçamento cabe com folga dentro do maxDuration:60 das rotas que chamam
// analyzeWithBrain (reanalisar-lead.js e processar-storage.js, via finalizarAnaliseDaConversa).
// Se algum dia subirem DIRECIONA_ANALYSIS_TIMEOUT_MS/BUDGET_MS sem refazer essa conta, a função
// estoura o teto da Vercel e vira 504 no meio da execução.
const budgetMatch = analyzeSrc.match(/DIRECIONA_ANALYSIS_BUDGET_MS \|\| (\d+)/);
const timeoutMatch = analyzeSrc.match(/DIRECIONA_ANALYSIS_TIMEOUT_MS \|\| (\d+)/);
assert.ok(budgetMatch && timeoutMatch, 'orçamento/janela default da análise não encontrados');
const orcamentoMs = Number(budgetMatch[1]);
const janelaMs = Number(timeoutMatch[1]);
assert.ok(janelaMs + 14000 <= orcamentoMs,
  `a janela principal (${janelaMs}ms) precisa deixar >=14s pro fallback dentro do orçamento (${orcamentoMs}ms)`);
for (const rota of ['api/processar-storage.js', 'api/reanalisar-lead.js']) {
  const maxDurationMs = Number(vercelConfig.functions?.[rota]?.maxDuration || 0) * 1000;
  assert.ok(maxDurationMs > 0, `maxDuration de ${rota} não encontrado no vercel.json`);
  assert.ok(orcamentoMs < maxDurationMs - 5000,
    `o orçamento da análise (${orcamentoMs}ms) precisa caber com folga (>=5s) dentro do maxDuration de ${rota} (${maxDurationMs}ms)`);
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
