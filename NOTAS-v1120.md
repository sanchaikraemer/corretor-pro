# v1120 — contadores de limite à prova de disparo simultâneo (atômicos)

## O problema (auditoria)

O app conta o uso de análises lendo o valor atual, somando 1 e gravando de volta. Se **duas
análises disparam no mesmíssimo instante** (corretor clica rápido, ou algo que rode em paralelo),
as duas leem o mesmo valor e ambas passam — o teto do plano escapa por 1 ou 2. Não é rombo, é uma
folga mínima, mas sob concorrência real ela cresce com o paralelismo.

## A correção

Duas partes, feitas juntas:

1. **No banco (migração `0012`)** — duas funções que fazem "checar + somar" numa transação só, com
   trava (advisory lock) por empresa: cliques simultâneos para a mesma conta são **serializados**,
   então o teto fica exato. `reservar_analise_ia` cobre o contador de análises (dia + mês juntos,
   respeitando os dois tetos). `reservar_contador_dia` é genérica (fica pronta pra uma faxina futura
   ligar voz/diagnóstico/transcrição).

2. **No app** — `verificarLimiteAnalises` passa a **reservar de forma atômica** via
   `reservar_analise_ia`. Se a função não existir no banco (0012 ainda não aplicada) **ou** der
   qualquer erro, o app **volta sozinho pro jeito antigo** (lê/decide/grava) — exatamente como
   funcionava até a v1119. Ou seja: nunca bloqueia análise real, e a ordem de publicação (código
   antes ou depois da migração) não quebra nada.

## Passo manual do dono (banco)

Aplicar `supabase/migrations/0012_contadores_atomicos.sql` no SQL Editor do Supabase (é aditiva: só
cria funções, não mexe em dado nem tabela). Enquanto não aplicar, o contador segue funcionando como
na v1119 (o app usa o caminho antigo automaticamente).

## Teste de regressão

`tests/v1120-contador-atomico.test.mjs` — sobe um Supabase de mentira que responde à função nova e
prova os dois caminhos: (a) quando a função existe, o app usa a resposta dela e **não** faz a
gravação antiga; (b) quando a função não existe (404), o app cai no jeito antigo e ainda decide
certo. Os testes de limite anteriores (`v1013`, `v1041`, `v1110`) seguem verdes — o caminho antigo
não mudou de comportamento.
