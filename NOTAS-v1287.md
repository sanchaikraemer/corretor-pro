# v1287 — a observação colada vira conversa, e acabou o chute de data

Dono, 17/08/2026, de manhã, com o print das três sugestões da conversa da Geovana (Quality
Residence) e o histórico inteiro do WhatsApp ao lado:

> *"coloquei uma obs importante agora a pouco e reanalisei, porem isso nao foi considerado nas
> sugestoes… o sistema precisa fazer uma leitura geral e entender a situação pra conduzir - e não
> só ficar 'chutando' jeitos de responder… OUTRA COISA, PARE DE CHUTAR DATAS PARA AGENDAMENTO,
> ISSO ESTA INCOMODANDO AS MINHAS PROGRAMAÇÕES ESSES TEUS CHUTES DE DATAS. E TAMBEM EU NAO ENVIEI
> NADA DE OPÇÕES APOS A MENSAGEM DELA, E AS SUGESTOES DE RESPOSTAS ESTAO INCOERENTES."*

E, no fim da conversa: **"acabe com isso então."**

## O caso

A cliente é de 2024. Passou por Quality, Evolutti, Renaissance e terreno. Em 14/08/2026 ela virou a
chave sozinha:

- **14/08, 17:06 — cliente:** *"Oi. Boa tarde, mudança de planos"* / *"Apartamento"*
- **14/08, 20:49 — cliente:** *"Oi. Sim"* (aceitando ver opções)
- **15/08, 13:15 — corretor:** pergunta o perfil (2 ou 3 dormitórios, pronto ou planta)
- **15/08, 18:12 — cliente:** *"procuro apartamento de 2 dormitórios, sacada e boa iluminação,
  próximo ao HCC, com financiamento"*

Domingo o corretor não quis importunar. Segunda de manhã ele colou esse trecho no campo de
Observação (o WhatsApp ainda não tinha sido reexportado), somou uma segunda observação — *"não quis
responder importunando ela no domingo, vamos retomar agora"* — e reanalisou.

As três sugestões que voltaram:

1. *"Das conversas e materiais que já te enviei, **reuni algumas opções** de apartamentos com 2
   dormitórios… Consigo te receber na **quarta à tarde ou sábado de manhã**."*
2. *"Se ficou alguma dúvida sobre **as opções que te apresentei**…"*
3. *"Já organizo as melhores opções… Tenho agenda para visita na **quarta à tarde ou sábado de
   manhã**."*

E o diagnóstico ao lado dizia **"impedimento principal: silêncio após o pedido específico, não
confirmou interesse em conhecer opções nem recusou"** — sobre a cliente que tinha acabado de
responder quatro vezes em três dias.

Três erros, um print só: **inventou datas na agenda do corretor**, **afirmou envios que nunca
aconteceram** e **tratou como calada a cliente mais engajada do ano**.

## A causa (medida, não deduzida)

Rodando o próprio código com essa conversa, o pedido que saiu para a IA continha, escrito assim:

> `TENTATIVAS DO CORRETOR AINDA SEM RESPOSTA: 4. O cliente não respondeu nenhuma delas.`

Porque **toda observação entra na análise como um recado DO CORRETOR**. O trecho colado — que era a
conversa continuando, com a fala mais importante da cliente dentro — não contava como fala dela.
Para o sistema, a última palavra ainda era do corretor, e o silêncio era dela.

A partir daí a IA obedeceu, corretamente, a uma regra dura que existe desde a v1277:

> *"duas ou mais tentativas sem resposta = mudar de caminho. Pelo menos uma das três precisa propor
> pessoa a pessoa — ligação, visita, encontro — com duas opções concretas de dia ou horário."*

Ou seja: **o chute de data e o "impedimento: silêncio" não foram invenção solta da IA — foram
consequência de um fato errado.** E o "já te enviei opções" veio do mesmo lugar: a observação é
apresentada à IA como *"fato confirmado de coisa feita fora do WhatsApp"* (regra da v986, feita
para quando o corretor manda um print ou áudio por fora), e junto existe a trava que proíbe
afirmar que faltou entregar algo só porque não aparece no texto. Com uma observação que na verdade
era a conversa continuando, as duas regras se atropelaram e a IA concluiu que as opções já tinham
saído.

Sobre as datas, ainda: o chute **não era deslize de redação**. Dez trechos do pedido mandavam
cravar dia e hora — *"ofereça DUAS opções concretas (quinta às 18h ou sábado de manhã?)"*, *"DIA
NOMEADO da semana que vem (segunda-feira fica bom pra vocês?)"*, *"dois dias/horários concretos"*.
Foram escritos entre a v1255 e a v1279 para matar o *"fico à disposição"*, que também não vende.
Resolveram um problema criando outro: a IA passou a marcar compromisso na agenda de uma pessoa cuja
agenda ela não conhece.

## O que mudou

### 1. Observação que É conversa colada passa a valer como conversa

`expandirObservacoesColadas` (`api/_pipeline.js`) roda **antes de qualquer conta** da análise:
reconhece os formatos que o WhatsApp gera no "copiar mensagens" do celular
(`[16:34, 14/08/2026] Fulano: texto`, `[17:06] Fulano: texto` herdando a data anterior, e os dois
formatos do arquivo exportado), separa cada fala, atribui o lado e encaixa tudo na ordem certa do
histórico. Mensagem que já veio na importação não duplica.

É leitura de **formato**, não interpretação: nada é reescrito, nenhum juízo comercial é feito, e
**o que está guardado no banco não muda** — a observação continua lá, inteira, do jeito que foi
salva. Uma anotação comum ("já mandei outra opção por imagem") não casa com formato nenhum e
continua sendo anotação, como sempre foi. Essa é a linha que o teste guarda.

Com isso, os números que vão para a IA passaram a bater com a realidade desta conversa:

| | antes | depois |
|---|---|---|
| tentativas do corretor sem resposta | 4 | 0 (a última palavra é da cliente) |
| dias parados | 0 (a observação de hoje zerava o relógio) | 2 (a última mensagem real é de 15/08) |
| última pessoa a falar | corretor | cliente |

Junto veio uma correção pequena e da mesma família: **anotação do corretor deixou de contar como
mensagem** no cálculo de tempo parado (`ehMensagemRealParaTempo`). Salvar uma observação hoje
zerava o "dias sem falar" como se o cliente tivesse escrito hoje.

### 2. REGRA DA DATA — quem dá o dia é o cliente

Os dez trechos que mandavam cravar dia e hora foram substituídos pela **pergunta do dia**, e entrou
uma regra dura nova no pedido:

- **PROIBIDO** nomear dia da semana, data de calendário ou hora — em qualquer das três mensagens.
- **As duas únicas exceções:** o dia/hora que **já está escrito na conversa** (o cliente pediu, ou o
  encontro já foi combinado ali) ou que está **no Cérebro** (plantão, dia fixo de visita que o
  corretor cadastrou).
- **No lugar entra:** *"qual dia da semana costuma ser melhor pra você?"*, *"que dia fica bom pra
  você essa semana?"* — o cliente responde com um dia em que **ele** pode, e o corretor confirma em
  cima da agenda real dele.
- **O vago continua proibido:** *"quando quiser"*, *"me avisa"*, *"fico à disposição"*, *"é só me
  chamar"*. A diferença está escrita no pedido: pergunta fechada pede resposta objetiva; deixar em
  aberto não pede nada e por isso não recebe nada. **Perguntar o dia é conduzir; chutar o dia é
  atrapalhar.**

### 3. A única pergunta que destrava (item 4 da conferência final)

Veio da leitura que outra IA fez da mesma conversa e que o dono trouxe: com o critério do imóvel já
entregue, o que ainda trava a seleção é **financeiro** — faixa de valor e entrada. A própria
análise já sabia disso (aparecia em "o que ainda falta descobrir"), mas nenhuma das três mensagens
executava.

Agora o item 4 diz qual é a única pergunta que vale nesse caso, **emendada no que o corretor está
fazendo agora** ("vou separar só o que atende isso; pra fechar a seleção, em que faixa de valor
você pretende investir e quanto imagina usar de entrada?") — nunca solta e nunca no lugar da
entrega. Continua proibido perguntar renda, repetir o que o cliente já respondeu, e refazer essa
mesma pergunta financeira se ela já foi feita e ficou sem resposta.

A regra foi **dobrada dentro do item 4, não criada como item 13**: a lição da v1263 é que a
conferência só funciona enquanto for curta, e o teste confere de propósito que ela continua com
doze itens.

## Como isto fica protegido

- `tests/v1287-observacao-colada-vira-conversa.test.mjs` — os formatos colados, a linha que separa
  conversa de anotação, a não-duplicação, e os três números do caso real (4 → 0 tentativas,
  0 → 2 dias, corretor → cliente na última fala).
- `tests/v1287-nenhuma-data-chutada.test.mjs` — varre o pedido inteiro e falha se qualquer trecho
  voltar a mandar cravar dia/hora; confere também que o remédio não virou o veneno antigo (o vago
  segue reprovado) e que as exceções legítimas continuam de pé.
- `evals/conversas/09-observacao-colada-e-conversa.json` — a situação inteira virou a 9ª conversa da
  bateria (nome trocado, sem dado de cliente real). A camada 1 já a confere de graça na suíte; a
  camada 2, quando rodar com a chave da OpenAI, cobra que as mensagens não marquem data, não digam
  que já enviaram nada e tragam a pergunta do valor emendada na entrega.
- A bateria (`tests/v1283-…`) passou a expandir observação colada antes de conferir, igual à
  análise, e a ignorar anotação na hora de decidir quem falou por último.

## O que NÃO mudou

- Nenhuma mensagem é reescrita por código. A rede contra o chute continua sendo a regra dentro do
  pedido — o corte determinístico de frase segue banido desde a v1247.
- Nenhuma informação comercial entrou no código: a proibição de data é sobre **inventar**, e o que
  o corretor cadastrar no Cérebro (plantão, dia de visita) continua valendo normalmente.
- O que está salvo no banco continua igual: a expansão acontece só na leitura, dentro da análise.
