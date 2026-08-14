# v1279 — quando o cliente já disse o que quer, quem faz a busca é o corretor

Dono, 14/08/2026, com o print das três sugestões da conversa da Leila (Renaissance) e, ao lado, a
análise que outra IA fez da MESMA conversa.

## O caso

A conversa:

- **18/06** — a cliente pede as plantas, se interessa pelos andares altos, recebe apresentação,
  mapa de disponibilidade e a explicação da unificação de dois apartamentos.
- **16/07, cliente:** *"Obrigada, não ficaram dúvidas. Mas pensamos que 2030 para a entrega para nós
  é muito tempo. Queremos um lugar adequado para nossa idade (faixa dos 70 anos). Queremos alguma
  coisa mais próxima, ou talvez pronta."*
- **16/07, corretor:** *"Vou buscar algumas opções de imóveis prontos ou com entrega mais próxima…
  Existe alguma preferência de local ou tipo de apartamento que devo considerar?"* — **a cliente não
  respondeu essa pergunta.**

E as três sugestões que o app devolveu:

1. *"…já estou separando opções de apartamentos prontos… pensando na praticidade para **sua faixa de
   idade**…"*
2. *"…tem algum **bairro ou detalhe indispensável** que facilitará sua rotina?"*
3. *"…posso te apresentar exemplos… **prefere terça ou quinta de manhã?**"*

A nº 3 estava certa. As outras duas erraram, cada uma de um jeito:

- A **nº 2 refez a pergunta que a cliente já tinha ignorado**. A cliente já disse o que quer (pronto
  ou entrega próxima, adequado pra fase dela); pedir critério de novo é devolver o trabalho pra ela
  — e é a segunda vez que ela recebe a mesma pergunta.
- A **nº 1 devolveu pra ela a idade dela**, como justificativa da oferta. A cliente contou a idade
  pra explicar a pressa; receber "pensando na sua faixa de idade" de volta é constrangedor e nenhum
  corretor bom escreve isso.

Havia ainda um ponto de fundo: a cliente não perdeu o interesse — ela **descartou o produto**. O
Renaissance ficou inadequado pelo prazo, que é algo que aquele empreendimento não pode mudar. Dali
em diante o assunto deixa de ser o Renaissance.

## A causa

Duas coisas no texto de instruções que vai pra IA:

1. **A definição do ângulo "Alternativa" (a sugestão nº 2) mandava literalmente "faça a pergunta que
   falta".** Era um cheque em branco: a IA cumpriu a instrução e escreveu a pergunta — sem conferir
   se ela já tinha sido feita e ignorada, ou se a própria cliente já a tinha respondido.
2. **Não existia regra nenhuma** sobre devolver ao cliente o que ele contou de si, nem sobre o que
   fazer quando ele recusa o imóvel por um motivo que o imóvel não pode mudar.

A regra da v1277 (a oferta ignorada não volta com outras palavras) estava lá e é do mesmo espírito,
mas ela nasceu do caso de **duas ou mais tentativas sem resposta**, e este aqui é o caso de UMA
pergunta ignorada logo depois de a cliente ter falado.

## O que mudou

### 1. O ângulo "Alternativa" não é mais a mensagem da pergunta solta

Ele continua sendo o consultivo, de baixa pressão — mas agora: trata a objeção, adianta o que dá pra
adiantar ou oferece ajuda; e a pergunta que ele pode carregar tem que ser **inédita**, não respondida
pela conversa, e **emendada no que a mensagem entrega**. Está escrito com todas as letras que "baixa
pressão" não é licença pra devolver o trabalho pro cliente.

### 2. Cliente que já disse o que quer recebe condução, não questionário

Quando o critério já veio (o que precisa, o prazo, a fase, o que descartou), o corretor assume a
busca com o que já tem e fecha propondo o encontro com **dois dias ou horários concretos**. O que
ainda falta saber vira **pauta desse encontro**, não pergunta no WhatsApp. E quando for apresentar
opções: **duas ou três bem escolhidas**, com uma frase dizendo por que cada uma serve pra ele —
despejar a carteira inteira parece catálogo, não atendimento.

Isso **não** autoriza a mensagem a dizer que o corretor já fez o que ainda não fez: continua valendo
"vou separar", nunca "já separei".

### 3. Objeção que o produto não resolve = trocar de produto

Recusa por prazo de entrega, localização, tipologia, tamanho ou andar não mata o lead — mata a
adequação daquele imóvel. É proibido tentar reverter com argumento do mesmo imóvel ("a valorização
compensa a espera") ou fazer as três mensagens girarem em torno dele de novo. Sem alternativa escrita
na conversa ou no Cérebro, a mensagem não inventa nenhuma: confirma o critério com as palavras do
cliente e leva ao encontro.

### 4. O que o cliente contou de si guia a escolha, mas não volta como etiqueta

Idade, saúde, mobilidade, aposentadoria, fase da vida, aperto financeiro: servem pra escolher o que
oferecer, nunca pra ser dito de volta. Ficaram proibidas "pensando na sua faixa de idade", "pela
idade de vocês", "por vocês serem idosos", "já que estão aposentados", "considerando sua condição".
No lugar vai o benefício concreto ("pronto pra morar, sem obra e sem espera", "tudo no mesmo andar")
ou a palavra que o próprio cliente usou ("um lugar adequado pra esta fase").

### 5. Item 12 da conferência final

A lista curta que a IA relê antes de devolver as três mensagens ganhou o item que pergunta se alguma
delas devolve o trabalho pro cliente: pedir critério que ele já deu, insistir no imóvel recusado, ou
devolver a etiqueta. A lista foi de 11 para 12 itens — **é o teto**: a lição da v1263 é que ela só
funciona enquanto for curta.

## Sobre a sugestão da outra IA

A leitura comercial dela bate com a nossa em quase tudo, e as regras acima vieram daí. Um detalhe
onde ela erra pro nosso caso: a mensagem preferida dela começa com *"Separei algumas opções"* — no
passado. Aqui isso é proibido de propósito desde as primeiras versões: a mensagem é assinada pelo
corretor, e afirmar um trabalho que ainda não foi feito é uma mentira que o próprio cliente desmente
na resposta seguinte. O jeito certo é o futuro: "vou separar", "já estou separando".

## Conferência antes de publicar

- Suíte completa verde: 23 arquivos checados + 434 testes, incluindo os novos.
- Sem mudança de layout, CSS ou tela nesta versão — o que mudou é o texto de instruções que vai pra
  IA. Nenhuma informação comercial foi cravada no código.

## Arquivos alterados

- `api/_pipeline.js` — a definição do ângulo "maisSuave", as três regras novas e o item 12 da
  conferência final.
- `tests/v1279-cliente-ja-disse-o-que-quer.test.mjs` — teste novo (o print vira caso de teste).
- `tests/v1263-conferencia-final.test.mjs` e `tests/v1277-tentativa-repetida-nao-volta.test.mjs` —
  guardas atualizadas pros 12 itens.
- `ESTADO-ATUAL.md` — resumo da mudança.
- `package.json` / `package-lock.json` — versão 1279.

## Por que 1279

Outra sessão publicou a v1278 (a fila do dia listada na Home) enquanto esta mudança estava em
preparo. Esta ficou com o número seguinte, e nada do que ela fez foi desfeito.
