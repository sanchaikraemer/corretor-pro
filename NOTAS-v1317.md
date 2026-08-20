# v1317 — o fichário da conversa: a IA para de perguntar o que você já perguntou

Pedido do dono (20/08/2026), depois de comparar a análise do app com a leitura da MESMA conversa
feita à mão: *"eu quero q o sistema funcione igual a sua analise"*.

A diferença nunca foi esperteza da IA. Era **material**. A leitura à mão tinha quatro coisas na mão
que o app nunca entregou. Agora entrega.

## O que os três prints do dono mostravam

- As três sugestões perguntando **"morar ou investir?"** — pergunta que o corretor tinha feito
  **sete meses antes**, na primeira resposta da mesma conversa, e que nunca foi respondida.
- As três presas ao **apartamento do anúncio (R$ 430 mil)**, ignorando que a cliente tinha acabado
  de oferecer **3 terrenos** como entrada — o que muda a faixa de compra dela por completo.
- Uma delas repetindo a pergunta sobre **financiar o saldo**, feita no dia anterior.

Não é que a IA fosse burra: ela recebia sete meses de conversa num bloco só, onde a mensagem de
janeiro chega com a mesma cara da de ontem, e sem nenhuma conta feita.

## Os quatro fatos que passam a ir prontos para a IA

1. **Todo valor em dinheiro já citado, com a idade dele.** "R$ 670.000 — dito pelo corretor em
   21/01/2026, há 211 dias". Preço velho para de voltar pro cliente como se fosse o de hoje.
2. **Todas as perguntas que o corretor já fez**, frase por frase, com data e há quantos dias — e
   marcadas quando foram repetidas. A lista tem teto maior de propósito: a pergunta mais perigosa
   de refazer é a mais **antiga**, a do primeiro contato, que ninguém lembra mais.
3. **Os próximos passos que o corretor já propôs** (visita, café, reunião, apresentação), com data.
   Propor o quinto convite igual aos quatro que não aconteceram não é próximo passo.
4. **A entrada que não é dinheiro (permuta), e a conta que ela abre.** O app lê o bem oferecido
   pelo cliente, o valor que ele deu, a porcentagem de permuta que **o próprio corretor** disse na
   conversa, e faz a conta: *"R$ 360 mil cobrindo de 50% a 40% abre uma compra de R$ 720 mil a
   R$ 900 mil"*. É exatamente o raciocínio da leitura à mão.

Nada disso é regra nova de escrita, e **nada aqui reescreve o texto da IA** — a rede que fazia isso
saiu na v1315, por ordem do dono, e não voltou. É o remédio de sempre deste projeto: entregar o
**fato pronto**, em vez de escrever mais uma instrução mandando a IA ser esperta.

Tudo é calculado sobre o texto da própria conversa. Nenhuma informação comercial vem do código, e
a porcentagem de permuta é sempre a que o corretor escreveu — o app não tem regra própria.

## Dois bugs antigos que este trabalho desenterrou

- **"800mil" era jogado fora.** Escrito colado, como se escreve no WhatsApp, o valor virava 800,
  caía no piso de mil reais e sumia da análise. Era justamente o número da faixa de compra na
  conversa de teste.
- **"R$ 1,2 milhão" era lido como R$ 1.200.** Um imóvel de milhão virava mil e duzentos reais.
  Culpa da ordem em que as palavras eram procuradas.

Os dois valiam para qualquer conversa, não só para a de teste.

## Testes

`tests/v1317-fichario-da-conversa.test.mjs`, rodando em cima da conversa fixa da v1316: os quatro
fatos, os dois bugs de valor, o fim a fim até o pedido enviado à IA, e a garantia de que o fichário
não manda reescrever nada.

A conversa fixa saiu de dentro do teste da v1316 e virou `tests/conversa-fixa-permuta.mjs`, para os
dois testes se apoiarem nela sem copiar 64 linhas de conversa duas vezes.

`npm test`: 30 arquivos checados + 461 testes, verdes.
