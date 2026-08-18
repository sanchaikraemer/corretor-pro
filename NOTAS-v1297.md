# v1297 — a pergunta que você já fez não volta como sugestão

Print do dono, 18/08/2026 às 17h18, já na versão 1296 — e desta vez com a prova nova na tela:

> seu Cérebro enviado: método 6.577, tom 1.892, diferenciais 2.519, o que evitar 3.115, regras
> 6.037, objeções 6.319 (**26.459 caracteres**) · aprendizado aplicado: seu jeito de escrever, 4
> casos seus, fatos que você ensinou, 1 mensagem sua desta conversa

Ou seja: **o Cérebro inteiro chegou na IA, e o aprendizado também.** A pergunta "cadê o Cérebro?"
está respondida — o problema é outro, e o mesmo print mostra qual.

## O defeito, com o relógio na mão

- **15h47** — o corretor mandou: *"Que bom que conseguiu analisar o material. Ficou alguma dúvida ou
  algum ponto que gostaria de conversar sobre o empreendimento?"*
- **15h48** — o cliente respondeu: *"Estamos analisando ainda, mas gostei da ideia"* e *"o Nicolas me
  falou mais ou menos as condições de pagamento"*.
- **17h18** — a sugestão **Recomendada** do app: *"Tem algum ponto das condições de pagamento que
  você gostaria de ver com mais detalhes, ou alguma dúvida sobre o empreendimento que posso
  esclarecer?"*

É a mesma pergunta, com outras palavras, uma hora e meia depois de o cliente já ter respondido.

## Por que acontecia

O pedido feito à IA já mandava, por escrito, "não repita pergunta já respondida". Só que era ordem
sem material: **a IA não recebia em lugar nenhum a lista do que já tinha sido perguntado nessa
conversa.** Ela lia a conversa inteira, claro, mas "perguntar de novo com outras palavras" não
parece repetição pra quem está escrevendo — parece uma pergunta nova.

É exatamente a lição da v1277, quando a oferta repetida ("posso te mandar a apresentação?") só parou
de voltar depois que o **texto** das tentativas passou a ir junto no pedido.

## O que muda

Toda análise passa a levar, junto dos outros fatos da conversa, a lista:

> **PERGUNTAS QUE O CORRETOR JÁ FEZ NESTA CONVERSA:**
> - "Ficou alguma dúvida ou algum ponto que gostaria de conversar sobre o empreendimento?" — o
>   cliente JÁ FALOU depois desta pergunta
> - "Posso te mandar o quadro de condições por escrito?" — ainda sem resposta
>
> Nenhuma pergunta já respondida pode voltar nas três mensagens, nem reescrita com outras palavras.
> Se o que você faria com a resposta já dá para entregar, entregue em vez de perguntar de novo.

O sistema só **lê** as suas mensagens e separa as frases que terminam em "?" — não decide nada
comercial, não corta e não reescreve nada. Quando não há pergunta anterior nenhuma, o pedido diz
isso também (silêncio vira dúvida pra IA).

E a régua entrou também **na descrição dos campos** que a IA preenche na hora de escrever, que é
onde ela obedece de verdade:

- mensagem **recomendada**: precisa entregar algo, trazer o dado que destrava ou pedir uma resposta
  concreta — e não pode repetir pergunta que o cliente já respondeu;
- mensagem **suave**: consultiva, mas com um passo concreto dentro dela;
- **próximo passo** ("Fazer agora"): escrito como ação sua e, quando a informação que falta já dá pra
  entregar, o passo é **entregar**, não perguntar de novo.

## O que NÃO foi feito

- Nenhuma frase é cortada, trocada ou bloqueada pelo código — quem escreve continua sendo a IA
  seguindo o seu Cérebro.
- Nenhuma regra do seu Cérebro foi alterada, e nada do que a v1295/v1296 puseram no lugar foi
  desfeito.

## Testes

- Novo `v1297-pergunta-ja-respondida-nao-volta`, montado com a conversa do print: extração das duas
  perguntas reais do corretor, marca de "já respondida", fala do cliente que não pode virar pergunta
  dele, pergunta repetida contando uma vez só, conversa sem pergunta nenhuma, o fato chegando dentro
  do pedido com a regra colada nele, e as réguas dentro do formato do JSON.
- `v1262` e `v865` tiveram a linha do campo atualizada: os dois cobravam a descrição antiga, palavra
  por palavra, e o que mudou foi só a descrição ficar mais concreta.

Suíte inteira verde: 29 arquivos checados + 451 testes.
