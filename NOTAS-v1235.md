# NOTAS v1235 — as três sugestões passam por uma conferência antes de chegar na tela

Data: 12/08/2026. Reclamação do dono, com três prints seguidos: *"olha os termos... (tranquilo
por aqui) (tudo certinho), ridículo, não pode estar usando os prompts, impossível sair umas
merda dessas se tivesse usando o cérebro"* — e, depois de reanalisar, *"olha que merda de
sugestões"*.

## O que ele viu

Primeiro print:

> "Boa noite Adriano, tudo bem? **Tranquilo por aqui**, vi que você prefere aguardar…"
> "Boa noite Adriano, **tudo certinho?** Só pra reforçar, qualquer dúvida…"

Segundo print (depois de reanalisar):

> "**Trago aqui** aquela simulação detalhada do <empreendimento> que conversamos… me diz **se faz
> sentido** seguir nessa linha"
> "**Separei agora** a simulação do <empreendimento> com as alternativas de entrada e safra…"

## O diagnóstico — ele estava certo no efeito, e o motivo é pior do que parecia

A primeira suspeita dele foi que o sistema não estava usando o Cérebro. **Não é isso**: a
conferência no código mostra que o Cérebro dele vai inteiro para a IA a cada análise (é por
isso que a tela escreve "Análise feita com o seu Cérebro"), junto com o jeito de escrever
dele, os casos reais da carteira e os fatos que ele já ensinou.

O problema é outro, e é mais sério: **as frases que ele reclamou já estavam proibidas por
escrito, e a IA passou por cima delas assim mesmo.**

- "faz sentido" está na lista de jargão proibido do pedido desde a v1212 — e apareceu **duas
  vezes** no mesmo print.
- Escrever que o corretor "separou" algo que não aconteceu está proibido desde a v1219, com
  esse verbo citado com todas as letras — e saiu "Separei agora a simulação".

Ou seja: **a regra existia, foi ignorada, e ninguém conferia.** O código dizia, literalmente,
que não olhava o texto que a IA devolvia. Todo o esforço das versões anteriores foi escrever
regras cada vez mais duras dentro de um pedido que já é enorme — e essa estratégia acabou de
mostrar o limite dela. Pedir mais alto no mesmo muro de texto não ia resolver.

Tem ainda um erro de fundo, que é o que mais dói: **nenhuma das seis sugestões falou da
colheita.** Na conversa o cliente disse, com todas as letras, que ia olhar o resultado da
colheita antes de decidir. Era esse o assunto para retomar — e as sugestões insistiam em
reoferecer a simulação, que é justamente a oferta que ele não respondeu.

## O que mudou

**1. Agora existe uma conferência automática nas três mensagens, antes de irem pra tela.**

Duas listas, com pesos diferentes de propósito:

| | O que é | O que acontece |
|---|---|---|
| **Proibido** | clichê que está errado sempre: "fico à disposição", "espero que esteja bem", "qualquer dúvida estou aqui", "desculpa incomodar", "se ainda tiver interesse" — e o cumprimento que se responde sozinho ("tudo bem? **tranquilo por aqui**") | reescreve |
| **Conferir** | depende dos fatos: "separei", "preparei", "conferi", "trago aqui", "tenho novidades" — e "faz sentido" | manda reler **com a conversa na mão** e decidir |

Quando a conferência acha alguma coisa, o sistema pede **uma releitura** das três mensagens,
dizendo exatamente o que revisar. Se não achar nada, entrega direto — sem custo e sem espera
a mais.

**"faz sentido" ficou na lista branda de propósito, por causa do próprio dono:** ele mandou,
como exemplo do que quer, uma mensagem do ChatGPT que usa a expressão ("Ainda faz sentido a
ideia de pegar um apartamento na planta?"). A expressão não é o problema — o problema é
"me diz se faz sentido seguir nessa linha", que devolve a decisão pro cliente sem perguntar
nada. Quem sabe separar os dois é quem está lendo a conversa, não uma lista de palavras.

**2. Regra nova: a retomada começa pela vida do cliente, não pela oferta.**

Quando o cliente condicionou o próximo passo a algo dele — a colheita, vender um carro, uma
viagem, a decisão da esposa — e esse prazo passou, **é por aí que a conversa recomeça**:
perguntando como aquilo ficou. Voltar reoferecendo o material que ele não respondeu passou a
ser erro grave por escrito. Só depois que ele responder é que a simulação volta pra mesa.

**3. Cumprimento que se responde sozinho está proibido por escrito.**

"Tudo bem? Tranquilo por aqui" não é coisa que alguém escreva no WhatsApp — entrega na
primeira linha que a mensagem é automática. Ou cumprimenta, ou pergunta; nunca os dois.

## O que NÃO mudou (de propósito)

- **A releitura nunca piora nada.** Se ela falhar, demorar ou voltar com mais clichê do que
  tinha antes, valem as mensagens originais. Análise nunca é descartada por causa das
  sugestões — regra do projeto desde a v827-12, e continua valendo.
- **Nenhuma espera a mais na importação.** A releitura cabe dentro do mesmo orçamento de tempo
  que a análise já tinha (não estica o teto do servidor). Se não sobrou tempo, entrega o que
  veio.
- **Trio limpo não gasta chamada extra** — nem tempo, nem custo de IA.

## Uma decisão de arquitetura que precisou ser aberta

Desde a v827-18 existia uma trava que proibia qualquer segunda passada em cima das mensagens.
Ela nasceu de um estrago real: um laço que tentava consertar **formatação** e, quando não
conseguia, **jogava fora o texto bom da IA** e entregava frase genérica no lugar.

A releitura da v1235 é o oposto disso e a trava foi reescrita explicando a diferença: passagem
**única** (não é laço), roda **só quando há apontamento**, cuida de **conteúdo** e não de
formatação, e **não pode descartar nada** — na dúvida, ficam as mensagens que já estavam na
mão. O teste antigo continua guardando tudo o que guardava; só deixou de confundir as duas
coisas.

## Validação

- Versão: `7.1235.0` / exibida **1235**.
- Novo teste `tests/v1235-conferencia-das-tres-mensagens.test.mjs`, com **os textos exatos dos
  prints** do dono: os três casos ruins são pegos, e a retomada boa que ele mandou como
  exemplo passa sem nenhum apontamento. Além do texto do código, o teste roda a análise ponta
  a ponta e confere o comportamento: mensagem ruim é trocada, trio limpo não gasta chamada,
  reescrita pior é recusada, reescrita incompleta é recusada e falha na releitura não derruba
  a análise.
- `npm test` inteiro verde (401 testes).
