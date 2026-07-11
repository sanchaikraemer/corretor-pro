# v783 — Editar/apagar lead demorava a refletir (cache de 30s do servidor)

## O problema

- Editar o nome de um lead: dizia "salvo", mas a lista continuava com o nome antigo.
- Apagar um lead: o lead não saía na hora, demorava.

## Causa

O backend (`leads-recentes`) guarda a lista por 30 segundos. Depois de uma mudança, o app até invalidava o cache DELE, mas a busca seguinte não pedia a versão "fresca" ao servidor — então o servidor devolvia a lista velha (com o nome antigo / com o lead apagado) por até 30 segundos.

## Correção (`app.js`)

Toda mutação (salvar, editar, apagar, mudar etapa) já chama `invalidarLeadsCache`. Agora essa função também liga um sinal que faz **a próxima busca vir fresca do servidor** (ignora os 30s de cache). Assim a edição e a exclusão aparecem na hora.

## Testes

- `npm test` e `npm run build` passaram.
- Falta validar em produção: editar um nome e apagar um lead, conferindo que refletem imediatamente.
