# NOTAS v1087 — Por que a PRIMEIRA abertura do dia demorava (o print das 00:06)

## O que o dono relatou

Print às **00:06** com *"Carregamento demorou mais que o normal"* — e, logo depois:

> *"depois abriu, e rodou normal a análise toda da importação"*

Esse "depois funcionou" é a pista que fecha o diagnóstico.

## A causa: à meia-noite, a conta de TODOS os clientes vence de uma vez

Pra não percorrer a conversa inteira de cada cliente a cada abertura, o sistema guarda um
resuminho de contas por lead (quantas mensagens, há quantos dias, etc.). Esse resuminho vale
**por dia** — precisa mesmo envelhecer, porque vários números dependem da data de hoje.

O efeito colateral é que, **na virada da meia-noite, ele vence para a carteira inteira ao mesmo
tempo**. Na primeira abertura do dia, então, o servidor:

1. recalcula o resuminho de todos os clientes; **e**
2. **espera até 500 gravações no banco** — uma por cliente, cada uma regravando a análise inteira
   dele — **antes de responder**.

O aviso na tela aparece aos **9 segundos**, mas a busca só desiste aos 15. Por isso o dono viu a
mensagem e, poucos segundos depois, o app abriu sozinho e funcionou normalmente: a primeira
abertura pagou a conta do dia inteiro, e a partir dali tudo estava rápido de novo.

Ou seja: **acontecia todo dia**, na primeira abertura — só que era raro alguém abrir o app tão
perto da meia-noite pra perceber.

## A correção

Aquelas gravações **não têm nada a ver com a resposta**: os números já foram calculados e já estão
prontos pra mandar pra tela. Fazer o corretor esperar por elas era desperdício puro.

Elas passaram a ter um **orçamento de tempo de 1,5 segundo**. O que couber é gravado; o que não
couber fica pra próxima abertura, que recalcula e tenta de novo. Em poucas aberturas tudo está
gravado — e **nenhuma abertura paga mais que isso**.

Medido no teste: com uma carteira grande e banco lento, antes seriam ~3 segundos só esperando
gravação; agora corta em 1,5s e devolve a tela.

## Também nesta versão: mais um teste que quebrava sozinho

`v1024` injetava a função real de "é fim de semana" pra testar **ordenação de fila**. Como a fila
do "Fazer agora" é pausada no fim de semana, o teste passava a receber uma lista vazia e quebrava
**todo sábado e domingo** — sem nada ter mudado no código. Foi exatamente o que aconteceu hoje
(01/08/2026, sábado).

É o segundo caso do mesmo tipo em dois dias (o outro foi na v1082, um teste que quebrava em dia
31). Ambos deixavam o ✓ do CI vermelho sem motivo real, o que é pior do que parece: com o CI
vermelho "de mentira", uma quebra de verdade passa despercebida.

## Testes

`npm test` verde, com o código de saída conferido. Teste novo
(`v1087-primeira-abertura-do-dia-nao-trava`) que **mede o tempo de verdade**: simula 500 clientes
com o cache vencido e um banco lento, e exige que a gravação respeite o orçamento e não segure a
resposta.

Verificado no navegador (celular e computador): as 9 telas navegam sem erro e sem rolagem lateral.

## O que NÃO foi mexido

A pedido do dono ("não vamos voltar atrás não"), a v1086 foi mantida inteira. Esta versão só
acrescenta a correção da primeira abertura do dia.
