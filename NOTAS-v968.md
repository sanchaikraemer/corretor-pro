# v968 — js/dom.js: escapeHtml(null) virava o texto "null" + toast() com timer sobreposto

## Contexto

Última etapa da revisão linha a linha: `js/dom.js`, `js/commercial-schema.js`, `js/state.js`
(bloco final do checklist, três arquivos pequenos revisados juntos). Dois bugs reais
encontrados em `js/dom.js`, usado por `app.js` e por todos os módulos `js/*.js`.

## Os problemas

1. **`escapeHtml(t="")`** — o parâmetro default só entra em ação quando o argumento é
   exatamente `undefined`. Um campo nulo vindo do banco (coluna sem valor no Postgres vira
   `null` no JSON, o campo não desaparece do objeto) chega como `null`, não `undefined` —
   `String(null)` é a STRING `"null"`, não vazio. Em qualquer chamada `escapeHtml(campo)` sem
   um `|| ''`/`?? ''` prévio, um campo nulo mostrava o texto literal **"null"** na tela em vez
   de nada. Confirmado que o app usa os dois padrões (com e sem guarda prévia) em pontos
   diferentes — inconsistente, então o bug é alcançável dependendo de qual trecho lê o campo.
2. **`toast(t)`** — cada chamada criava um novo `setTimeout` sem cancelar o anterior. Dois
   toasts em menos de 2.6s (plenamente possível — várias ações do app disparam toast em
   sequência) faziam o timer do PRIMEIRO esconder o texto do SEGUNDO antes da hora certa.

## O que mudou

- `escapeHtml`: troca do parâmetro default (`t=""`) por `t??""` dentro do corpo — cobre
  `null` E `undefined` igual. Comportamento pra qualquer outro valor (incluindo `0`, que é
  falsy mas legítimo) continua idêntico.
- `toast`: guarda o id do timer num `let` de escopo de módulo e cancela o anterior
  (`clearTimeout`) antes de agendar o novo — dois toasts próximos não derrubam um ao outro
  mais cedo.

## O que NÃO mexi (mesma classe de achado, mas não alcançável hoje)

- `safeJson(v)` faz `JSON.stringify(v).replace(...)` — `JSON.stringify(undefined)` retorna
  `undefined` (não string), e `.replace` num `undefined` quebraria com exceção. Rastreei os 3
  call sites reais em `app.js` (`safeJson(lead?.name||'')`, `safeJson(lead?.product||'')`,
  `safeJson(cp704Produto(lead,mc))` — a última sempre cai num fallback de string não-vazio) —
  todos garantidamente não-undefined hoje. Não mexi: não é bug alcançável agora, e reforçar
  seria validação especulativa pra um cenário que os 3 chamadores atuais já evitam.
- `js/commercial-schema.js`: `ui675AnaliseDeterministica` (app.js, linha ~10354) grava
  `_schemaComercial` manualmente em vez de chamar `stampCommercialSchema` (que também
  gravaria `_schemaComercialMinor`). Não é bug: `_schemaComercialMinor` nunca é lido em
  lugar nenhum do projeto (confirmado por grep) — só grava metadado morto, sem efeito na
  lógica real de "esse cache está na versão do schema atual?" (que olha só
  `_schemaComercial`/`modeloComercial.versao`).

## Verificação

- `npm test` verde, incluindo o teste novo.
- Novo teste `tests/v968-dom-escapehtml-null-e-toast-timer.test.mjs`: `escapeHtml` é pura (não
  toca o DOM) — testada de verdade, chamando a função com `null`/`undefined`/`0`/HTML real.
  `toast()` toca o DOM (`#toast`) — verificado por leitura do código-fonte, mesmo padrão já
  usado no resto da suíte pra funções que dependem do navegador.
- `node --check js/dom.js` / `js/commercial-schema.js` / `js/state.js` OK.

## Arquivos
- `js/dom.js` (`escapeHtml`, `toast`),
  `tests/v968-dom-escapehtml-null-e-toast-timer.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v968.md`, versão **967 → 968**.
