# v958 — 3 bugs reais em api/restaurar-leads.js (restauração de leads da base anterior)

## Contexto

Revisão linha a linha de `api/restaurar-leads.js` (264 linhas), o endpoint que lê as tabelas
antigas `leads`/`direciona_leads` e recria os leads dentro de `whatsapp_processamentos` (o
formato atual). Achados três bugs reais, todos corrigidos.

## 1. Data serial do Excel virava ano 45383

`iso(value, fallback)` tinha um bloco pra converter data serial do Excel (`45383` → 2024-04-01),
mas só entrava nesse bloco se `typeof value === "number"`. Só que TODO call site chama `iso()`
assim: `iso(str(row.criado_em, ...), ...)` — `str()` sempre devolve string. Ou seja, o bloco nunca
rodava de verdade.

O que acontecia então: `new Date("45383")` **não dá `Invalid Date`** — o parser do JS lê "45383"
como o ANO 45383. Isso passa direto no `Number.isNaN(d.getTime())` (não é NaN, é uma data válida,
só que absurda) e vira `criado_em`/`atualizado_em`/`proximo_contato` do lead restaurado. Silencioso:
nenhum erro, nenhum fallback, só uma data lixo persistida.

Fix: `iso()` agora detecta o número mesmo quando ele chega como string (o caso real de uso neste
arquivo), tentando `Number(value)` antes de decidir se é uma data serial do Excel.

## 2. Leads sem nome e sem telefone colapsavam num só

`normalizarLeadLegado` usa `name = str(row.nome, ..., "Cliente restaurado")` — um placeholder de
EXIBIÇÃO pra todo lead sem nome de verdade. O `dedupeKey` era calculado em cima desse `name` já
com o placeholder aplicado: `nome:${norm(name)}`. Resultado: TODA linha legada sem nome e sem
telefone virava a mesma chave `"nome:cliente restaurado"` — não importa se eram pessoas
diferentes, com `id` diferente, observação diferente.

Em `restaurarLeadsLegados`, o loop que monta `selected` usa `seenKeys` (um Set de dedupeKeys) pra
não restaurar duas vezes a "mesma pessoa". Como a chave colidia, a segunda linha (e a terceira,
quarta...) sem nome/telefone era descartada como se fosse duplicata da primeira — mesmo tendo
`id` de origem diferente. Dado real de cliente (observação, histórico) se perdia silenciosamente.

Fix: `dedupeKey` agora usa o nome REAL (antes do fallback de exibição). Sem telefone e sem nome
real, `dedupeKey` fica `""` — o código já tratava dedupeKey vazio como "não aplica" nos dois
lugares que o usam (`normalized.dedupeKey && ...`), então essas linhas passam a ser filtradas só
pelo próprio `id` de origem (que sempre existe numa tabela de verdade), não mais coladas umas nas
outras.

## 3. "Geladeira" virava "Standby" — lead arquivado voltava pra fila ativa

`stage()` (o mapeador de etapa livre → etapa canônica) tratava `"geladeira"` e `"stand"/"paus"`
como a mesma coisa, sempre devolvendo `"Standby"`. Mas `normalizarEtapa()` em `app.js` — a
autoridade real sobre esse vocabulário no resto do app — trata como DUAS etapas diferentes:
- `"Geladeira"`: arquivado, some da busca ativa (`foraDaBusca()` em app.js filtra por
  `e === "Geladeira"`).
- `"Standby"`: pausado, continua contando no pipeline ativo (`ORDEM` do cálculo de gargalo inclui
  "Standby", não inclui "Geladeira").

Então um lead que já estava arquivado ("Geladeira") na base antiga, ao ser restaurado, virava
"Standby" — reaparecia na fila ativa do corretor em vez de continuar arquivado.

Fix: `stage()` agora separa os dois casos, na mesma ordem/critério de `normalizarEtapa()`:
`"geladeira"/"arquiv"` → `"Geladeira"`; `"stand"/"paus"/"congelad"` → `"Standby"`.

## Verificação

- `npm test` verde, incluindo o teste novo `v958-restaurar-leads-fixes` (3 blocos: data serial
  via `normalizarLeadLegado`, dedupeKey vazio + restauração fim a fim de 2 leads anônimos
  distintos via `restaurarLeadsLegados` com um Supabase fake, e etapa Geladeira vs. Standby).
- `node --check api/restaurar-leads.js` OK.

## Achado registrado, não corrigido (padrão recorrente, fora de escopo seguro)

`lerTabela` e `currentKeys` usam `.limit(5000)` (leitura completa em memória pra dedup) — mesmo
padrão de escalabilidade já registrado em `_persistence.js`, `_pipeline.js` (x2) e
`lead-update.js`. Precisa de um redesenho com paginação/índice real; não é um fix pontual seguro
de fazer no meio da revisão.

## Arquivos
- `api/restaurar-leads.js` (`stage()`, `iso()`, `normalizarLeadLegado` — dedupeKey),
  `tests/v958-restaurar-leads-fixes.test.mjs` (novo), `package.json`/`package-lock.json`,
  `NOTAS-v958.md`, versão **957 → 958**.
