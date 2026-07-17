# v868 — resumo de Atendimentos dia a dia (7 dias)

## Mudança

No painel "Meta do dia" da tela de Atendimentos, o resumo por período (Hoje / Ontem /
2 dias / 3+ dias) virou um **resumo dia a dia dos últimos 7 dias**, a pedido do dono
("quero dia a dia, todos os dias da semana, não só um").

- Lista os 7 dias mais recentes, do mais novo pro mais antigo.
- Rótulos: **Hoje**, **Ontem** e, para os demais, **dia da semana + data** (ex.: `Ter 15/07`).
- Cada linha mostra a contagem real de atendimentos registrados naquele dia.
- O prédio ("Meta do dia") continua usando o total de **hoje** (`perDay[0].n`) contra a meta 10.

Só `app.js` (a lógica do `cp788RenderAtendimentos`). O CSS do painel (`.cp788-meta-breakdown`
/ `.cp788-bd-row`) já comportava as 7 linhas.

## Verificação

- `tests/v867-predio-atendimentos` atualizado: confere que o resumo cobre os 7 dias
  (`for(let i=0;i<7;i++)`), usa os nomes dos dias da semana e mantém os rótulos Hoje/Ontem.
- `npm test`: suíte completa verde.
- Prévia renderizada confirmando as 7 linhas no painel.
