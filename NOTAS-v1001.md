# v1001 — corrige lead restaurado da base legada ficando sem dono

## Contexto

Ao revisar `api/restaurar-leads.js` (a ferramenta que recupera clientes das tabelas antigas
`leads`/`direciona_leads` de antes das contas por login), achei um efeito colateral da separação
por corretor começada nas versões anteriores: o lead restaurado não gravava `organization_id`
nenhum. Sem essa marca, ele ficaria invisível pra qualquer tela (toda leitura da Carteira agora
filtra por `organization_id`, e uma linha sem esse valor não aparece pra ninguém) — não vaza dado
de ninguém, mas o corretor perderia o cliente recuperado sem perceber.

Essa ferramenta só existe pra recuperar dados de ANTES das contas por login — ou seja, é sempre
da conta original, nunca de um corretor novo (não existe "cliente legado" de um corretor que
começou a usar o sistema agora). Continua protegida só pela chave de segurança de sempre, do
jeito que já era (não é uma tela que um corretor comum usa).

## O que mudou

`api/restaurar-leads.js`: cada lead restaurado passa a gravar `organization_id` da empresa
original, e a checagem de "esse cliente já existe?" (pra não duplicar) passa a olhar só os
registros dessa mesma conta.

## Testes

`tests/v958-restaurar-leads-fixes.test.mjs` (já existente) ganhou uma checagem nova: confirma que
todo lead restaurado grava o `organization_id` certo.

`npm test`: suíte inteira verde. `node build.js`: build limpo.

## Arquivos

`api/restaurar-leads.js`, `tests/v958-restaurar-leads-fixes.test.mjs` (reforçado),
`package.json`/`package-lock.json`, `NOTAS-v1001.md`, versão **1000 → 1001**.
