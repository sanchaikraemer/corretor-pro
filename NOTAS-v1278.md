# v1278 — a fila do dia vem listada abaixo, no lugar do "Atender mais um"

Dono, 14/08/2026, com print da tela Hoje (26 atendidos, meta batida):

> "esse atender mais um... quero listagem abaixo"

## O problema

Com a meta do dia batida, a tela Hoje mostrava a frase de parabéns, um botão **"Atender mais um"**
e **meia tela em branco embaixo**. Cada clique no botão revelava **um** cliente. Para escolher
quem atender em seguida — ou só pra ver quem ainda estava na fila — ele tinha que clicar, olhar,
clicar de novo, um por um. No dia normal era a mesma coisa: abaixo dos clientes do dia aparecia só
o botão "Atender mais um · N na fila", sem mostrar quem eram esses N.

## O que mudou

**A fila aparece listada logo abaixo, no mesmo formato da lista dos clientes do dia** — nome,
empreendimento, barra de mensagens e "há Xd" —, com o título **"Na fila · N clientes · por
prioridade"**. É só tocar em quem ele quiser atender, na ordem que quiser.

Vale nos dois casos:

- **Meta do dia batida** (o print dele): a frase vira "Você já atendeu 26 hoje. 👏 Quer seguir? É
  só escolher na lista abaixo." e, embaixo, a fila inteira listada.
- **Dia normal**: primeiro os clientes do dia (como sempre foi, sem mudar nada) e, embaixo, o
  restante da fila.

A lista abre **20 clientes por vez**, com um botão embaixo — "Mostrar mais 20 · faltam 25" — que
abre o próximo bloco. É o único jeito de a tela não nascer com 100 linhas no celular e continuar
rápida; o botão diz sempre quantos ainda faltam, então dá pra ir até o fim da fila em poucos
toques (não mais de um em um).

O botão **"Atender +1"** que existe dentro da lista do card "Fazer agora" (a outra tela, aberta
pelo quadradinho) **não foi mexido** — continua funcionando como antes.

## Verificação

- Suíte completa verde (`npm test`): 23 arquivos checados + 433 testes.
- Teste novo: `tests/v1278-fila-listada-abaixo-na-home.test.mjs` — roda o trecho real que monta a
  tela Hoje com uma fila de 45 clientes e confere que a fila é listada nos dois casos, que ela vem
  de 20 em 20, que o botão informa quantos faltam, que ele some quando a fila acaba e que o botão
  antigo de "um por clique" não pode voltar.
- Testes antigos que travavam o botão antigo (v925, v926) atualizados pra travar o comportamento
  novo; `tests/v1203` ajustado só porque o trecho extraído da tela ganhou a lista da fila.
- Conferência visual (Chromium sem janela, app publicado): celular (412×915) e computador
  (1440×900), nos dois casos. Sem rolagem lateral, sem número da barra por cima do empreendimento
  (o problema da v1021), título e lista alinhados, 20 linhas + botão em cada bloco.
