# v1255 — as três sugestões passam a conduzir o atendimento, não a fazer check-in

Veio da análise da conversa real da lead **Rose** (Renaissance, casa suspensa) e de duas ordens
diretas do dono.

## O caso

Em 05/06 a Rose se interessou pela casa suspensa, **apontou as unidades da parte alta** e ainda
perguntou se podia **entrar com uma casa central em permuta** — o sinal de compra mais forte da
conversa inteira. Depois vieram 42 dias de silêncio e dois follow-ups quase idênticos, os dois
abrindo com *"Faz alguns dias que conversamos…"*.

As três sugestões que o app deu em cima disso:

1. **"Recomendada"** — *"Passaram alguns dias desde nossa última conversa… Tudo certo por aí?
   Posso ajudar em alguma etapa agora?"*
2. **"Alternativa"** — *"…me fala. Sigo à disposição para quando precisarem."*
3. **"Direta ao ponto"** — oferecia a simulação, mas pedindo permissão.

Nenhuma usava o relógio que existia na própria conversa: **"o lançamento será em agosto"**, com
pré-reserva garantindo as melhores unidades.

## O que mudou

### 1. Falar do tempo parado está proibido — em qualquer forma

Ordem do dono: *"não quero q use os dias. e vc deveria perceber q isso é um erro tb e nem sugerir."*

Ele está certo, e a correção que eu tinha proposto (usar o número certo de dias) estava errada:
**dizer "faz 42 dias" é pior do que dizer "faz alguns dias"**. Falar do intervalo é cobrança — põe
o cliente na defensiva e faz a mensagem girar em torno da espera do CORRETOR, não do interesse do
CLIENTE.

Ficaram proibidas: *"faz alguns dias"*, *"faz um tempo"*, *"faz X dias/semanas/meses"*, *"passaram
alguns dias"*, *"desde nossa última conversa"*, *"há quanto tempo"*, *"você sumiu"*, *"não tive
retorno"*, *"estou aguardando seu retorno"*, *"tentei falar com você"*.

O intervalo continua existindo como dado **interno** — é ele que faz o cliente aparecer na fila do
dia. Só não entra no texto da mensagem.

### 2. Prazo real do produto é o melhor motivo pra voltar a falar

Lançamento, pré-reserva, entrega, validade de tabela, etapa de obra: quando existe uma data dessas
na conversa ou no Cérebro, ela é comparada com o dia de hoje e vira o motivo da retomada. É um
fato **novo**, vem de fora da relação (não é cobrança) e explica sozinho por que a mensagem está
chegando agora.

**Com trava:** só vale prazo que esteja **literalmente** na conversa ou no Cérebro. Está proibido
inventar ou inflar urgência — *"últimas unidades"*, *"os valores vão subir"*, *"a condição termina
essa semana"*, *"estão acabando"*. Urgência inventada queima a confiança do cliente e é pior do
que não mandar mensagem nenhuma.

### 3. As três mensagens agora têm espinha de condução

Pedido do dono depois de ler uma mensagem escrita à mão que ele aprovou: *"queria q as demais
fossem assim tb, ou seja, lendo o contexto todo e analisando racionalmente em como conduzir nas 3
sugestões"*.

Os três ângulos (recomendada / mais suave / mais direta) continuam existindo — eles mudam o **tom**
e o **caminho**. O que mudou é que agora as três seguem a mesma estrutura obrigatória:

1. **Abre por um fato concreto da conversa** — o prazo do produto, o que ficou pendente, a unidade
   que o próprio cliente escolheu, a resposta que ele nunca recebeu. Nunca por *"tudo bem por
   aí?"* nem por *"queria saber se ainda tem interesse"*.
2. **Destrava o que está parado**, com um passo que o cliente faz em segundos (mandar um endereço,
   escolher entre duas opções, confirmar um dado) — e dizendo pra que serve **do ponto de vista
   dele** (*"assim você decide com o valor na mão"*), não do corretor.
3. **Fecha com um próximo passo que tem dono e formato.** Encontro vem com **duas opções**
   ("quinta às 18h ou sábado de manhã?"). *"Qualquer dia e horário"*, *"quando quiser"* e *"é só me
   chamar"* fazem o contrário: empurram a decisão pro cliente, e ele não decide.

E ficou escrito o teste prático: **se a mensagem, tirando a saudação, couber em "e aí, tudo bem?
qualquer coisa me chama", ela está errada** — não importa qual dos três ângulos ocupa. A "mais
suave" é de baixa **pressão**, não de baixo **conteúdo**.

### 4. Quem decide junto deixa de ser cobrança

Quando a conversa cita esposo, esposa, sócio, filho ou pai, está proibido perguntar *"conseguiu
falar com seu esposo?"* / *"o que ele achou?"* — isso empurra o cliente pra uma conversa que o
corretor não controla e devolve a decisão pra fora.

No lugar disso, a mensagem entrega **algo que facilite a conversa entre os dois** (um número, uma
comparação, uma simulação, uma unidade separada) ou inclui a pessoa no próximo passo de forma
natural (*"consigo receber vocês dois"*).

### 5. O que o cliente escolheu é por onde a retomada começa

Se ele apontou uma unidade, metragem, posição ou planta ("essa aqui", "a da parte mais alta"), é
por aí que a mensagem volta. Voltar ao nome genérico do empreendimento depois que ele já escolheu
dentro dele é andar pra trás — e é o que faz a mensagem parecer disparo em massa. Sem recitar de
volta os números que ele já sabe (regra que já existia).

## Cuidados mantidos

- Nenhuma informação comercial cravada no código: nem valor, nem empreendimento, nem prazo, nem
  nome de pessoa. Tudo continua vindo do Cérebro e da própria conversa.
- Todas as regras entraram no prompt de quem **TEM Cérebro** — nunca só no modo prévia (regra da
  v1247). O teste verifica isso de propósito, comparando a posição das regras no arquivo.
- As regras são concretas e verificáveis (frases proibidas, estrutura em 3 passos), não
  meta-instruções do tipo "o Cérebro decide" — que foi o erro da v1240.

## Teste

`tests/v1255-tres-mensagens-conduzem.test.mjs`, com a linha do tempo da conversa da Rose escrita
por extenso e as cinco regras trancadas uma a uma.
