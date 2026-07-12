# Atualização #793 — Fim de semana não é "demora"

## Correção

- As sugestões de mensagem deixam de **pedir desculpa por demora** quando o intervalo é curto. Antes, um fim de semana (ex.: sexta no fim do dia → domingo) já fazia a IA escrever "desculpa a demora" / "faz tempo que não nos falamos".
- Nova regra clara para a IA:
  - até ~5 dias corridos, e qualquer intervalo que seja só um fim de semana, é normal — sem desculpas, escreve como continuação natural;
  - só reconhece a demora, de leve, a partir de ~1 semana (7+ dias);
  - se o corretor combinou retornar num dia que **ainda não chegou**, ele está no prazo/adiantado — nunca pede desculpa.
- A IA agora recebe a **data com o dia da semana** (no fuso de Brasília), para julgar corretamente se o intervalo é só um fim de semana.

## Compatibilidade

- Só afeta o texto das 3 sugestões de mensagem. Diagnóstico, importação, agenda, propostas e Supabase inalterados.
- Vale para importação e reanálise (mesmo ponto de geração).
