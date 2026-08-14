# v1260 — a entrega deixa de ficar refém de um dado que o cliente ainda vai buscar

Veio da reanálise da lead **Marina** com a v1259 no ar, pedida pelo dono.

## Metade melhorou

Nas três novas sugestões **sumiu**: o "faz alguns dias", o "tudo bem por aí?", o "fico à
disposição" e o "conseguiu falar com seu esposo?". Nenhuma exige mais a faixa de valor como
pergunta seca. Isso é o efeito das v1255 a v1259 funcionando.

## Metade falhou — e eram regras minhas que não pegaram

O que a reanálise devolveu:

| # | O que dizia |
|---|---|
| 1 Recomendada | *"**Assim que vocês tiverem uma ideia do valor** do imóvel, posso te mandar as opções... **Me sinaliza assim que conseguir** aí?"* |
| 2 Alternativa | *"...posso ir te mostrando algumas opções... **Quer já ir olhando** esses exemplos?"* |
| 3 Direta ao ponto | *"**assim que você conseguir o valor** do imóvel, já consigo separar... **Me avisa quando souber**, que eu já te envio."* |

As três continuavam com a entrega **presa a um dado que a cliente ainda ia buscar**. E a nº 3, que
devia ser a mais objetiva, virou a mais passiva das três: o corretor sentado esperando.

Pior: **nenhuma ofereceu o óbvio** — o corretor avaliar o imóvel dela. A regra da v1256 já mandava
fazer isso, mas estava escrita só como proibição no meio de um parágrafo ("é proibido pedir a
diferença"). A IA obedecia a proibição e parava aí, sem fazer a parte positiva.

## O que mudou

### 1. "Assim que você tiver X, eu te mando Y" está banido

É a forma disfarçada de segurar a entrega, e **nenhuma das três** pode usar, em nenhuma variação:
*"assim que você tiver/conseguir/souber o valor, eu te mando"*, *"me avisa quando souber que eu já
envio"*, *"me sinaliza assim que conseguir"*, *"quando você tiver esse número eu separo"*.

Todas deixam **dever de casa com o cliente** e o corretor parado — a conversa morre exatamente aí,
porque quem tem que agir é quem menos quer agir.

E ficou um teste prático que a IA aplica antes de escrever cada mensagem: **se ela só acontece
depois que o cliente fizer alguma coisa, está errada.** Reescreve começando pelo que o corretor
faz agora, sem depender de ninguém.

### 2. Quota: pelo menos uma das três oferece a avaliação

Quando o cliente entra com imóvel na negociação e o valor dele ainda não foi dito, **pelo menos uma
das três mensagens precisa oferecer que o corretor faça a avaliação**, pedindo só o que é fácil de
dar (endereço, bairro, metragem, dormitórios, uma foto). E nenhuma das três pode ficar esperando o
cliente descobrir esse valor sozinho.

Virou exigência com quantidade, não conselho — dá pra conferir olhando as três mensagens.

## Bug de fuso horário achado no caminho

A suíte quebrou num teste que não tinha nada a ver com esta mudança, e o rastro levou a um defeito
real no app.

**No teste:** ele montava as datas no relógio da máquina (que roda em UTC). Depois das 21h no
Brasil, "hoje" no servidor já era amanhã — então o teste falhava **toda noite**, das 21h à
meia-noite, sem nenhum motivo ligado ao código.

**No app:** `cp1168TsDeHojeComHora` — a função que transforma "17h" escrito no compromisso em
horário pra ordenar a faixa de hoje — usava **o relógio do aparelho**, enquanto tudo em volta usa
o dia de **Brasília** (corrigido na v1248). Com o celular em outro fuso, o compromisso das 17h
caía fora da janela de hoje e ia parar no **fim** da lista — atrás até dos itens sem hora nenhuma,
que é o contrário do que a v1168 quis fazer.

Os dois foram corrigidos, e a suíte agora passa em UTC, em Brasília e em Tóquio.

## Cuidados mantidos

- Nenhuma informação comercial cravada no código — verificado por teste.
- Regras no prompt de quem **TEM Cérebro**, nunca só no modo prévia (regra da v1247).
- Exigências verificáveis sobre o resultado (frases banidas, quota de uma em três), não
  meta-instrução (erro da v1240).

## Testes

- `tests/v1260-entrega-nao-fica-de-refem.test.mjs` — trava as frases que a reanálise real produziu
  como proibidas, o teste prático e a quota da avaliação.
- `tests/v1168-painel-admin-sino-e-agenda-hoje.test.mjs` — datas ancoradas no dia de Brasília, e a
  ordem cronológica volta a valer com a correção do app.
