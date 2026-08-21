# v1336 — o lembrete diário chega na hora que VOCÊ escolher

## De onde veio

Print do dono, 20/08/2026, com a notificação do app na tela do celular:

> "outra coisa, recebi agora essa msg em anexo, isso ta programado pra essa hora?"

Não estava programado pra hora nenhuma. O aviso saía quando o celular resolvia acordar o app em
segundo plano — podia ser de manhã, podia ser à noite. O único freio era "no máximo um aviso a cada
20 horas", que controla a frequência, não o horário.

## O que mudou na tela

Em **Mais → Lembrete diário** apareceu um seletor: **"Chegar por volta das"**, das 05h às 21h. O
padrão é 08h.

O aviso só sai dentro da janela que você escolheu: da hora escolhida até 4 horas depois. Se o
celular não acordar o app nesse intervalo naquele dia, o aviso daquele dia não sai — melhor do que
tocar às 3h da manhã.

## Por baixo

- a hora escolhida fica guardada no mesmo lugar onde já mora o retrato das ações do dia (o único
  lugar que o app consegue ler com o aplicativo fechado);
- o pedido de "acorde o app" passou de uma vez a cada 20h para uma vez a cada 4h. Não é aviso mais
  frequente: quem garante "no máximo um por dia" continua sendo a trava de 20 horas entre avisos,
  que fica do lado que não depende do humor do celular. Acordar mais vezes só aumenta a chance de o
  app estar acordado dentro da janela que você escolheu;
- a janela atravessa a meia-noite sem quebrar (escolher 22h vale até as 2h).

## Conferido na tela

Aberto no Chromium, no tamanho de celular (390px) e de computador (1280px): o seletor aparece na
mesma linha do texto, com as 17 opções, marcando 08h, sem estourar a largura do cartão.
