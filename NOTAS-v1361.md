# v1361 — só sobe o que é novo

Você separou duas coisas que eu tinha misturado, e estava certo:

- **A análise** tem que ser sobre o **histórico inteiro**. Continua sendo — a conversa vai completa
  pra inteligência, e o que já estava salvo é comparado com o que chegou. Nada disso mudou.
- **O envio** não. Mandar de novo, toda vez, os áudios que o servidor **já transformou em texto** é
  desperdício puro.

## O que estava acontecendo

O servidor já reaproveitava a transcrição desde muito tempo — mas só **depois** que o arquivo
inteiro tinha subido do seu celular. Ou seja: você pagava o envio de todos os áudios, toda vez, pra
o servidor descobrir do outro lado que já tinha o texto deles guardado.

Numa conversa de meses são dezenas de MB subindo à toa. É uma das partes grandes da demora.

## O que mudou

Antes de montar o envio, o celular **pergunta ao servidor** o que ele já tem em texto daquela
conversa. Esses áudios ficam de fora. Sobe o texto (sempre inteiro) e só os áudios novos.

Na tela de preparo você vai ver, por exemplo:

> ZIP preparado: 42,0 MB → 3,1 MB · 38 áudios já salvos não subiram de novo

Numa medição aqui: conversa com 10 áudios, 7 já salvos → o envio caiu de **9 MB para 2,7 MB**.

## Redes de segurança

- Se a pergunta falhar (sem internet, servidor lento), **sobe tudo como antes**. Nunca trava a
  importação por causa disso.
- Se o nome não bater exatamente, o áudio sobe — melhor mandar de novo do que perder.
- **Nenhuma mensagem se perde:** o que já estava salvo continua salvo, e a conversa que chega agora
  é comparada com ela, como sempre.
