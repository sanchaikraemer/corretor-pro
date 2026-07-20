# v882 — "parado Nd" e "Oportunidades esquecidas" respeitam o atendimento

## O problema (print do corretor)

O corretor **acabou de atender a Sara** (marcou o atendimento dentro do lead —
"Último atendimento — 20/07/2026 11:05"), mas na home ela continuava:

- listada em **"Oportunidades esquecidas"** com **"parado 144d"**;
- apontada no **Raio-X da carteira** como **"Parada de maior valor: Sara — parado há 144d"**;
- somada na contagem do Raio-X ("N clientes já visitaram e sumiram").

## A causa

Toda a noção de "parado Nd" da home vinha **só da idade da última mensagem do WhatsApp**
(`daysSinceClientReply` / `daysSinceLastInteraction`). A última mensagem da Sara é de
04/06 (144 dias), então mesmo depois de um atendimento manual feito HOJE ela continuava
"parada 144d". O `leadsEsquecidos`, o `radarRowHTML` e o `insightFocoHTML` (Raio-X) nunca
olhavam o último **atendimento** — só a mensagem.

## A correção

Novo helper `diasParado(l)`: dias desde o **último toque real** na negociação, considerando
o maior entre a idade da última mensagem e o **último atendimento manual**
(`ultimoAtendimentoTs`, que já unifica evento de "Marcar atendimento", itens manuais da
timeline e os campos históricos `lastAttendanceAt`/`ultimoAtendimentoEm`).

Com isso, um lead atendido hoje tem `parado = 0` e:

- **sai** de "Oportunidades esquecidas" (o corte é `parado >= 7`);
- **sai** da contagem do Raio-X (gargalo usa `parado >= 5`);
- deixa de ser a "Parada de maior valor";
- mostra "parado hoje" em vez de "144d" onde o rótulo aparecer.

Um atendimento **antigo** não mascara um lead que voltou a esfriar: `diasParado` pega
sempre o toque **mais recente** (mensagem ou atendimento), então se a mensagem é mais nova
que o atendimento, vale a mensagem.

## Arquivos

- `app.js` — novo `diasParado(l)`; `leadsEsquecidos`, `radarRowHTML` e `insightFocoHTML`
  (gargalo + "parada de maior valor") passam a usar `diasParado`.
- `tests/v882-parado-considera-atendimento.test.mjs` — executa `diasParado` de verdade
  (Sara atendida hoje = 0, sem atendimento = idade da mensagem, atendimento antigo não
  mascara, sem dado = Infinity) e trava o uso em `leadsEsquecidos`/`radarRowHTML`.
- `package.json` — versão 881 → 882.

## Ainda em aberto (discussão com o dono, fora desta correção)

- Card **"Fazer agora" sempre em 0**: para uma carteira de imports antigos, quase nada cai
  no bucket "precisa de resposta agora" — a ação real do dia é **retomar as oportunidades
  esquecidas**. Decidir entre remover o card ou repropô-lo para contar as retomadas.
- **Raio-X sem clique**: as linhas mostram números ("37 clientes...", "13 conversas
  longas...", "Parada de maior valor: Sara") mas não abrem a lista de quem são. Falta
  drill-down.
