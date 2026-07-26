# v989 — /api/analisar: prova de verdade que a trava funciona

## Contexto

Uma auditoria antiga (v892) tinha apontado `/api/analisar` como a única rota do sistema que
aceitava upload e mandava rodar a IA sem pedir a chave de acesso — isso já tinha sido corrigido na
v963 (`requireApiKey()` foi adicionado como primeira linha do handler). O dono pediu pra "travar de
vez" essa rota, então fui conferir se a correção da v963 realmente se sustenta.

Achado: o teste que cobre essa proteção (`v963-todas-rotas-exigem-api-key`) só confere se a palavra
`requireApiKey` aparece no texto do arquivo — não prova que um pedido sem a chave é recusado de
verdade, nem que isso acontece antes de o arquivo enviado ser lido. Um teste desses passaria mesmo
se, por engano, `requireApiKey(...)` estivesse escrito mas nunca fosse de fato chamado no caminho
certo, ou chamado depois da leitura do arquivo.

## O que mudou

Novo teste de comportamento real (`tests/v989-analisar-trava-sem-chave.test.mjs`) que chama o
handler de `api/analisar.js` de verdade, simulando um pedido:

- **Sem a chave de acesso**: confirma que a resposta é 401 e que o arquivo enviado nunca chega a
  ser lido (o "corpo" do pedido levantaria um erro se fosse lido — o teste falha se isso acontecer).
- **Com a chave certa**: confirma que o pedido passa da checagem (o erro que sobra é "sem ZIP", não
  mais 401) — prova que a trava é específica da ausência/erro da chave, não um bloqueio geral quebrado
  por acidente.

Como `requireApiKey()` tem um atalho que libera tudo quando roda dentro do `npm test`
(`NODE_ENV`/`npm_lifecycle_event` = `test`), o teste desliga esse atalho de propósito antes de
chamar o handler e restaura o ambiente depois — senão o teste "passaria de graça" sem checar nada.

Nenhum código de produção mudou: a proteção da v963 já estava certa, o que faltava era a prova.

## Testes

- Novo: `tests/v989-analisar-trava-sem-chave.test.mjs`.
- `npm test`: suíte inteira verde (inclui o `v963-todas-rotas-exigem-api-key` original, que
  continua como guarda geral pra qualquer rota nova).

## Arquivos

`tests/v989-analisar-trava-sem-chave.test.mjs` (novo), `package.json`/`package-lock.json`
(lista de testes + versão), `NOTAS-v989.md`, versão **988 → 989**.
