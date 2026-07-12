# Atualização #794 — Retomada alinhada aos 5 dias

## Ajuste

- O marco de tempo das sugestões de mensagem passa a bater com o resto do sistema, que já trabalha com **5 dias** (proteção de atendido e reaquecimento começam aos 5 dias).
- Regra atual:
  - **menos de 5 dias** (e qualquer intervalo que seja só um fim de semana): continuação natural, sem desculpa e sem "faz tempo que não nos falamos";
  - **a partir de ~5 dias parado**: entra em modo **retomada** — reabre o último assunto/pendência e propõe o próximo passo, sem soar genérico;
  - retomada **não é** pedir desculpa: só pede desculpa se o corretor tinha prometido um retorno e realmente não cumpriu;
  - se o retorno combinado é para um dia que ainda não chegou, o corretor está no prazo — nunca pede desculpa.
- A IA continua recebendo a data com o dia da semana (fuso de Brasília) para julgar o intervalo corretamente.

## Compatibilidade

- Só afeta o texto das 3 sugestões de mensagem. Diagnóstico, importação, agenda, propostas e Supabase inalterados.
- Vale para importação e reanálise.
