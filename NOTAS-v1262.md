# v1262 — o fecho da mensagem deixa de pedir licença

Quarta reanálise da lead **Marina**, com a v1261 no ar (subiu 9 minutos antes). O dono circulou
duas coisas: a sugestão nº 1 terminando em *"Fico no aguardo desse dado pra seguir, pode ser
assim?"* — e o meu próprio texto dizendo que eu já tinha cortado o "pode ser assim?".

Ele está certo: eu disse que tinha cortado, e não tinha.

## O que a v1261 resolveu

As três passaram a **abrir pelo que o corretor faz** ("já posso montar uma lista", "posso ir
antecipando", "já consigo avaliar"), e a jogada mais forte — oferecer a avaliação do imóvel —
subiu da nº 3 para a **nº 1**. As duas mudanças pegaram.

## Por que a proibição do "pode ser assim?" NÃO pegou

Não foi a IA desobedecendo. **Eram duas regras minhas brigando dentro do mesmo prompt**, em lugares
diferentes:

- Uma regra antiga e forte manda: *"fecho longo é marca de IA: termine curto ('o que acha?',
  'consigo separar?')"*.
- A proibição da v1261 estava lá longe, no meio do bloco de condução.

"Pode ser assim?" **é curto e é pergunta** — encaixa perfeitamente na regra do fecho curto. A IA
obedecia a regra que estava mais perto do que ela estava escrevendo, e a minha proibição, isolada
noutro canto, perdia a disputa.

**A correção foi feita dentro da regra do fecho curto**, colada nela — não em outro lugar. Se as
duas não forem lidas juntas, a briga se repete. O teste verifica que elas estão coladas.

## O que mudou

### 1. Fecho curto continua obrigatório — mas não pode ser pedido de licença

Proibidos: *"pode ser assim?"*, *"pode ser dessa forma?"*, *"tudo bem assim?"*, *"posso seguir?"*,
*"te parece bem?"*, *"combinado assim?"*. E, na abertura: *"se quiser"*, *"se preferir"*, *"se te
ajudar"*, *"se for mais prático"*.

**Ninguém responde "não pode" a essas perguntas.** Elas não decidem nada, só devolvem a bola e
enfraquecem tudo o que veio antes.

E — isto é o que faltava na v1261 — ficou dito **o que entra no lugar**, senão a IA fica sem fecho:

- uma escolha entre duas coisas de verdade: *"prefere quinta ou sábado?"*
- uma pergunta que puxa informação útil: *"qual chega mais perto do que vocês querem?"*
- a confirmação de um passo em andamento: *"te mando ainda hoje?"*

### 2. Escolha falsa não vale

A nº 3 fechava com *"Prefere me passar agora por mensagem ou pode me enviar depois por aqui?"*.
As duas opções são **o mesmo caminho em dois tempos** — e o cliente escolhe "depois", que quer
dizer nunca.

As duas opções de uma escolha precisam ser realmente diferentes: canal, dia ou formato distintos.

### 3. Declarar a espera é a mesma coisa que condicionar

A v1260 proibiu *"assim que você tiver o valor, eu te mando"*. Voltou numa forma que eu não tinha
listado: *"Fico no aguardo desse dado pra seguir"*. Em vez de condicionar, **declara** a espera —
com o mesmo efeito de parar o corretor até o cliente agir.

Entraram na mesma proibição: *"fico no aguardo desse dado pra seguir"*, *"aguardo seu retorno pra
avançar"*, *"assim que me passar eu sigo"*, *"fico esperando pra dar sequência"*.

## Cuidados mantidos

- Nenhuma informação comercial cravada no código — verificado por teste.
- A regra do fecho é de LINGUAGEM: fica no prompt de sistema, junto das outras. A da espera é de
  CONDUÇÃO: fica no prompt que recebe o Cérebro (regra da v1247). O teste confere os dois lugares.

## Teste

`tests/v1262-fecho-nao-pede-licenca.test.mjs` — trava os fechos proibidos, os fechos que valem, a
escolha falsa, as formas que declaram espera, e **a proximidade entre a proibição e a regra do
fecho curto**, que foi a causa real da v1261 não ter pegado.
