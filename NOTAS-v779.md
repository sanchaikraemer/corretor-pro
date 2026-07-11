# v779 — Importação "não saía da preparação de carteira" (lista com cache velho)

## O problema (relatado pelo usuário, lead Elisandro Altman)

O corretor importou a mesma conversa 2x: os dados eram preenchidos, as 3 mensagens eram geradas, tudo certo na tela — mas o lead **não saía da lista de "Preparação da carteira"**, como se a importação não fosse salva.

## Causa

O cache de leads (`getLeadsData`) tem TTL de **5 minutos** (`LEADS_CACHE_TTL`). Logo antes de salvar, o app faz uma checagem de duplicidade que **força um fetch fresco** e reenche esse cache com o estado **de antes de salvar** (o lead ainda sem histórico/análise → "preparação").

Depois de salvar (`salvarLeadPendente`) ou atualizar (`atualizarLeadComEvolucao`), **nenhuma das duas funções invalidava o cache**. Então:

- A tela do lead abria certa (ela lê o detalhe fresco).
- Mas a **Carteira/Preparação** continuava lendo o snapshot velho por até 5 minutos → o lead recém-salvo seguia aparecendo em "preparação". Parecia que a importação não tinha sido salva.

## O que foi corrigido (`app.js`)

Em `salvarLeadPendente` e `atualizarLeadComEvolucao`, depois do sucesso:

- `invalidarLeadsCache()` — zera o cache de 5 min.
- `loadRecentLeads(true)` + `refreshAllSections()` — relê o banco e re-renderiza a tela ativa com o dado novo.

Assim o lead sai de "preparação" e entra em "Prontos" na hora, sem esperar o cache expirar.

## Observação (se o sintoma persistir em algum lead)

Se um lead específico continuar em "preparação" mesmo depois desta correção, o caso provável é de **identidade dividida**: um registro-esboço (vindo da planilha, sem histórico) e o registro analisado da conversa ficam com chaves de deduplicação diferentes (um com `oportunidadeId`, o outro só com o nome), então aparecem como cards separados — o analisado fica em "Prontos" e o esboço não some da preparação. Isso é um passo seguinte, dependente de olhar os dados reais do lead.

## Testes

- `npm test` e `npm run build` passaram.
- Falta validar em produção: reimportar o Elisandro Altman e confirmar que, ao salvar/atualizar, ele sai da preparação na hora.
