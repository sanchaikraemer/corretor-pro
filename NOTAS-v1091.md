# NOTAS v1091 — Você escolhe em que dias atende (e o aviso parou de se repetir)

## O que o dono mandou

Um print de sábado com **três círculos vermelhos** em cima da mesma informação:

> *"Final de semana! Fila de 'Fazer agora' pausada — volta na segunda."*

Eram dois problemas diferentes no mesmo print.

## Problema 1 — a mesma frase em cinco lugares

A informação "hoje a fila está pausada" aparecia em **cinco** pontos do app, três deles na mesma
tela: na saudação, dentro do card "Fazer agora" (no lugar do número!), numa caixa embaixo da
lista, no subtítulo da lista aberta e no sino.

**Agora aparece uma vez.** Na Home, só a saudação explica. A caixa embaixo da lista sumiu (a
saudação está poucos centímetros acima, dizendo a mesma coisa) e o card "Fazer agora" voltou a
mostrar um **número** — 0 —, alinhado com os outros cards, em vez de uma palavra ocupando o lugar
dele. O subtítulo da lista e o sino continuam existindo, mas são outras telas, então não repetem
nada.

## Problema 2 — sábado não é dia de folga pra corretor

Sábado e domingo estavam **cravados no código** como dias sem fila. Isso veio de um pedido do
próprio dono lá atrás (versões 914/937), e estava escrito assim no código: *"o dono não trabalha
fila no fim de semana"*.

Só que sábado é dia de visita — é dos melhores dias do corretor de imóveis.

**Agora você escolhe.** No Cérebro, junto com a meta de atendimentos e o descanso pós-atendimento,
tem um campo novo: **"Dias em que você atende"**, com os sete dias da semana pra marcar.

Três cuidados que valem registrar:

- **Nada muda até você mexer.** Sem configurar, continua segunda a sexta — exatamente como era.
- **Não dá pra desmarcar tudo.** Se todos os dias forem desmarcados, o app volta ao padrão em vez
  de te deixar sem fila pra sempre sem você entender por quê.
- **A escolha vale nos dois aparelhos.** Fica salva junto com o resto do Cérebro, então o celular
  e o computador enxergam a mesma coisa.

### O texto passou a dizer o dia certo

Antes, todas as mensagens cravavam *"volta na segunda"*. Isso fica errado no instante em que você
marca sábado. Agora o app calcula e nomeia o **próximo dia em que você atende** — se você atende
sábado, no domingo ele diz "a fila volta segunda"; se você atende só de segunda a quinta, na sexta
ele diz "volta segunda". Sempre o dia certo.

## Testes

`npm test` verde, com o código de saída conferido. Teste novo
(`v1091-dias-de-atendimento-configuraveis`), que trava inclusive as três proteções acima e proíbe
que qualquer texto visível volte a cravar "volta na segunda" ou "final de semana".

Dois testes antigos precisaram de ajuste: o `v1010` (sino) travava as frases antigas palavra por
palavra — a intenção dele continua igual, só o texto mudou.

Conferido num navegador de verdade, num **sábado**: sem configurar, o app entende que hoje não tem
fila; ao marcar "Sáb" no Cérebro, hoje vira dia de atendimento na hora. As 9 telas navegam sem
erro, o campo novo cabe na largura do celular e sem rolagem lateral.
