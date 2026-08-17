# v1286 — o baseline do banco deixou de ser dedução e virou o formato real

## O que aconteceu

A `0000_baseline.sql`, criada na v1285, foi escrita **lendo o código** — a sessão não tem acesso ao
Supabase (`CLAUDE.md`), então cada coluna foi levantada a partir do que o sistema grava e lê. A
nota da v1285 registrou isso como ressalva e o `README.md` das migrações trazia uma consulta de
leitura pra fechar a diferença.

**O dono rodou a consulta e colou o resultado. A ressalva estava certa: a dedução errava.**

| O que faltava | Por que a leitura de código não pegou |
|---|---|
| `lead_id` | o código só a menciona na lista de colunas críticas, nunca a grava direto |
| `nome` | está em `COLUNAS_ADAPTAVEIS` — é escrita pelo caminho adaptativo, que descarta em silêncio |
| `nome_cliente` | idem |
| Quase todos os valores padrão | `status`, `etapa`, `progresso`, `timeline_json`, `audios_*`, `created_at`, `updated_at` — o código nunca depende deles, então não aparecem em lugar nenhum |

A ordem das colunas também estava diferente da real.

## O que entrou

**`supabase/estrutura-producao-2026-08-17.txt`** — o resultado da consulta, guardado no
repositório. É a **única fonte não-inferida** do formato dessas duas tabelas, e passa a ser a
referência.

**`0000_baseline.sql` reescrita a partir dele.** Colunas, tipos, ordem, obrigatoriedade e valores
padrão conferem um a um com produção. Continua criando só o formato **anterior à `0001`**: o
`organization_id` (coluna 24 de `whatsapp_processamentos` e 4 de `direciona_config`) e os
`dedupe_*` (25 a 27) seguem sendo trabalho da `0001` e da `0010`, pra a corrente de migrações
continuar contando a mesma história.

## A prova

Num Postgres 16 de verdade: banco vazio → as 20 migrações na ordem → exportar a estrutura das duas
tabelas → comparar com o arquivo de produção.

```
=== banco reconstruído do repositório  ×  produção real ===
  IDÊNTICOS — 31 colunas, mesmos tipos, mesma ordem, mesmos padrões, mesma obrigatoriedade
```

O achado A5 da auditoria está fechado de verdade: **um banco criado a partir do repositório sai
igual ao que está no ar**, não parecido.

## Guarda

`tests/v1285-banco-nasce-do-repositorio.test.mjs` ganhou uma parte nova, que roda sem banco nenhum:
lê o arquivo de produção e exige que **toda coluna listada lá tenha quem a crie** em alguma
migração. Se produção ganhar uma coluna nova sem migração, ele acende.

E as três colunas que a dedução tinha perdido (`lead_id`, `nome`, `nome_cliente`) ficam nomeadas no
teste de propósito — pra ninguém "limpar" o baseline achando que são sobra.

**Suíte: 24 arquivos checados + 441 testes, todos verdes.**

## Nada a fazer em produção

Como sempre: o baseline é `create table if not exists`, e as tabelas já existem lá. Rodar não teria
efeito nenhum. Ele serve pra um banco novo — o ambiente de teste — e pro caso de precisar
reconstruir tudo.

A `0019` (a que faz o diagnóstico reportar as duas linhas novas) continua sendo a única que vale
colar no SQL Editor quando for conveniente.
