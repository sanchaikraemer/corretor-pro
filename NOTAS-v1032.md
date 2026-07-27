# NOTAS v1032 — ditado por voz duplicando as palavras em cascata

## O relato

Print do "Registrar observação": o ditado por voz (o botão de gravar áudio que vai escrevendo o
texto sozinho enquanto o corretor fala) começou a repetir tudo em cascata — "vamos vamos Vamos
Vamos Vamos retomar Vamos retomar Vamos retomar Vamos retomar informando Vamos retomar
informando...".

## O que estava acontecendo

O reconhecimento de fala do navegador (usado no ditado desde a v1026) tem um bug conhecido em
vários celulares Android: de tempos em tempos, ele reenvia um trecho que JÁ tinha mandado como
"texto confirmado" antes, como se fosse novidade. O código (desde a v1026/v1028) tratava cada
aviso do navegador somando o texto confirmado daquele momento em cima do que já tinha escrito —
então, quando o navegador reenviava um trecho repetido, esse trecho entrava DE NOVO, ficando cada
vez mais comprido e repetitivo a cada nova palavra dita.

## O que mudou

Agora cada trecho confirmado é guardado no lugar exato que o navegador indicou (a posição dele na
fala), em vez de simplesmente ir "somando texto". Se o navegador reenviar um trecho repetido, ele
só substitui o que já estava guardado naquele lugar — sem duplicar. A fala continua aparecendo em
tempo real normalmente, e reiniciar sozinho por causa de silêncio (comportamento da v1028)
continua funcionando igual, sem perder nem repetir nada do que já tinha sido dito.

## Testes novos

`tests/v1032-ditado-nao-duplica-resultado-reenviado.test.mjs` — simula exatamente o
comportamento do navegador com defeito (reenviando trechos já confirmados) e confirma que o texto
não duplica, inclusive atravessando um reinício automático por silêncio. Conferido também que esse
teste falha de propósito contra o código de antes desta correção (prova de que o teste realmente
cobre o bug relatado).

## `npm test`

Suíte inteira verde.
