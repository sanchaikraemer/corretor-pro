# NOTAS v1063 — Trava explícita: filtro só tira embalagem do arquivo, nunca palavra do nome

## O relato

Depois da v1062 (que removeu de vez o filtro que apagava palavras como "terreno" de dentro do
nome do lead), o dono pediu: "coloca de volta o filtro, porém só pra retirar do arquivo q vem o
seguinte: 'Conversa do WhatsApp com' '-enxuto.zip'" — e completou "ou '.zip'".

## Causa / verificação

Não havia nada quebrado: esse filtro (`cleanFileName`, em `api/_persistence.js`) nunca tinha
sido removido — só o outro (`limparRuidoNome`, que mexia em PALAVRAS de dentro do nome real) foi
tirado na v1062. Rodei `cleanFileName`/`nameFrom` direto contra casos reais antes de mexer em
qualquer coisa: `"Conversa do WhatsApp com Fulano-enxuto.zip"` já virava `"Fulano"`, e um nome
real como `"Fulano Terreno Cel"` continuava saindo intacto, sem apagar nenhuma palavra.

## A mudança

Nenhuma mudança de comportamento — o filtro pedido já existia e já fazia exatamente isso. Esta
versão só trava esse comportamento pra ele nunca mais sumir por engano numa limpeza futura:
- Comentário explícito em `cleanFileName` (`api/_persistence.js`) avisando que é o ÚNICO filtro
  permitido no nome, e que ele NUNCA pode virar o filtro de palavras removido na v1062.
- Teste dedicado (`tests/v1063-filtro-so-tira-embalagem-do-arquivo.test.mjs`) provando os dois
  lados: a embalagem do arquivo ("Conversa do WhatsApp com...", "-enxuto.zip", ".zip") some, e
  nenhuma palavra do nome real (nem "terreno", nem "cel") é tocada.

## Testes

- `tests/v1063-filtro-so-tira-embalagem-do-arquivo.test.mjs` (novo).
- `npm test`: suíte inteira verde.

## Arquivos

`api/_persistence.js` (comentário de trava em `cleanFileName`, sem mudança de comportamento),
`tests/v1063-filtro-so-tira-embalagem-do-arquivo.test.mjs` (novo), `package.json` /
`package-lock.json` (versão + script `test`), `NOTAS-v1063.md`, versão **1062 → 1063**.
