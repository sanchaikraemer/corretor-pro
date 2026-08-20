# v1332 — a conferência que estava morta, a análise em duas etapas ligada, e o número que mentia

Três prints do dono em 20/08/2026, todos da mesma noite, e a mesma frase: *"que bosta de sugestões
são essas?"*, *"que monte de msg vermelha de erro são essas"*, *"tu tem noção do quanto isso é
ridículo"*. Esta versão responde aos três.

## 1. A conferência das três sugestões voltou a existir

`fatosInventadosNaMensagem` está no projeto desde a v1305 e **estava sem um único chamador desde a
v1315** — ela saiu junto com a rede que reescrevia o texto da IA, e ninguém percebeu que a
CONFERÊNCIA tinha morrido junto. Resultado, numa cliente que nunca tinha falado de um determinado
empreendimento: *"você tinha me pedido a metragem e os valores do [empreendimento] no início"* — a
IA afirmando que a CLIENTE pediu algo que ela nunca pediu, com nome vindo de outra conversa.

Agora, depois que a IA devolve as três, o app confere cada uma contra **a conversa daquele cliente
+ as observações + o Cérebro** e aponta:

- **nome, lugar ou endereço que não está em lugar nenhum** — o caso acima;
- **abertura cobrando tempo** ("faz 9 dias que te mandei o vídeo"): reconhecer o intervalo é o piso,
  numerar os dias na primeira linha é cobrança;
- **duas das três pedindo a mesma coisa** — comparando só as palavras que decidem uma venda na
  última pergunta de cada uma (duas perguntavam o teto de investimento com outras palavras);
- **promessa sem pergunta** ("vou te enviar as informações" e ponto final).

O aviso aparece colado na sugestão, curto: *"Confira antes de enviar: cita 'X', que não aparece
nesta conversa"*. **Nada é reescrito e nada é pedido de volta pra IA** — as duas regras da v1315
continuam de pé. Sugestão boa não recebe aviso nenhum (senão o aviso vira ruído).

## 2. A análise em duas etapas foi LIGADA

Entrou desligada na v1331, esperando medição. No mesmo dia o dono viu na tela invenção de fato,
abertura cobrando dias e duas sugestões iguais — o estado medido (156 de 191 pontos) já era ruim, e
esperar a medição virou desculpa pra não mexer. A partir de agora o padrão é: **a IA entende
primeiro e escreve depois**, em duas chamadas, cada uma com uma tarefa só.

Se piorar, desligar é imediato e sem publicar código: `DIRECIONA_ANALISE_ETAPAS=1` na hospedagem.
A comparação com os 156/191 continua devendo — o botão "Medir agora" do painel roda quando quiserem.

## 3. As duas tarjas vermelhas pararam de gritar

Na mesma tela apareciam dois blocos vermelhos de alarme. Um deles **mentia**: mandava reexportar a
conversa "com Incluir mídia" mesmo quando a mídia tinha vindo — o dono sempre exporta com mídia. O
que acontece de verdade é que o app lê alguns arquivos por importação (os mais recentes), e o que
passou disso, ou entrou antes de a v1306 existir, fica sem leitura. A frase agora diz isso, e manda
reimportar pra ele seguir lendo — não refazer a exportação.

O outro aviso (sugestões da análise anterior) continua existindo, com o mesmo botão, mas em uma
linha discreta no lugar de um bloco de cinco linhas.

## 4. O número que dizia "há 8d" num cliente que tinha acabado de escrever

Print das 20h09: um cliente que escreveu às 17h55 aparecia como **"há 8d"** e, ao mesmo tempo, no
topo do "Fazer agora". O número vinha do último atendimento marcado (regra da v1053), mesmo quando
a mensagem era mais recente.

Agora vale o **evento mais recente**, e a linha diz qual é: **"falou hoje"**, "falou há 3d",
"atendido há 10d". O formato é o mesmo pra todo mundo (o pedido da v1055); o que mudou é a palavra
que evita as duas reclamações — a de 2026-08 ("mostra o atendimento quando o cliente falou hoje") e
a original da v1053 ("mostra a mensagem quando a regra usa o atendimento").

Junto, dois acabamentos dos mesmos prints: o cartão **"Aguardando cliente"** não é mais cortado no
meio da palavra, e **"220 atendidos"** virou **"220 atendimentos"** (eram atendimentos, não pessoas
— por isso o número passava do total de leads).

## 5. Dois números com o mesmo nome

Na lista o cliente marcava **40**; na ficha, **68 mensagens do cliente**. Um conta os últimos 90
dias (v1017), o outro o histórico inteiro, e nada dizia isso. Agora, quando os dois são diferentes,
a ficha mostra os dois: *"68 mensagens do cliente · 40 nos últimos 90 dias"*.

## Guardas

`tests/v1332-conferencia-das-tres-sugestoes.test.mjs` (as quatro conferências, o trio limpo sem
aviso, e a proibição de reescrever). Os testes v1053, v1055, v1018, v1046 e v972 foram atualizados
com o motivo da mudança escrito dentro deles — nenhuma garantia foi afrouxada.

Conferido no Chromium: o rótulo do cartão não corta mais.

Suíte: 34 arquivos checados + 478 testes, todos verdes.
