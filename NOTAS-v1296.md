# v1296 — "cadê as regras, o Cérebro, o aprendizado?"

Dois prints do dono, 18/08/2026 às 16h25, e o recado: *"q lixo de sugestões, não esta sendo feito o
q deve! cade as regras, o cerebro, o aprendizado???? poxa vida!!!!"*

As três sugestões daquele print terminavam assim:

1. "…pode me chamar por aqui."
2. "…me avise caso surja alguma dúvida. Só me avisar se quiser conversar com calma."
3. "…posso te explicar por aqui. Tem algo que gostaria de aprofundar?"

Três jeitos de escrever a mesma coisa: **espere**. E o cliente tinha acabado de dizer que gostou da
ideia e que só sabia das condições de pagamento *"mais ou menos"*, por outra pessoa — ou seja,
entregou de bandeja a informação que faltava mandar direito.

Duas coisas entram nesta versão: a **prova** (dá pra ver o que foi usado) e a **regra** (mensagem
que só espera não vale como sugestão).

## 1. A prova: dá pra ver o que entrou em cada análise

Naquela linha cinza embaixo das sugestões ("Análise feita com o seu Cérebro · leu a conversa
inteira"), agora aparece **o que foi enviado**:

> Análise feita com o seu Cérebro · leu a conversa inteira (10 mensagens) · seu Cérebro enviado:
> método 1.200, tom 300, regras 3.400 (4.900 caracteres) · **aprendizado aplicado: seu jeito de
> escrever, 4 casos seus, fatos que você ensinou, 2 mensagens suas desta conversa**

E quando não entra nada do aprendizado, ela diz isso com todas as letras:

> · **aprendizado: nada entrou nesta análise**

Por que isso importa: a parte do Cérebro já existia desde a v1239, mas **o servidor tinha parado de
mandar esses números** numa restauração feita em 12/08 (v1247) — a tela sabia mostrar e não recebia
mais nada. O aprendizado nunca teve prova nenhuma. Resultado: toda sugestão ruim virava a mesma
pergunta sem resposta ("será que ele está usando meu Cérebro?"). Agora a resposta está escrita ali,
em número, análise por análise. Se um campo do seu Cérebro aparecer com 0, ou o aprendizado disser
"nada entrou", isso é o próprio app apontando onde olhar.

Nada disso muda uma vírgula do que é enviado pra IA — é só uma contagem do que já foi montado.

## 2. A regra: mensagem que só espera não é próximo passo

Entrou no pedido feito à IA, junto das outras regras das três mensagens:

- **Cada uma das três precisa FAZER alguma coisa**: entregar o que a conversa está pedindo, trazer o
  dado que destrava a decisão, ou pedir uma resposta concreta. Terminar com "me avise", "qualquer
  coisa me chama", "pode me chamar por aqui", "fico no aguardo", "se quiser posso te explicar"
  **não é próximo passo — é continuar esperando**, e você já estava esperando antes de abrir o app.
- **As três não podem ser a mesma espera com outras palavras.** Se as três terminam pedindo que o
  cliente avise, chame ou procure quando quiser, a leitura não virou condução e a IA precisa refazer
  a partir do que o seu Cérebro manda fazer nesse estágio.
- **Cliente que soube de algo "por alto", "mais ou menos" ou por um terceiro** (condição, valor,
  material) é uma abertura pra entregar aquilo direito — sem inventar nada: vale o que o seu
  Cérebro, a conversa ou os fatos que você ensinou sustentam.

E a conferência que a IA faz antes de devolver ganhou o item 12: se alguma das três terminar jogando
pro cliente a decisão de continuar, ela reescreve aquela mensagem entregando algo ou pedindo uma
resposta concreta.

## 3. Uma conversa nova na bateria de medição

A situação deste print virou caso permanente de teste (`evals/conversas/10-cliente-soube-por-terceiro.json`,
com nomes inventados, como todos os outros): cliente diz que gostou e que ouviu as condições por
alto de um terceiro. O que a bateria cobra: as mensagens **não podem** terminar devolvendo a
iniciativa, não podem repetir a pergunta que ele já respondeu, e **precisam** oferecer as condições
organizadas e pedir uma resposta concreta.

## O que NÃO foi feito

- **Nada de código julgando o conteúdo das sugestões.** Quem decide se a mensagem faz alguma coisa é
  a IA, seguindo a regra escrita no pedido. O código não corta, não reescreve por conta própria e
  não bloqueia sugestão nenhuma — a única rede automática continua sendo a da v1295, que devolve pra
  IA reescrever quando escapa frase de robô.
- **Nada do seu Cérebro foi alterado**, e nenhuma regra dele foi substituída por texto do sistema.

## Testes

- Novo `v1296-cade-o-cerebro-e-o-aprendizado`: a contagem por campo (método, tom, diferenciais, o que
  evitar, regras, objeções, incluindo Cérebro salvo no formato antigo), a contagem das quatro fontes
  do aprendizado, a análise de verdade devolvendo as duas provas, o caso "zero em tudo", a linha da
  tela nos dois textos e as regras novas dentro do pedido.
- A bateria (camada 1) já lê a conversa nova sozinha.
- Conferido no Chromium com o app publicado, em celular (390px) e computador (1440px): a linha fica
  cinza, 13px, sem estourar a largura em nenhum dos dois, e análise antiga (sem os campos novos)
  continua mostrando a linha curta de antes, sem erro de JavaScript.

Suíte inteira verde: 29 arquivos checados + 450 testes.
