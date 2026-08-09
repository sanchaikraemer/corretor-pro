# v1189 — desfazendo o erro da v1188: o app não tem como saber se o cliente "está sem resposta"

## O que aconteceu

A v1188 criou uma prioridade nova, "Cliente respondeu": quando a última fala da conversa era do
cliente, o app passava a cobrar resposta — furando inclusive o período de descanso depois de um
atendimento — e o gráfico da Home ganhou uma linha com esse nome.

O dono derrubou na hora, e o motivo é uma regra que ele já tinha dado antes (v1158, palavras
dele: *"retire isso e do código também, já te falei ontem que você não tem como saber, pois não
é integrado com o WhatsApp"*):

> O app não é integrado ao WhatsApp. O corretor **sempre** responde o cliente no WhatsApp, na
> hora. A mensagem do cliente só entra no app quando o corretor exporta a conversa e importa —
> e **nesse momento** o app já analisa e gera a resposta automaticamente. É o fluxo de sempre.

Ou seja: "a última fala é do cliente" dentro do app nunca significa "cliente esperando resposta".
Significa só que a conversa ainda não foi reimportada — o cliente provavelmente **já foi
respondido** no WhatsApp. A prioridade da v1188 cobrava o corretor por conversas já resolvidas:
exatamente o tipo de ruído que as versões v938/v1019/v1052 mataram (só o atendimento **marcado**
decide descanso e retomada).

## O que mudou nesta versão

- **A prioridade "Cliente respondeu" saiu inteira** — a categoria, o furo no descanso da fila
  do dia e a linha no gráfico da Home. O gráfico agora tem as quatro fatias que têm lastro:
  Fazer agora, Agenda, Aguardando cliente e Prospecção.
- **Saiu também toda a engrenagem por trás** (o detector e três funções que só serviam a ele),
  que estava no código sem uso desde versões antigas. Foi ela que enganou a v1188: código órfão
  parecendo "recurso perdido" — a mesma armadilha da v1186 com o painel de duplicados
  (NOTAS-v1187). Agora não tem mais o que "religar" por engano.
- **Nada além disso mudou.** O outro conserto da v1188 ficou: compromisso vencido continua
  aparecendo como "Venceu há N dias" com o aviso vermelho "Vencido", em vez de se disfarçar de
  "Hoje". E a fila do dia continua decidindo como o dono mandou: entra quem nunca foi atendido
  ou quem já passou do prazo de descanso — contado do atendimento marcado, e de mais nada.

## A regra, registrada pra não voltar

Ficou escrito no código, nos dois lugares onde a v1188 mexeu, por que essa ideia não pode
voltar — e um teste novo (`tests/v1189-cliente-respondeu-nao-existe.test.mjs`) trava as portas:
falha se alguém recriar a categoria, o detector ou o furo no descanso, e confere que o cliente
que falou por último dentro do descanso continua descansando.

## Verificação

- `npm test` — 356 verdes (o teste da v1188 ficou só com a parte do compromisso vencido; o da
  v1071 voltou ao formato anterior; o da v927 acompanhou o gráfico de 4 fatias).
- Conferido no navegador (app publicado, relógio congelado numa segunda-feira 10h, carteira de
  teste): o cliente que respondeu depois do atendimento **descansa** (não aparece em nenhuma
  cobrança), a legenda tem 4 linhas sem "Cliente respondeu", o "Venceu há 2 dias"/"Vencido"
  continua no lugar e a página carrega sem nenhum erro.
