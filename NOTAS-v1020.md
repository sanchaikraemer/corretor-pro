# NOTAS v1020 — "Copiar mensagem" tenta de novo antes de desistir de marcar o atendimento

## O relato

Depois da v1019, o dono confirmou que sempre marca atendimento **dentro do Corretor Pro**, na
maioria das vezes copiando a mensagem sugerida (ação que já marca atendimento automaticamente).
Mesmo assim, alguns leads continuavam voltando a aparecer como se nunca tivessem sido atendidos.

## Causa

Copiar a mensagem sugerida faz duas coisas ao mesmo tempo: (1) mostra "Mensagem copiada" e marca
como atendido NA TELA na hora (pra não travar o corretor esperando rede), e (2) manda pro servidor
gravar esse atendimento de verdade. Essas duas coisas eram independentes — se o passo (2) falhasse
(instabilidade de internet, demora do servidor), o erro era simplesmente ignorado, sem avisar
ninguém. Resultado: a tela mostrava tudo certo na hora, mas o atendimento nunca tinha sido
realmente salvo — e o lead voltava a aparecer depois como se nunca tivesse sido atendido, sem
nenhum aviso de que algo tinha falhado.

## Correção

Ao copiar uma mensagem sugerida, o sistema agora **tenta salvar o atendimento de novo** se a
primeira tentativa falhar, antes de desistir. Se mesmo assim não conseguir das duas vezes, avisa
na hora: "Mensagem copiada, mas não consegui confirmar o atendimento agora" — em vez de deixar o
corretor sem saber que precisa marcar manualmente.

**Isso não resolve 100% dos casos** (uma internet realmente fora do ar nas duas tentativas ainda
pode falhar) — mas agora, quando falhar, o corretor SABE na hora e pode marcar manualmente, em
vez de descobrir dias depois que o lead "voltou do nada".

## Teste novo

`tests/v1020-registrar-atendimento-da-copia-tenta-de-novo.test.mjs` — confirma que a gravação do
atendimento é tentada pelo menos duas vezes, e que existe aviso pro corretor quando as duas
tentativas falham.

## `npm test`

Suíte inteira verde.
