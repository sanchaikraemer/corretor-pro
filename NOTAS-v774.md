# v774 — Mensagens sugeridas ignoravam o tempo parado desde a última troca

## O problema (relatado pelo usuário com o lead da Simoni)

O corretor prometeu "vou pensar em algo e aviso" em 02/06/2026. O card do lead mostrava "O retorno combinado está vencido há 39 dia(s)", mas as três sugestões de mensagem ("Recomendada", "Alternativa", "Direta ao ponto") liam como se fossem uma continuação imediata da conversa — nenhuma reconhecia que haviam se passado quase 40 dias em silêncio.

## Causa

O prompt de geração de mensagens (`api/_pipeline.js`) já recebe a `Data atual` e a conversa inteira com timestamps, mas não instruía o modelo a comparar essas datas nem a ajustar o tom da mensagem quando há um hiato — por isso ele nunca "sabia" que precisava retomar o assunto em vez de simplesmente continuar de onde parou.

## O que foi corrigido

Adicionada instrução explícita no prompt: antes de escrever as três mensagens, o modelo deve comparar a data da última mensagem da conversa com a data atual e, havendo um hiato relevante (principalmente quando o corretor tinha prometido retornar e não retornou), as três sugestões precisam reconhecer a demora de forma natural antes de retomar o assunto — não podem soar como se tivessem sido escritas no mesmo dia da última troca.

## Testes

- `npm test` e `npm run build` passaram.
- Validar reanalisando o lead da Simoni em produção e conferindo que as 3 sugestões passam a reconhecer os ~40 dias de silêncio antes de retomar a proposta.
