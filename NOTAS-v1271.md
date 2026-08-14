# v1271 — a retomada de quem avisou que ia viajar (e o pedido que partiu do próprio cliente)

Caso real do dono, 14/08/2026. Print das três sugestões de uma lead + a conversa inteira.

A conversa: em 16/07 o corretor apresentou tudo (lançamento, alto padrão em obra, pronto para
morar com móveis, links, vídeos, tabela de disponibilidade). A cliente disse, com todas as letras,
que queria as duas coisas — *"opções talvez mais a curto prazo e também conhecer esse novo
empreendimento"* — e fechou com *"temos interesse sem compromisso em conhecer e conversar"*. Em
30/07: *"estamos em viagem. No retorno gostaríamos de conhecer os empreendimentos. Entro em
contato."*

Quinze dias depois, as três sugestões que chegaram na tela foram:

1. *"Tem interesse em começar pelo [lançamento] ou prefere ver também os prontos?"*
2. *"queria entender se o foco continua sendo moradia imediata ou os lançamentos… Posso agrupar os
   materiais principais pra facilitar a conversa com seu marido?"*
3. *"Tenho horários na próxima semana… prefere manhã ou tarde?"*

Cobrança do dono, em três tempos: **"Cadê as nossas regras de retomada?"**, depois o texto que ele
escreveu à mão pra mostrar o que queria receber, e por fim: **"ainda sim faltou a sugestão pra
visita, visto que já passei bastante informações, agora é necessário dar continuidade, e não
(ficar à disposição)"**.

## Os quatro buracos

**1. Perguntavam o que ela já tinha respondido — disfarçado de escolha.** A regra existia (item 3
da conferência final, v1263), mas o item 5 pede que a mensagem termine numa **escolha entre dois
caminhos**. A escolha mais fácil de escrever é "prefere o produto A ou o B?" — e era justamente a
pergunta já respondida. A IA cumpria um item quebrando o outro.

**2. A exceção do item 8 desligava o item 8 inteiro.** A v1267 proibiu mandar mais material pra
quem já recebeu tudo e mandou oferecer o presencial — com três exceções que diziam *"deixe as três
como estavam"*. "Cliente que não consegue ir agora" (a viagem) caía na primeira exceção, e aí caía
tudo junto: sem presencial e sem proibição de material, as mensagens voltavam a perguntar
preferência e a oferecer PDF ("posso agrupar os materiais principais?").

**3. Não existia regra pra pausa que o CLIENTE marcou.** Ela avisou da viagem e disse que chamaria
na volta. Isso não é silêncio nem desinteresse — é um compromisso com data implícita. O prompt
tinha regra de retomada por dias parados, mas nada que mandasse **puxar o acontecimento que ela
mesma contou** e transformar a volta em dia marcado.

**4. O pedido que partiu dela sumiu.** O primeiro atributo que a cliente levantou sozinha, sem
ninguém oferecer, foi *"E cobertura? Algo com espaço externo?"*. É o único critério que veio dela e
não do catálogo — e nenhuma das três sugestões tocou nisso.

## O que mudou

### Na conferência final (a lista curta que a IA lê por último)

- **Item 3** passou a pegar a *pergunta disfarçada de escolha*: se o cliente já disse que quer
  conhecer tudo, é proibido perguntar "prefere o A ou o B?" sobre os mesmos produtos — a mensagem
  parte da escolha já feita e oferece o roteiro que cobre o que ele pediu.
- **Item 4** ganhou o freio do interrogatório: no máximo **uma** pergunta por mensagem.
- **Item 5** deixou de legitimar o erro do item 3: escolha não pode reabrir assunto resolvido —
  quando o *que ver* já está decidido, a escolha que sobra é **dia, horário ou canal**.
- **Item 8** teve a proibição de material separada das exceções: *nenhuma* das três pode oferecer
  mandar, reunir, **agrupar**, organizar ou reenviar arquivo. As exceções mudam a **forma do
  encontro**, não a regra. E "marco de volta" deixou de ser exceção: caiu no item 9.
- **Item 9 (novo) — a pausa que o cliente marcou.** Quando foi ele quem disse que voltaria a falar
  depois de alguma coisa e esse momento chegou, a mensagem é a retomada dessa pausa, com três
  partes obrigatórias: (a) puxar o acontecimento que ele contou (*"como foi a viagem?"* — e nada de
  "espero que esteja tudo bem", que continua proibido); (b) trazer **a vantagem de decidir agora**,
  tirada da conversa ou do Cérebro (escolher unidade, andar, posição, vaga, personalizar planta,
  condição e preço da fase) — sem inventar escassez; (c) propor o encontro **com dia nomeado** da
  semana que vem e perguntar o horário. Fechado contra as saídas moles: "quando vocês voltarem",
  "me avisa quando puder", "quando ficar tranquilo pra vocês", **"fico à disposição"**. Está escrito
  lá: *quem já mandou muita informação não precisa se colocar à disposição, precisa dar
  continuidade — e continuidade é dia marcado*. A retomada tem um objetivo só: chegar ao encontro,
  sem preço, tabela, PDF ou vídeo junto.
- **Item 10 (novo) — o pedido que partiu do cliente.** Se ele levantou alguma coisa por conta
  própria, pelo menos uma das três precisa tocar nisso com as palavras dele. E se aquele pedido
  nunca foi respondido direito, respondê-lo é o melhor motivo de retomada que existe.

### Dois campos novos na análise — e na tela

- **"O que o cliente pediu por conta própria"** — a pergunta que ele fez sozinho, copiada com as
  palavras dele, mais o que o corretor respondeu (ou que ficou sem resposta).
- **"O que ainda falta descobrir"** — a lista curta do que a conversa não respondeu (por que querem
  mudar agora, prazo da mudança, onde moram hoje, tamanho, vagas, faixa, imóvel que entra no
  negócio). Com uma trava dita no próprio pedido à IA: **essa lista é a pauta do encontro, não um
  roteiro de perguntas pra despejar no WhatsApp**.

As duas linhas aparecem no bloco "Detalhes comerciais" do cliente e só quando têm conteúdo (mesma
regra das cinco linhas da v1259). Regra da v1145 respeitada: campo que não aparece na tela não é
pedido à IA.

## Conferência antes de publicar

- Suíte completa verde: 23 arquivos checados + 426 testes.
- Verificação visual no navegador de verdade (Chromium, app publicado em `public/`), com as duas
  linhas novas preenchidas com texto longo, em **390×844** e **1280×900**: as seis linhas cabem, o
  texto quebra certo, nada é cortado e nenhuma delas cria rolagem lateral.

## Testes

- `tests/v1271-retomada-da-pausa-marcada-pelo-cliente.test.mjs` (novo) — trava os quatro buracos:
  a pergunta disfarçada de escolha, a retomada em três partes, a proibição de material que
  sobrevive às exceções, o "à disposição" banido, o item do pedido espontâneo, e os dois campos
  novos (pedido à IA, gravação e tela).
- `tests/v1263-conferencia-final.test.mjs` — atualizado pra 10 itens.
- `tests/v1267-material-parou-chama-pra-ver.test.mjs` — atualizado: "deixe as três como estavam"
  agora vale só pra exceção da visita já marcada / material recém-enviado.

## Cuidado mantido

Nenhuma informação comercial cravada no código: nem empreendimento, nem construtora, nem preço,
nem nome de cliente. A vantagem da fase ("escolher a unidade, a vaga, a condição") só entra na
mensagem se estiver na conversa ou no Cérebro — os testes conferem isso.
