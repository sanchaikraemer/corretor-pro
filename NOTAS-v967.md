# v967 — confirm() nativo em js/proposta.js (a varredura da v964 não cobriu este arquivo)

## Contexto

Continuação da revisão linha a linha, agora em `js/proposta.js` (módulo do Gerador de proposta,
extraído de `app.js` na v848). A v964 já tinha convertido 10 usos de `confirm()` nativo em
`app.js` pro modal em-app `cp903Confirm` (pedido original do dono: a tela nativa do navegador,
com a URL do app aparecendo, "fica fora de padrão"). Essa varredura olhou só `app.js` — este
arquivo, que é um módulo separado, ficou de fora e continuava com 2 usos do `confirm()` nativo.

## O problema

- `propClear()` (botão "Limpar" da tela de proposta): `if(!confirm("Limpar todos os campos da
  proposta?")) return;`
- `excluirPropostaTimeline()` (excluir uma proposta já registrada no histórico do lead):
  `if(!confirm("Excluir esta proposta do histórico do lead?")) return;`

Mesmo problema visual/de identidade já corrigido em todo o resto do app.

## O que mudou

Convertidos pro mesmo padrão já usado em `app.js`:
```js
const okX = (typeof cp903Confirm === "function")
  ? await cp903Confirm({ titulo: "...", mensagem: msgX, ok: "...", perigo: true })
  : confirm(msgX);
if(!okX) return;
```
`cp903Confirm` é definida em `app.js` como `window.cp903Confirm` — acessível como identificador
solto de dentro de `js/proposta.js` porque esse módulo não declara nenhum `cp903Confirm` próprio
(sem risco do bug de "duas versões, uma no escopo do módulo e outra em `window`" já visto e
documentado várias vezes nesta revisão em `app.js`).

`propClear` precisou virar `async function` (antes era síncrona) pra poder dar `await` no
`cp903Confirm`. Continua exportada em `window.propClear` (chamada via `onclick="propClear()"`
no HTML) — uma função async chamada por um `onclick` funciona normalmente, só não é esperada
pelo chamador, o que não muda nada aqui (o botão não precisa saber quando termina).

Os dois usos marcados `perigo: true`, seguindo o mesmo critério já usado no resto do app:
"Limpar proposta" descarta tudo que foi digitado no formulário (mesmo critério de "Descartar
importação"/"Descartar análise", que também são `perigo: true` mesmo sem apagar dado do
backend); "Excluir proposta" apaga um registro permanente do histórico do lead.

## Verificação

- `npm test` verde, incluindo o teste novo.
- Novo teste `tests/v967-proposta-confirm-nativo.test.mjs`: confirma que `propClear` e
  `excluirPropostaTimeline` usam `cp903Confirm`, e que `propClear` continua exportada em
  `window`.
- `node --check js/proposta.js` OK.
- Teste antigo `tests/js-proposta-module.test.mjs` (extração do módulo, v848) continua verde —
  a mudança para `async function propClear` não quebra o regex de detecção da função.

## Arquivos
- `js/proposta.js` (`propClear`, `excluirPropostaTimeline`),
  `tests/v967-proposta-confirm-nativo.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v967.md`, versão **966 → 967**.
