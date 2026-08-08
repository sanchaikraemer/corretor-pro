# v1182 — "Análises feitas 0" e "Importações 0" em julho: o Desempenho estava contando errado

O dono mandou o print do **Desempenho**, com o mês de **julho** selecionado. Na mesma tela:

- Mensagens trocadas: **696**
- Leads atendidos: **159**
- Mensagens copiadas: **73**
- **Análises feitas: 0**
- **Importações: 0**

Não fecha. Se 159 clientes foram atendidos e 73 sugestões da IA foram copiadas em julho, então
houve importação e houve análise em julho — os dois números não podiam estar zerados.

## Por que estava dando zero

As linhas do Desempenho vinham de **duas fontes diferentes**, e ninguém percebia isso na tela:

- **Mensagens trocadas, Leads atendidos, Mensagens copiadas e Propostas** saem da sua **carteira** —
  ficam guardados na sua conta e aparecem em qualquer aparelho onde você entrar.
- **Análises feitas, Importações e Tempo no app** eram anotados **só no aparelho**, dentro do
  navegador, e **nunca eram enviados pra sua conta**. Além disso, essa anotação local é apagada
  sozinha depois de 90 dias.

Ou seja: bastava **trocar de celular, reinstalar o app, usar no computador ou limpar os dados do
navegador** pra essas duas linhas virarem 0 — mesmo com a carteira inteira lá, cheia de trabalho
feito. O próprio print entrega o que aconteceu: **"Tempo no app: menos de 1min"** em julho. Aquele
aparelho não tinha histórico nenhum de julho. As outras linhas continuaram certas porque vêm da
conta; essas duas zeraram porque dependiam de um caderninho que ficou no aparelho anterior.

## O que a v1182 muda

**Análises feitas e Importações passam a ser contadas também pela sua carteira**, que acompanha
sua conta:

- cada **cadastro criado** dentro do mês conta como uma **importação**;
- cada **análise ou reanálise** carimbada no cadastro dentro do mês conta como uma **análise**.

O app compara as duas contagens (a da carteira e a anotação do aparelho) e **mostra a maior**.
Assim:

- **quem sempre usou o mesmo aparelho não perde nada** — a anotação local sabe de coisas que a
  carteira não registra (reanalisar o mesmo cliente várias vezes, reimportar uma conversa que
  atualiza um cadastro já existente em vez de criar outro), e quando ela for maior, continua sendo
  ela que aparece;
- **quem trocou de aparelho para de ver zero** — a carteira cobre o buraco.

Um cuidado que entrou junto: quando uma conversa é importada, o app carimba a data em mais de um
lugar quase ao mesmo tempo. Sem tratar isso, uma única importação seria contada como duas ou três
análises. Carimbos dentro de **10 minutos um do outro contam como a mesma análise**.

## O que você vai ver

Abra o **Desempenho**, escolha **Julho** e as linhas **Análises feitas** e **Importações** vão
mostrar números de verdade, coerentes com os leads e as mensagens ao lado. Nada foi inventado: são
os seus próprios cadastros, contados pela data em que entraram e pela data em que a IA os analisou.

Duas observações honestas sobre a precisão:

- **Tempo no app continua sendo só deste aparelho** — esse não tem como recuperar de outro lugar,
  porque nunca foi enviado pra conta. A linha já avisa isso na tela.
- Nos meses antigos, o número de importações pode ficar **um pouco abaixo** do real quando você
  reimportou a mesma conversa (isso atualiza o cadastro em vez de criar outro). Ele nunca vai ficar
  acima do real — na dúvida, conta a menos, nunca a mais.

Antes de conferir, olhe o número no topo do app: precisa estar **Atualização #1182**. Se ainda
aparecer um número menor, feche e abra o app de novo.

## Testes

`tests/v1182-desempenho-analises-da-carteira.test.mjs` — reproduz o cenário do print (aparelho sem
histórico local nenhum) e prova que a carteira sustenta os dois números; prova que a anotação do
aparelho, quando é maior, continua valendo; prova que os vários carimbos de uma mesma análise
contam como uma só; prova que cadastro sem data não quebra nem inventa número; e prende na API os
campos que a carteira precisa receber pra essa conta existir (data de criação e carimbos de
análise).

Suíte completa verde: 24 arquivos checados + 348 testes.
