# v1300 — "Joia." não é resposta, e a reescrita parou de sair emendada

Print do dono de 18/08/2026 às 17h56, junto com a conversa atualizada. Duas coisas novas nele.

## 1. O "Joia." estava passando como se a conversa tivesse andado

A conversa, com o relógio:

- **16h06** — o corretor mandou as condições inteiras (entrada, parcelas direto com a construtora,
  reforços anuais, veículo na entrada) e perguntou: *"Você já tem algo em mente?"*
- **16h08** — o cliente respondeu: **"Joia."**

E as três sugestões seguintes voltaram a oferecer informação e a perguntar de novo: *"Te detalho
agora as opções de salas…"*, *"Te mando agora mais informações sobre estrutura, localização ou outras
opções"*, *"preciso saber se algum detalhe chamou mais atenção…"*.

Um "joia" solto **não responde, não aceita e não supera nada** — é o cliente sendo educado enquanto
continua parado. Só que, pro sistema, aquilo era só "o cliente falou": a conversa parecia ter
avançado e a IA escrevia como se estivesse tudo em aberto.

**O que muda:** quando a última fala do cliente é um reconhecimento curto ("joia", "ok", "blz",
"certo", "valeu", "entendi", "perfeito", "show", 👍 e afins), isso vai como fato no pedido, junto com
a pergunta que o corretor tinha feito e continua sem resposta. Com a regra colada: não trate como
aceite, concordância, interesse confirmado ou objeção superada; e **não devolva a mesma pergunta com
outras palavras** — depois de um "joia", o que move a conversa é você propor algo concreto, uma ação
sua, específica e pequena.

**O que não conta como "joia":** *"Joia, me manda a simulação da sala 302"* diz alguma coisa e passa
direto. E se quem falou por último foi você, o bloco nem existe.

## 2. A sugestão 2 chegou emendada — culpa do modelo rápido

A alternativa daquele print veio assim: *"Posso conversar sobre algum detalhe do empreendimento ou se
surgir alguma dúvida durante sua análise."* — frase quebrada, que ninguém escreveria no WhatsApp.

O motivo: a rede que reescreve as mensagens furadas (a que tira "fico à disposição", "me avise" e o
pedido de licença) estava usando o **modelo rápido**, que é barato mas escreve mal. Corrigir uma
frase e devolver português capenga é troca ruim.

Agora a reescrita é feita pelo **modelo principal**, o mesmo que escreve a análise, sempre que
sobrarem pelo menos 12 segundos no orçamento da importação. Abaixo disso ela ainda usa o rápido —
nesse caso, uma reescrita simples continua sendo melhor do que deixar a frase proibida passar. E a
instrução ficou explícita: devolver **uma mensagem inteira**, escrita do começo ao fim, sem emendar
pedaços da anterior.

## Testes

- Novo `v1300-joia-nao-e-resposta`, montado com a conversa real: o reconhecimento curto identificado
  com a pergunta que ficou sem resposta, nove variações ("ok", "blz", "valeu", 👍…), os três casos
  que **não** podem virar isso (resposta que diz algo, corretor falando por último, conversa vazia),
  o fato dentro do pedido com a regra, a conversa normal que não ganha o bloco, e a troca de modelo
  na reescrita.

Suíte inteira verde: 29 arquivos checados + 454 testes.
