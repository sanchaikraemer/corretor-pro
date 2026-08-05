# v1136 — a listagem parou de puxar a conversa inteira de todo lead (a causa da cota estourada)

Item 1 do plano aprovado pelo dono ("mete ficha"): cortar o consumo do Supabase.

## O problema, medido

Achado nº 1 da auditoria de 05/08/2026: **toda** carga da lista de clientes selecionava
`timeline_json` — a conversa inteira, às vezes anos de mensagens — de **todo** lead, e mandava pro
celular só uma prévia de 8 mensagens. O resto era descartado *depois* de já ter saído do banco.

O cache de estatísticas da v1017 evitava **recalcular**, mas não evitava **trafegar**: a validade
dele dependia de `len === timeline.length`, e pra saber o `length`... era preciso trazer a
timeline. O cache economizava CPU e não economizava um byte de rede.

Com a Home buscando a carteira a cada 2 minutos (+ toda volta de aba + depois de cada gravação),
era quase certamente isso que estourava a cota de egress do plano grátis do Supabase (5 GB), que o
painel acusa desde a v1122 — e que deixa o app inteiro lento pra todo mundo.

## A correção

O `_statsCache` virou **v3** e ganhou três coisas que permitem à listagem confiar nele **sem ter a
conversa em mãos**:

1. **Marca d'água** (`marca` = `atualizado_em` da linha) — é a mesma marca que a trava de gravação
   da v1082 já usa, e que **toda mutação real de lead atualiza** (importar, reanalisar, marcar
   atendido, memória, lembrete...). Linha tocada → marca diferente → cache cai sozinho.
2. **A prévia de 8 mensagens**, já no formato que a lista envia — a tela não muda em nada.
3. **O último toque** (`lastTouchIso`/`lastTouchTime`) — alimenta "dias desde o último contato" e o
   horário do card, que antes vinham direto da timeline.

Com isso:

- **Regime normal** (nada mudou): **uma** consulta, sem `timeline_json`, zero gravação.
- **Lead mexido**: segunda consulta busca a conversa **só dele** (lotes de 50), recalcula, regrava
  o cache v3. Cinto e suspensório: quando a conversa está em mãos, o tamanho dela ainda é conferido
  contra o `len` do cache, como sempre foi.
- **Virada do dia**: os números de 90 dias envelhecem, então todo mundo recalcula **uma vez** e o
  dia novo é carimbado — o resto do dia volta ao regime barato. (Semântica dos números preservada
  exatamente: a mesma varredura de sempre, só que uma vez por dia em vez de a cada 2 minutos.)
- **Detalhe do lead / backup**: `includeFullTimeline` continua trazendo o histórico completo na
  consulta principal, como sempre.
- **Falha na segunda consulta** (rede/banco): a linha usa o último cache conhecido — números de
  ontem na tela são melhores que zerar tudo e parecer perda de dados. Nada é gravado; a próxima
  carga tenta de novo.

## O que isso muda na prática

A transferência da listagem cai de "todas as conversas, a cada 2 minutos" para "nenhuma conversa no
regime normal; só as mexidas; todas, uma única vez, na virada do dia". Pra cota de 5 GB que vinha
estourando, é a diferença entre estourar e sobrar.

## Por que nenhum teste antigo pegava isso

Os bancos de mentira dos testes devolviam a linha **inteira** fosse qual fosse o `select` pedido —
então "pedir demais" era invisível pra eles. O teste novo
(`v1136-listagem-nao-traz-conversa-inteira`) usa um fake que **respeita a lista de colunas** e
conta as consultas: prova que o regime normal é uma consulta sem conversa, que a segunda consulta
busca só as linhas certas (com filtro de empresa e em lotes de 50), que a virada do dia recalcula e
recarimba, que o detalhe segue completo e que a falha degrada pros números de ontem. Também trava,
por guarda estática, que `LIST_COLUMNS_SEM_TIMELINE` nunca volte a conter `timeline_json`.

## Testes atualizados (mudança intencional, não "conserto de teste")

- `v1017` — as âncoras de cache dos cenários viraram v3 (com `marca`), e ganhou o cenário novo:
  linha tocada depois do cache (marca diferente) recalcula. O que ele protege — cache válido é
  usado, invalida por tamanho e por dia — continua idêntico.
- `v1016` — apontava para o texto exato `messageCount: timeline.length`; o total agora sai de
  `messageCountTotal` (que É `timeline.length` quando a conversa está em mãos). A proteção
  (messageCount histórico completo continua existindo pro ranking) continua.

## Arquivos

- Alterados: `api/_persistence.js` (colunas, cache v3, segunda consulta, montagem da resposta),
  `ESTADO-ATUAL.md` (pendência nº 1 marcada como resolvida), `tests/v1016`, `tests/v1017`.
- Novo: `tests/v1136-listagem-nao-traz-conversa-inteira.test.mjs`.

## Conferido

- Suíte completa: **309 testes verdes**.
- A publicação (`npm run build`) gerada sem erro; nada muda no que aparece na tela — os números são
  os mesmos, calculados do mesmo jeito, só que sem retrafegar a conversa inteira a cada carga.
