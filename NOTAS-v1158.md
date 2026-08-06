# v1158 — saiu da fila o palpite "o cliente está esperando sua resposta"

Ordem do dono, revisando a régua do "Fazer agora" item por item:

> "+30 se ele falou por último e está esperando resposta" — **retire isso e do código também**, já te
> falei ontem que você não tem como saber, pois não é integrado com o WhatsApp.

Ele está certo. O app lê um **retrato** da conversa (o arquivo exportado do WhatsApp), não o WhatsApp
ao vivo. Se o corretor respondeu o cliente depois de exportar, o app continuava achando que a bola
estava com ele — e empurrava esse cliente pro topo da fila por um palpite que não tem como conferir.

## O que mudou

Em `cpProbabilidadeFechamento` (a nota que ordena o "Fazer agora") saiu o bônus de **+30** e tudo o
que existia só pra alimentá-lo (`clienteEsperaVoce`, o uso de `daysSinceLastTouch` e a consulta a
`ultimaMsgClientePedeResposta` dentro do ranking).

A nota que ordena a fila passa a ser só o que dá pra provar pelo que foi importado:

| Fator | Peso |
| --- | --- |
| Dias em que o cliente escreveu (últimos 90 dias, até 20) | +8 cada |
| Perguntas que ele fez (últimos 90, até 20) | +6 cada |
| Já falaram de valor/entrada/condição | +35 |
| Proposta ou contraproposta em aberto | +35 |
| Volume de mensagens dele (até 30) | +1 cada |
| Dias desde o último atendimento marcado (teto 90) | −2 cada |

## O que NÃO mudou

A checagem "a última fala do cliente pede resposta?" (`ultimaMsgClientePedeResposta`) continua viva
onde tem lastro:

- nas regras de **quem entra** na fila (`entraEmRetomada`, `emJanelaDeEspera`) — ali ela evita que um
  "Ok" do cliente derrube o prazo de espera antes da hora;
- na etiqueta **"Cliente aguardando"** do cartão do cliente.

Ou seja: o app pode continuar dizendo "pelo que você importou, o cliente falou por último" — o que
ele não faz mais é **mudar a ordem da fila** por causa disso.

## Arquivos

- `app.js` — `cpProbabilidadeFechamento` sem o bônus.
- `tests/v944-despedida-nao-conta-como-cliente-esperando.test.mjs` — reescrito: agora trava o bônus
  FORA da ordem (inclusive rodando a função: mudar quem falou por último não muda mais a nota) e a
  checagem da despedida DENTRO das regras de entrada.

## Conferência

- `npm test`: 24 arquivos + **325 testes**, verdes.
- Chromium headless: app abre e monta a Home sem erro de JS.
