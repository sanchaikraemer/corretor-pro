# v909 — "Atualizado em…" ao lado dos indicadores + "Última atualização" no lead

Feito a pedido do dono (itens 8 e 9 da fila).

## Item 8 — "Atualizado em…" na mesma linha
No card de prioridade, o "Atualizado em DD/MM HH:MM" ficava numa linha própria abaixo dos
indicadores. Agora ele fica **na mesma linha** de "de contato / sem resposta", empurrado pra
**direita** (`margin-left:auto`), como o dono desenhou.

## Item 9 — metalinha "Última atualização" no lead
No detalhe do lead, além de "Última análise / Última mensagem / Último atendimento", agora aparece
**"Última atualização — DD/MM HH:MM"** (a partir do `updatedAt` do lead), quando houver. O fallback
"Sem data registrada" passou a considerar essa data também.

## Verificação
- `tests/v909-atualizado-em.test.mjs` (novo) confere as duas mudanças.
- Suíte inteira verde; `node --check` OK.

## Arquivos
- `app.js` (card de prioridade + metalinhas do lead), `tests/v909-atualizado-em.test.mjs` (novo),
  `NOTAS-v909.md`, versão **908 → 909**.

## Fila
Todos os itens acumulados foram entregues (1–13 + "Aguardando cliente"). Sem pendências abertas.
