# v940 — "Últimas mensagens" cortava o texto no meio da frase

## O bug (achado pelo dono comparando com o WhatsApp real)

Uma mensagem que o corretor mandou pra Aline aparecia CORTADA em "Últimas mensagens" (o
histórico completo do lead): "...transferir o financiamento para outro comprador recebendo" —
e parava aí. No WhatsApp real, a mensagem continuava: "...o que pagou nele até então, e isso
daria como entrada em outro e financiaria saldo. Outra opção com 2 dormitórios é no Evolutti...
Para entender melhor e sugerir outras opções, me diz mais ou menos o valor pago...".

## Causa raiz

`cp704TimelineHtml` (`app.js`), a função que renderiza cada mensagem em "Últimas mensagens",
cortava o texto em `.slice(0,520)` — sem "...", sem indicação nenhuma de que faltava
conteúdo. Mensagens de negociação de imóvel (explicando condições de pagamento, permuta,
comparando opções) frequentemente passam de 520 caracteres. Essa view existe justamente pra
mostrar a conversa REAL — cortar o texto contradiz o propósito dela. ("Copiar histórico", ao
lado, nunca teve esse problema: sempre copiou o texto inteiro.)

## O que mudou

Removido o `.slice(0,520)` — a mensagem é renderizada por completo em "Últimas mensagens",
igual já acontecia em "Copiar histórico".

## Verificação

- `tests/v940-timeline-sem-corte-de-mensagem.test.mjs` (novo): confirma que o corte de 520
  caracteres não existe mais e que a mensagem é renderizada por completo.
- Suíte inteira verde (`npm test`); `node build.js` OK, versão 940.

## Arquivos
- `app.js` (`cp704TimelineHtml`), `tests/v940-timeline-sem-corte-de-mensagem.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v940.md`, versão **939 → 940**.
