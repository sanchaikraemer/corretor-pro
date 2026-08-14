# v1261 — abrir entregando, não pedindo; e a "Recomendada" volta a ser a mais forte

Terceira reanálise da lead **Marina**, agora com a v1260 no ar.

## O que a v1260 resolveu

Sumiu das três o "assim que você tiver o valor, eu te mando". E o que se pede à cliente virou
**dado fácil** — bairro, metragem, dormitórios — em vez da conta impossível ("quanto pretendem
investir na diferença"). A quota também funcionou: a nº 3 finalmente ofereceu **"já posso avaliar
seu imóvel"**.

Isso é o essencial da negociação destravado.

## O que sobrou — dois defeitos de ORDEM

**1. As três abrem pedindo.**

| # | Como começava |
|---|---|
| 1 | "para poder filtrar as melhores opções... **só preciso** de alguns dados" |
| 2 | "**Se quiser**, posso te ajudar... **Me sinaliza** só o básico" |
| 3 | "**Se te ajudar**, já posso avaliar... **Me manda** só o bairro" |

O cliente lê um **pedido** antes de ler qualquer **ganho**. Pedido sem ganho na frente é ignorado.

**2. A melhor mensagem ficou em terceiro.**

A jogada mais forte da conversa — o corretor avaliar o imóvel da cliente — caiu na nº 3. A
"Recomendada" é justamente a que o corretor manda quando só pode mandar uma, e ela ficou sendo a
mais fraca das três.

## O que mudou

### Nenhuma das três pode abrir pedindo

A primeira frase é sempre **o que o corretor vai fazer, entregar ou levantar**. O que ele precisa
do cliente vem depois, emendado e curto.

> **Errado:** "Pra filtrar as opções, só preciso do bairro e da metragem."
> **Certo:** "Já vou separar as opções de 3 dormitórios que aceitam troca — me passa o bairro e a
> metragem que eu junto a avaliação do seu."

Mesma pergunta, ordem invertida. A pergunta não some: ela sai da frente.

Também saíram os "se quiser", "se te ajudar", "se for mais prático" e "pode ser assim?". Pedir
licença pra trabalhar enfraquece a oferta — **o corretor faz porque é o trabalho dele, não porque
foi autorizado.**

### A "Recomendada" é a mais forte das três, sempre

Se uma das três oferece algo concreto (a avaliação, o envio de opções, uma visita) e as outras só
pedem informação, **a que oferece passa a ser a nº 1**. Ficou proibido enterrar a jogada mais forte
em segundo ou terceiro lugar.

E ficou uma conferência antes de fechar: *"se eu só pudesse mandar UMA, seria essa?"* — se a
resposta for não, troca a ordem.

## Onde as regras ficam

As duas entraram **antes** da quota da v1260 (a que obriga uma das três a oferecer a avaliação).
A ordem importa: a IA precisa ler "a recomendada é a mais forte" **junto** com "uma das três tem
que oferecer a avaliação" — senão continua criando a mensagem forte e deixando ela em terceiro,
que foi exatamente o que aconteceu. O teste verifica essa ordem.

## Cuidados mantidos

- Nenhuma informação comercial cravada no código — verificado por teste.
- No prompt de quem **TEM Cérebro**, nunca só no modo prévia (regra da v1247).
- Regras com exemplo concreto (par errado/certo, lista de aberturas proibidas), não meta-instrução
  (erro da v1240).

## Teste

`tests/v1261-abrir-entregando-e-recomendada-mais-forte.test.mjs`, com as três sugestões reais
citadas por extenso e as aberturas que elas usaram travadas como proibidas.
