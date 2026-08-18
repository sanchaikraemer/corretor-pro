# v1301 — o aplicativo parou de receber informação de outro cliente na hora de escrever

Print do dono de 18/08/2026 às 19h36: **"inventando coisas!!!!!!"**.

A conversa inteira tinha três linhas:

- **18h42** — anúncio do Facebook: *"temos um apartamento com 2 dormitórios e box de garagem por
  R$ 430.000. Quer agendar uma visita?"*
- **18h42** — cliente: *"Olá! Quero saber mais sobre o apartamento de R$ 430 mil."*
- **18h42** — cliente: *"móveis"*

E as três sugestões voltaram assim:

1. *"…está disponível na [nome de um empreendimento]"*
2. *"…uma localização ótima perto da [rua da cidade]"*
3. *"…fica em uma região bem localizada"*

Ninguém disse **onde** aquele apartamento fica. Nem o anúncio, nem o cliente. O empreendimento, a
rua e o elogio à região saíram do nada — e, do outro lado, quem lê é um cliente que pode ir parar no
endereço errado.

## Por que a regra que já existia não segurou

A ordem de nunca inventar já estava escrita em **três lugares** do pedido que vai pra IA, e no seu
Cérebro também. Mesmo assim o endereço saiu. Não saiu porque a IA ignorou a regra: saiu porque **o
próprio sistema colocava a informação errada na mão dela**, em toda análise:

1. **Casos de outros clientes** — até 4 atendimentos seus com outros compradores iam junto no
   pedido, com produto, condução e a regra que ficou de cada um (ligados na v1212).
2. **Fatos ensinados da carteira** — o bloco inteiro de conhecimento acumulado (endereços,
   empreendimentos, pontos de referência), sem nenhum vínculo com a conversa que estava sendo
   analisada (ligado na v1115).
3. **Produto × perfil** — dentro do bloco "seu jeito", uma linha escrevia o **nome do
   empreendimento** que você ofereceu a outro cliente de perfil parecido.

Numa conversa de três linhas, quase nada vem da conversa. O buraco é preenchido com o que está por
perto — e o que estava por perto era o imóvel dos outros.

## O que muda

**As três fontes saíram do pedido.** Não foi acrescentada mais nenhuma regra: foi tirado o material
que alimentava a invenção. Somar uma quarta regra em cima de três que já não seguravam não ia mudar
nada — foi exatamente o que vinha sendo feito e não resolvia.

**O que continua indo pra IA, igual a antes:**

- o **Cérebro inteiro** (método, tom, diferenciais, o que evitar, regras, objeções) — é você que
  escreve e manda nele;
- o **seu jeito de escrever**, aprendido das suas conversas (tom, condução que funcionou, seu jeito
  de responder objeção, seu follow-up);
- as **suas mensagens reais desta conversa**;
- a conversa inteira, do começo ao fim.

**O que continua sendo aprendido e guardado:** o banco de casos e os fatos ensinados **não foram
apagados**. Eles seguem sendo aprendidos a cada importação e seguem aparecendo na tela de
Aprendizado e na planilha de exportação. Só não entram mais na hora de escrever as três mensagens.

**A linha embaixo das sugestões passa a dizer a verdade:** ela mostrava "4 casos seus, fatos que
você ensinou" porque aquilo era mesmo enviado. Agora não é mais enviado, então esses itens somem da
linha sozinhos — ela continua mostrando o Cérebro enviado, o seu jeito e as suas mensagens desta
conversa.

## O preço disso, assumido

Se o cliente perguntar **o endereço** do imóvel, o aplicativo **não vai mais responder de cabeça**.
Ele vai se oferecer pra confirmar e te passar. É o que a regra do projeto sempre mandou fazer na
falta de informação — e é melhor confirmar do que mandar o cliente pro lugar errado.

Se você quiser que o empreendimento apareça na mensagem, ele precisa estar **na conversa** (no
anúncio, na sua fala, na do cliente) ou numa **observação registrada naquele lead**. Aí é fato
daquele atendimento, e o aplicativo pode usar.

## Onde isso não pode voltar sozinho

Já aconteceu neste projeto de uma sessão religar um bloco desligado achando que era esquecimento —
foi assim que os casos voltaram na v1212. Por isso, além do motivo escrito no código, ficaram três
guardas que quebram de propósito se alguém religar:

- `tests/v1301-nada-de-outro-cliente-na-mensagem.test.mjs` — roda uma análise de verdade e confere o
  pedido que a IA recebeu: nada de outro cliente lá dentro, e a linha da tela não pode alegar o que
  não foi enviado;
- `tests/v1212-casos-reais-entram-na-analise.test.mjs` — seção final, guardando a desligação;
- `tests/v1115-conhecimento-lido-e-fatos-nao-inventados.test.mjs` — seção 2, invertida.

## Uma coisa que precisa ser dita

Nada disso foi testado contra a conta real do dono. Os testes daqui rodam com conversas montadas
nesta sessão, não com o Cérebro dele nem com o banco de produção — esta sessão não tem acesso a
nenhum dos dois. É por isso que "está funcionando" já foi dito aqui mais de uma vez e, na tela dele,
não estava. O que se pode afirmar com certeza desta vez é o que os testes provam: **o material de
outro cliente não sai mais deste sistema em direção à IA**. Se o endereço inventado voltar mesmo
assim, o próximo lugar a olhar é o campo **Diferenciais** do próprio Cérebro, que também descreve
empreendimentos e continua indo inteiro (como tem que ir — é o texto que o dono escreveu).
