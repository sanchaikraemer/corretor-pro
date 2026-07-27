# v1010 — Central de atenção passa a respeitar a pausa de fim de semana

## Contexto

Sábado à noite, o dono abriu o sino (Central de atenção): "31 atendimentos pedem ação — abra a
Condução". Abriu a Condução: "Nenhum cliente nesta visão". A fila do "Fazer agora" pausa no fim
de semana DE PROPÓSITO (regra do dono, v914/v937 — a fila volta na segunda), e a Home já conta
essa história ("Final de semana! ..."), mas o sino não sabia da regra e prometia ação onde a
tela entregava vazio.

## O que mudou (app.js)

- **Central de atenção em modo fim de semana**: em vez de "N atendimentos pedem ação", mostra
  "Fim de semana — fila pausada" com "N atendimentos esperam por você na segunda" (ou só "volta
  na segunda" quando não há nenhum). Compromissos ATRASADOS continuam aparecendo normalmente —
  atraso não tira folga.
- **Vazio da Condução explicado**: no fim de semana, o "Fazer agora" vazio diz "Fim de semana —
  a fila do 'Fazer agora' volta na segunda" (mesma linguagem da Home), em vez do genérico
  "Nenhum cliente nesta visão" que parecia defeito.

## Testes

Novo `tests/v1010-central-atencao-respeita-fds.test.mjs` (modo fim de semana no sino, modo
normal preservado, vazio explicado na Condução).

`npm test`: suíte inteira verde. `node build.js`: build limpo.

## Arquivos

`app.js`, `tests/v1010-central-atencao-respeita-fds.test.mjs` (novo),
`package.json`/`package-lock.json`, `NOTAS-v1010.md`, versão **1009 → 1010**.
