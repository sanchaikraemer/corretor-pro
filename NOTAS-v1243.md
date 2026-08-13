# NOTAS v1243 — leitura do contexto e formulação das sugestões

Data: 13/08/2026. Print do dono com um contato que é **parceiro de leilão e amigo de anos**:

> "veja q bosta de sugestoes, nada a ver com o contexto"

E, quando eu comecei a mexer em tamanho de histórico em vez do problema:

> "o problema nao é tempo de historico, é a analise do conteto e formulações das sugestoes. ja te
> falei mil vezes pra prestar a atencao nisso q é o principio de tudo... pare de enrolar e inventar
> coisa e aja no problema"

Ele estava certo nas duas vezes.

## O que a conversa tinha, e o que o app fez

Nos últimos **dois meses** existiam **três assuntos vivos ao mesmo tempo**:

| Quando | Assunto | Situação |
|---|---|---|
| 08/07 | O **pai** dele quer visitar o escritório do contato quando passar o inverno | O contato passou o endereço: *"vamos falando mais perto qdo esquentar"*. Hoje é agosto. |
| 29/07 | **Leilão**: proposta de 825 mil, esperando o juiz homologar | O corretor disse que ia levar a oportunidade pros chefes. Dez dias depois: homologou? |
| 03/08 | **Renaissance** | *"dei uma olhada... vamos falar na semana que vem"* / *"Combinado"*. A semana passou. |

O app sugeriu **três variações da mesma coisa**: *"passou a semana, quer ver planta ou simulação?"*
— e em registro formal (*"Bom dia Thume, tudo certo?"*) com alguém que ele trata por **"mano"**,
**"kambio"**, **"blzzz"**, **"abss"**.

## Os dois defeitos, os dois no código

**1. A leitura só enxergava UM fio.** O campo `ondeParou` era singular — "onde a conversa parou".
Numa conversa com três assuntos abertos, ele colapsava no assunto da **última mensagem**, e os
outros dois sumiam **antes** de a IA sequer poder escolher. Sobrava justamente o fio mais fraco: o
material que já tinha sido mandado.

Agora `ondeParou` exige **todos** os fios, com data: o que o cliente prometeu, o que o corretor
prometeu, **o que depende de terceiro** (o juiz do leilão, uma pessoa da família) e **o que não é
venda** (uma visita combinada, um assunto pessoal que ele mesmo trouxe).

E `comoConduzir` passou a ter que **escolher entre os fios e dizer por quê** — com uma regra que
sai direto do caso dele: um assunto onde **a bola está com o outro lado** (um resultado que ele
espera, uma decisão de terceiro, um prazo que ele mesmo marcou) quase sempre reabre melhor do que
empurrar de novo o material já enviado. É o que ele tem vontade de responder.

**2. O tratamento.** As mensagens **dele** já iam no pedido — e iam certinhas (*"blzzz. valeu mano,
abss"*, *"Buenas, na escuta kambio"*). Mas registro é coisa de **dois**: sem ver como o **cliente**
fala com ele, o modelo caía no padrão comercial. Agora vai um bloco com as falas do contato
(*"kambio. bom dia mano"*, *"Buenas mano!"*) e uma regra dura: usar com aquela pessoa o mesmo
tratamento que os dois já usam entre si — nada de abertura de atendimento comercial quando a
conversa inteira mostra outra coisa.

**Bônus, achado no caminho:** a instrução que manda escrever no jeito dele dizia *"as mensagens
reais dele que você recebeu **acima**"* — e o bloco de exemplos vem **abaixo** dela no pedido. A IA
procurava a régua da voz onde ela não estava. Corrigido: aponta pro bloco pelo nome.

## O que eu fiz de errado no meio do caminho

Ele escreveu *"considere somente conversas desse ano"* falando da **análise daquele print**, e eu
entendi como regra de sistema: cheguei a implementar um filtro por ano no pipeline. Ele corrigiu na
hora — *"nao a nivel de sistema, o sistema deve ler sempre todo historico do cliente"* — e o filtro
foi **desfeito por inteiro** no mesmo dia. O histórico integral da v1241 continua valendo, e o
teste tranca que esse filtro não volte por engano.

## Validação

- Versão: `7.1243.0` / exibida **1243**.
- Novo teste `tests/v1243-contexto-e-formulacao.test.mjs`, montado com a **conversa real dele** —
  os três fios, o registro dos dois lados, e a garantia de que o histórico continua inteiro.
- `tests/v1212-…` atualizado: a fala do cliente agora tem bloco próprio; o que aquele teste
  protegia (não contaminar os exemplos de voz DELE) continua trancado, agora medido no bloco certo.
- `npm test` inteiro verde (409 testes).
