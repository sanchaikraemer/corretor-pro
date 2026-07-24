# v965 — mesmo regex frágil de acento, agora em app.js (3 pontos)

## Contexto

Continuação da revisão linha a linha de `app.js`. O padrão já corrigido em `_persistence.js`
(v950), `_pipeline.js` (v951) e `criar-upload-url.js` (v960) também estava presente aqui —
achado por uma varredura exata (não estimativa) do arquivo inteiro.

## O problema

Três funções tinham os caracteres Unicode combinantes LITERAIS (faixa U+0300–U+036F) dentro do
regex de remoção de acento, em vez do escape `̀-ͯ`:
- `normalizarEtapa` (linha 3711) — normaliza a etapa do lead pra um dos valores canônicos.
- `semAcento` (linha 7870) — usada na busca global e em vários outros pontos.
- Uma função local `_normpc` (linha 8356).

Mesmo risco das outras correções: funciona igual até o arquivo passar por alguma
ferramenta/editor que normalize Unicode na gravação — aí o regex corrompe silenciosamente, sem
erro de sintaxe.

## O que mudou

- As 3 ocorrências trocadas pelo escape padrão `̀-ͯ`.
- `app.js` entrou na lista de arquivos vigiados pelo teste de guarda
  `tests/v960-sem-acento-unicode-literal.test.mjs` (criado na v960) — a varredura confirmou que
  eram exatamente 3 pontos no arquivo inteiro, não "pelo menos 5" como a nota antiga estimava.

## Verificação

- `npm test` verde, incluindo `v960-sem-acento-unicode-literal` (agora cobrindo `app.js`
  também).
- `node --check app.js` OK.

## Arquivos
- `app.js` (`normalizarEtapa`, `semAcento`, `_normpc`),
  `tests/v960-sem-acento-unicode-literal.test.mjs` (lista de arquivos atualizada),
  `package.json`/`package-lock.json`, `NOTAS-v965.md`, versão **964 → 965**.
