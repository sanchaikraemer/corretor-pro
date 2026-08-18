# v1295 — "Fico à disposição" não chega mais na sua tela

Print do dono, 18/08/2026 às 16h08. Cliente novo, conversa do mesmo dia: ele diz que olhou o
material, que gostou da ideia e que já ouviu por alto as condições de pagamento. A sugestão número 1
do app, a **Recomendada**, veio assim:

> "Que bom que gostou (...). **Fico à disposição** se quiser saber mais sobre alguma condição ou
> ponto do imóvel. Caso precise de algum detalhamento, me avise."

"Fico à disposição" é a **primeira frase da lista de frases proibidas** — a lista que o próprio dono
mandou recolocar no pedido feito à IA um dia antes (v1292: *"1 - entao recoloque"*). Ou seja: a
regra estava lá, escrita, e a frase passou por cima dela assim mesmo.

## O que muda pra você

Antes: o app pedia à IA que não usasse essas frases e, se ela usasse mesmo assim, a frase ia parar
na sua tela inteira — não havia mais nada depois disso.

Agora: quando uma das três sugestões volta com uma dessas frases, **o app devolve aquela mensagem
pra própria IA reescrever**, dizendo qual foi a frase proibida e mandando manter exatamente o mesmo
conteúdo e o mesmo próximo passo. Só o pedaço de robô sai; o assunto, a pergunta e a intenção da
mensagem continuam os mesmos. Você não vê nada disso acontecer — só recebe a sugestão já limpa.

As frases que disparam a reescrita são as mesmas que você já tinha listado:

- "espero que esteja bem / indo bem"
- "faz sentido", "se fizer sentido", "faça sentido"
- "fico à disposição", "estou à disposição", "me coloco à disposição"
- "qualquer dúvida estou aqui"
- "espero ter ajudado"
- "não hesite em"
- "sinta-se à vontade"
- "gostaria de saber se você teria interesse"
- palavra em inglês com equivalente óbvio em português (overview, feedback, budget, call,
  follow-up, timing, update, meeting e as outras da sua lista)

Continuam liberadas as palavras que são o nome da coisa no mercado — studio, loft, duplex, garden,
closet, playground, home office, coworking, hall, fitness — e nome próprio de empreendimento,
construtora, bairro e rua.

## O que NÃO foi feito (e não vai ser)

- **Ninguém corta pedaço do texto da IA.** O corte automático de frase proibida (aquele que fazia
  cirurgia no texto e às vezes trocava a mensagem de verdade por frase genérica) saiu na v1247 a
  seu pedido e **não voltou**. Aqui quem reescreve a mensagem é a IA, inteira.
- **Nenhuma análise é descartada.** Se a reescrita falhar, não couber no tempo da importação ou
  voltar pior do que estava, vale o texto original da IA. Você nunca fica sem as três sugestões por
  causa disso.
- **Nenhuma regra do seu Cérebro mudou.** Quem manda no método, no tom e na estratégia continua
  sendo o seu Cérebro. A lista de frases proibidas não trata de tom: trata de marca de robô.

## Custo e tempo

A segunda passada só acontece quando a frase escapa mesmo — em análise limpa, nada muda. Ela usa o
modelo rápido, com o tempo que sobra dentro do mesmo orçamento da importação (se sobrar menos de 8
segundos, ela nem tenta e a mensagem original passa). O gasto entra na sua conta de uso de IA como
qualquer outra chamada, e o registro da análise passa a guardar quantas sugestões precisaram ser
reescritas — assim dá pra medir se o pedido está segurando sozinho ou não.

## Testes

- Novo: `v1295-frase-de-robo-nao-chega-na-tela` — usa o texto exato do print. Confere que a frase é
  reconhecida, que mensagem boa não é acusada à toa (inclusive com "studio duplex" e "home office"),
  que a mensagem volta pra IA e chega limpa na tela, e que erro/vazio/reescrita pior deixam o texto
  original de pé.
- `v852-cerebro-integridade` teve uma frase de exemplo trocada: o teste é sobre o modo prévia e a
  mensagem de exemplo usava justamente "fico à disposição", o que agora dispara a reescrita.
- `v1280-nada-de-palavra-em-ingles` continua cobrando que a lista siga escrita no pedido à IA e que
  o corte determinístico não tenha voltado.

Suíte inteira verde: 29 arquivos checados + 449 testes.
