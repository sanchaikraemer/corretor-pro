# v784 — Apagar lead removia só UMA cópia (precisava apagar 2x)

## O problema

O corretor apagava um lead, mas ele "voltava". Só sumia de verdade quando apagava pela segunda vez.

## Causa

Alguns leads tinham cópias duplicadas no banco (herança da bagunça de importação anterior). A lista junta as cópias num card só, mas o apagar removia só UMA (a que estava na frente). A cópia que sobrava reaparecia como se o lead tivesse "voltado".

## Correção

A lista agora manda junto os ids de TODAS as cópias do mesmo cliente (`dupeIds`). Ao apagar, o app remove todas de uma vez — nos dois caminhos ("Excluir definitivamente" na tela do lead e excluir pelo editar). Uma vez só e some.

## Testes

- `npm test` e `npm run build` passaram.
- Falta validar em produção: apagar um lead duplicado e conferir que some de primeira.
