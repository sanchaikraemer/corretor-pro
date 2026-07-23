# v947 — retry na chamada principal da IA + max_tokens maior

## O problema

A chamada de IA que gera diagnóstico + 3 mensagens (`chamarGPT4Json` dentro de `analyzeWithBrain`,
`api/_pipeline.js`) não tinha nenhuma rede contra erro transitório — diferente da transcrição de
áudio, que já usa `withRetries`/`isRetryableOpenAIError`. Um 429, um 5xx passageiro da OpenAI, ou
um timeout isolado descartava a análise inteira na hora (`mode:"erro_api"`), obrigando reanálise
manual mesmo quando o problema era só uma instabilidade momentânea. Além disso, `max_tokens` da
análise (2300) era apertado pra resumo + 12 campos de diagnóstico + 3 mensagens — risco de
truncamento silencioso do JSON em conversas mais ricas.

## O que mudou

1. **Timeout marcado como retentável**: o erro de timeout de `chamarGPT4Json` ganhou
   `err.code = "ETIMEDOUT"`, pra ser reconhecido por `isRetryableOpenAIError` (que já existia, só
   reconhecia status 429/5xx ou códigos de rede específicos — um timeout genérico não batia em
   nenhum dos dois).
2. **A chamada principal agora usa `withRetries`** — reaproveitando o mesmo helper genérico já
   usado na transcrição, sem duplicar lógica. **2 tentativas, não 3**, de propósito: as rotas que
   chamam `analyzeWithBrain` (`api/reanalisar-lead.js`, `api/processar-storage.js`) têm
   `maxDuration:60` no `vercel.json`. Com o timeout de 26s por tentativa, 2 tentativas + 800ms de
   espera ≈ 52.8s — cabe com folga sob o teto. 3 tentativas estourariam os 60s antes da nossa
   própria lógica desistir, virando um 504 do Vercel no meio da execução (pior que o erro
   controlado que existia antes).
3. **`max_tokens` da análise subiu de 2300 para 3600** (padrão env-configurável,
   `DIRECIONA_ANALYSIS_MAX_TOKENS`, sem mudar o mecanismo).

## O que NÃO foi feito (decisão que esbarra em algo já deliberado)

Cheguei a avaliar "persistir o diagnóstico mesmo quando só as 3 mensagens falham" (hoje
`api/processar-storage.js` e `api/reanalisar-lead.js` descartam a análise inteira com
502/422 se o trio de mensagens vier incompleto, mesmo quando o diagnóstico saiu certo). Mas achei
um comentário explícito no código da reanálise (`api/reanalisar-lead.js`, marcado "v750"): a
decisão de NUNCA persistir um resultado parcial/misturado com o anterior foi deliberada, pra
evitar um registro "Frankenstein" com diagnóstico novo e mensagens/dados antigos incoerentes entre
si. Reverter isso sem confirmar seria ignorar uma escolha já tomada — fica registrado aqui pra
decisão explícita numa sessão futura, não implementado nesta.

## Verificação

- `tests/v947-retry-analise-e-max-tokens.test.mjs` (novo): confere o `code: "ETIMEDOUT"` no
  timeout, que `analyzeWithBrain` usa `withRetries` com exatamente 2 tentativas (não 3), que a
  conta de pior caso (2×timeout + backoff) cabe com folga (≥5s) dentro do `maxDuration:60` das
  duas rotas reais que chamam a análise, que `max_tokens` subiu acima de 2300, e o comportamento
  real de `withRetries`/`isRetryableOpenAIError` (recupera na 2ª tentativa após erro retentável;
  falha na hora sem gastar tentativas num erro não-retentável, tipo 400).
- `tests/v827-18-resgate-mensagens-ia.test.mjs` (atualizado): esse teste travava a string literal
  `await chamarGPT4Json(` aparecendo 1 única vez, pra impedir um padrão antigo de "correção
  automática" via reprompt. Meu retry é de TRANSPORTE (erro de rede/API transitório), não reprompt
  de conteúdo — atualizei a asserção pra reconhecer `await withRetries(() => chamarGPT4Json(` como
  a mesma chamada única, mantendo as guardas contra o padrão antigo (`while(!validacaoMensagens`,
  `promptRetry`, `modeloAnaliseRapida`, `correção automática` continuam proibidos).
- Suíte inteira verde (`npm test`); `node build.js` OK, versão 947.

## Arquivos
- `api/_pipeline.js` (`chamarGPT4Json` — timeout com `code:"ETIMEDOUT"`; `analyzeWithBrain` —
  chamada envolvida em `withRetries`, `max_tokens` 2300→3600),
  `tests/v947-retry-analise-e-max-tokens.test.mjs` (novo),
  `tests/v827-18-resgate-mensagens-ia.test.mjs` (atualizado),
  `package.json`/`package-lock.json`, `NOTAS-v947.md`, versão **946 → 947**.
