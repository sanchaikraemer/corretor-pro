# v960 — mesmo regex frágil de acento em api/criar-upload-url.js, agora com guarda de regressão

## Contexto

Revisão linha a linha de `api/criar-upload-url.js` (228 linhas) — endpoint que gera a URL
assinada de upload direto pro Supabase Storage (ZIPs grandes do WhatsApp). Já estava marcado no
checklist de `REVISAO-COMPLETA.md` como tendo o mesmo problema encontrado em `_persistence.js`
(v950) e `_pipeline.js` (v951).

## O problema

`sanitizeFileName` (linha 105) tinha o mesmo regex de remoção de acento com os caracteres
Unicode combinantes LITERAIS no código-fonte (faixa U+0300–U+036F) em vez do escape
`̀-ͯ`. Funciona igual até o arquivo passar por alguma ferramenta/editor que normalize
Unicode na gravação — aí o regex corrompe silenciosamente, sem erro de sintaxe.

## O que mudou

- Mesmo fix mecânico da v950/v951: caracteres literais trocados pelo escape `̀-ͯ`.
- **Novo:** guarda de regressão (`tests/v960-sem-acento-unicode-literal.test.mjs`) que lê o
  código-fonte de todo arquivo já corrigido (`_persistence.js`, `_pipeline.js`,
  `criar-upload-url.js`) e falha se qualquer um voltar a ter o caractere combinante literal.
  Esse padrão já apareceu em 3 arquivos diferentes nesta revisão — até agora nada impedia uma
  cópia futura de reintroduzir o mesmo bug em silêncio. `app.js` (que tem o mesmo padrão em pelo
  menos 5 pontos, ainda não corrigido) fica de fora da lista de propósito, com comentário
  apontando pra entrar quando a revisão chegar lá.

## Verificação

- `npm test` verde, incluindo `v960-sem-acento-unicode-literal` (passa hoje porque os 3 arquivos
  já estão corretos) e a suíte completa (nada quebrou com o fix em `criar-upload-url.js`).
- `node --check api/criar-upload-url.js` OK.

## Resto do arquivo

Lido por completo. Não achei outro bug: `sanitizeImportId`/`sanitizeFileName` não permitem `/`
(sem risco de path traversal no `storagePath`), o limite de tamanho declarado é só um
pré-check de UX (a garantia real é o `fileSizeLimit` do bucket no Supabase, com fallback e aviso
já tratados), e os formatos de `importId` gerados em `app.js` (`criarImportId()`) passam
confortavelmente no regex de validação.

## Arquivos
- `api/criar-upload-url.js` (`sanitizeFileName` — regex de acento),
  `tests/v960-sem-acento-unicode-literal.test.mjs` (novo), `package.json`/`package-lock.json`,
  `NOTAS-v960.md`, versão **959 → 960**.
