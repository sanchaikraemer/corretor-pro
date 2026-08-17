# v1288 — o histórico antigo não manda mais na análise

Dono, 17/08/2026, logo depois da v1287. Ele trouxe a leitura que outra IA fez da MESMA conversa da
Geovana e perguntou: **"resolvido então sobre a análise? prestou atenção nisso?"**

A resposta honesta era "quase". A v1279 e a v1287 já cobriam a maior parte daquela leitura — não
devolver o trabalho pro cliente, não mandar a carteira inteira, não repetir pergunta já respondida,
não chutar data, e a pergunta do dinheiro emendada na entrega. Mas três pontos daquela análise não
estavam escritos em lugar nenhum do pedido, e os três vinham do mesmo lugar: **o histórico antigo
enganando a leitura do presente.**

## 1. Mudança de planos declarada ≠ objeção

A regra que existia (v1279) começa assim: *"quando o cliente RECUSA um imóvel por um motivo que
aquele imóvel não pode mudar…"*. A Geovana não recusou nada — ela **anunciou**: *"mudança de
planos"* / *"Apartamento"*. Mudança declarada não estava escrita em canto nenhum, então o terreno
(e todo o assunto dele) continuava liberado para voltar à condução, junto com tudo o que ela já
tinha olhado desde 2024.

Entrou a regra **MUDANÇA DE PLANOS DECLARADA = O PRODUTO ANTIGO SAI DA CONDUÇÃO**:

- os sinais estão escritos com as palavras do cliente ("mudança de planos", "agora é apartamento",
  "desisti do terreno", "não é mais pra investir, é pra morar");
- mudança declarada **não é desinteresse** — é a informação mais valiosa que a conversa tem, porque
  o cliente acabou de dizer o que vale hoje;
- o produto antigo **sai**: proibido retomá-lo, oferecê-lo "já que ele chegou a se interessar" ou
  perguntar se ele ainda pensa naquilo;
- o histórico **não é jogado fora inteiro**: fica o que ainda vale com o critério novo (o jeito
  dele, a forma de pagamento, quem decide junto, o que ele contou da vida dele);
- na dúvida entre o que foi dito antes e depois da mudança, **o depois manda, sempre**;
- e vale o mesmo para o cliente que voltou várias vezes ao longo dos anos por produtos diferentes:
  manda a última coisa que ele pediu, não a soma do que ele já olhou.

## 2. Silêncio de dois anos virou orçamento

No print, o diagnóstico dizia: **"faixa de valor que a conversa já indica: recebeu e não refutou
opções apresentadas entre R$ 322.000 e R$ 498.000"**. Aquilo era uma **tabela de agosto de 2024**,
de um produto que ela já trocou, que ela **nunca comentou** — nem para aceitar, nem para recusar.

A causa estava na própria instrução do campo (v1259): *"se um valor mais baixo foi apresentado e ele
NÃO recusou, esse valor é PISO plausível"*. A regra foi escrita para um caso em que a cliente
**reagiu** — e virou, aqui, "silêncio = aceite".

A dedução legítima continua de pé (reação do cliente ainda vira teto e piso), mas agora com trava:

- **silêncio não é aceite** — só conta como piso o valor diante do qual houve REAÇÃO do cliente;
- tabela de **outro produto**, ou de um momento que a conversa já deixou pra trás, **não descreve o
  bolso dele hoje**;
- nesses casos a faixa fica em "Não identificado" — e é isso que faz aparecer, na mensagem, a
  **única pergunta que destrava** (faixa de valor e entrada, do item 4 da conferência, v1287) em vez
  de o corretor trabalhar em cima de um número que ninguém confirmou.

As duas coisas se encaixam: sem orçamento inventado, o sistema pergunta o orçamento.

## 3. Entregar opções empatadas é devolver a escolha

A leitura trazida pelo dono terminava com um passo que o pedido não tinha: *"se houver uma opção
claramente superior, dizer isso"*. O prompt mandava escolher duas ou três opções e explicar por que
cada uma serve — e parava aí.

Agora, quando UMA delas chega mais perto do que o cliente pediu, a mensagem **diz qual e por quê**
("das duas, pela localização e pela iluminação, eu começaria por essa"). Quem entende do assunto
recomenda; entregar as opções empatadas devolve pro cliente justamente a escolha que ele procurou um
corretor para fazer. A recomendação sai do que o cliente pediu contra o que a conversa e o Cérebro
mostram do produto — **nunca de vantagem inventada** (a regra de não inventar fato continua acima
desta).

## Como isto fica protegido

- `tests/v1288-historico-antigo-nao-manda.test.mjs` — as três regras, cada uma com o motivo escrito,
  e a conferência de que a dedução legítima de teto/piso (v1259) não caiu junto.
- `evals/conversas/09-observacao-colada-e-conversa.json` ganhou três linhas de régua: a mudança de
  planos tira o produto antigo da condução, tabela antiga não vira orçamento, e opção apresentada
  vem com recomendação.
- `tests/v1259-usar-o-que-a-conversa-ja-disse.test.mjs` passou a cobrar também a trava do silêncio.

## O que NÃO mudou

- Nenhuma informação comercial entrou no código, e nenhuma mensagem é reescrita por código.
- A regra de não inventar fato continua acima de tudo: recomendar uma opção não autoriza descrever
  vantagem, valor ou característica que não esteja na conversa ou no Cérebro.
