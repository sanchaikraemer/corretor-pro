# v1319 — a barra parava nos 88% e parecia travada

*"quando chega em 88% trava e demora para seguir (em todas analises e reanalises), mesmo estando
com o histórico 100% igual"* (dono, 20/08/2026, com print).

## Não travava nada

A barra tinha **cinco frases fixas**, uma a cada 1,8 segundo. Em **nove segundos** ela acabava as
frases, sentava nos 88% e ficava lá parada até a IA responder — mais **30 a 60 segundos** de tela
imóvel. Quem olhava via um app travado; o app estava trabalhando.

Pior: as frases **mentiam sobre o momento**. Aos 72% dizia "Gravando análise no banco" e aos 88%
"Conferindo se ficou salvo" — quando na verdade o pedido nem tinha voltado da IA ainda. Se algo
desse errado ali, o corretor procuraria o problema no lugar errado.

## O que mudou

As frases passam a contar o que realmente está acontecendo:

- "Enviando a conversa e o seu Cérebro pra IA..."
- "A IA está lendo a conversa inteira, do começo ao fim..."
- **"A IA está escrevendo a leitura e as três sugestões — costuma levar de 30 a 60 segundos."**

E, depois da última frase, a barra **continua andando sozinha**, devagar, até 85%. Nunca mais fica
parada num número. Os 90% ("Resposta recebida. Gravando e conferindo se ficou salvo...") e os 100%
continuam vindo do código de verdade, quando a resposta chega e quando a gravação é conferida.

## Verificação na tela

Aberto no Chromium, com a barra rodando de verdade: **120 leituras, nenhuma parada nos 88%**, a
barra sobe continuamente e o texto avisa quanto tempo a espera costuma durar.

## Testes

`tests/v1319-barra-de-progresso-nao-trava.test.mjs`: as frases mentirosas não podem voltar, a
subida lenta existe, os avisos de gravação só aparecem depois da resposta, e uma simulação de 90
segundos de espera conferindo que nenhum número fica parado por mais de 6 segundos.

`npm test`: 30 arquivos checados + 463 testes, verdes.
