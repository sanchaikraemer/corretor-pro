# v1162 — o reaproveitamento aparece DURANTE o progresso da importação

Pedido do dono, sobre o quadro verde "Atualização incremental" que só existia no fim:

> "Essa informação aparece tão rápido quando termina os 100% e muda tão rápido para o lead que não
> dá nem pra perceber. Por que não vai informando isso no decorrer da análise, de 0% até 100%?"

Tem razão: o quadro do fim fica visível por menos de um segundo (o cliente abre logo em seguida).
Agora cada etapa do progresso conta o reaproveitamento **na hora em que ele acontece**:

| Etapa | O que passa a dizer |
| --- | --- |
| Abrindo o arquivo (2) | "**cliente já conhecido** — 143 mensagens já salvas serão comparadas" (ou "cliente novo nesta carteira") |
| Ouvindo os áudios (3) | "3/14 novos · **11 reaproveitados**" (já existia desde a v1027) |
| Analisando (4) | "comparando com a conversa já salva — **só a novidade paga análise**" |
| Salvando (5) | "**nada novo: análise salva mantida, nada pago**" ou "5 mensagens novas — análise refeita" |
| Concluído (6) | "lead atualizado · **nada novo: análise mantida, nada pago**" — persiste até o cliente abrir |

Caso raro dito com honestidade: reimportação com zero mensagem nova mas análise salva incompleta →
"sem mensagem nova; análise refeita (a salva estava incompleta)".

O quadro verde do resultado continua existindo (é a prova por print quando algo parecer errado) —
só que ninguém mais depende de ler algo que some.

## Arquivos

- `app.js` — textos novos nas etapas 2, 4, 5 e 6 do progresso (`processarStorageEmEtapas` /
  `atualizarLeadExistente`), lendo `leadAnterior` (resposta do preparar) e `incrementalMeta`
  (resposta da análise).
- `tests/v1162-reaproveitamento-aparece-no-progresso.test.mjs` — novo.

## Conferência

- `npm test`: 24 arquivos + **328 testes**, verdes.
- Chromium headless (390×844): a **tela cheia** da importação foi dirigida com os três textos novos
  (etapas 2, 4 e 6) — todos visíveis, dentro da tela, sem erro de JS.
