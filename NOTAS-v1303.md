# v1303 — o Cérebro passou a ir junto na hora de reescrever a mensagem

Print do dono de 18/08/2026 às 20h40, já rodando a v1302: **"que bela BOSTA!!! não sei pra que serve
todas aquelas regras do cérebro se não são usadas."**

Mesma conversa de duas linhas (a saudação automática do anúncio e o cliente perguntando "posso ter
mais informações sobre isso?"). As sugestões:

1. *"**Posso te passar** as opções disponíveis... Você tem **preferência por andar ou gostaria de ver
   todas as possibilidades?**"*
2. *"...**temos unidades de 3 suítes** com box duplo. **Prefere que eu te envie primeiro os valores
   ou gostaria de saber mais detalhes** sobre o apartamento?"*

## O buraco que a frase dele aponta em cheio

Quando uma sugestão é barrada, ela volta pra IA reescrever — e **é essa segunda escrita que aparece
na tela**. Essa segunda chamada estava recebendo **só a mensagem furada e regras genéricas**: sem o
Cérebro, sem tom, sem as regras do corretor e sem a conversa do cliente.

Ou seja: quanto mais a rede pegava, **mais texto escrito sem as regras dele** chegava na tela. As
regras estavam sendo usadas na análise e ignoradas exatamente no momento em que o texto final era
escrito.

**O que muda:** a reescrita passa a receber o **mesmo Cérebro** da análise (método, tom, diferenciais,
o que evitar, regras e objeções) e o **fim da conversa** com aquele cliente, para não trocar o
assunto nem o tom. O tempo dessa etapa subiu de 15 para até 20 segundos, dentro do mesmo orçamento
da análise — se não couber, nada é descartado e vale o texto original.

## Três coisas proibidas que estavam passando

- **"Posso te passar as opções..."** — é pedido de licença. A rede só pegava quando o ponto de
  interrogação vinha logo em seguida; no print ele vinha duas frases depois. Agora "posso te
  passar / mandar / enviar / detalhar / mostrar" cai sempre.
- **"temos unidades de 3 suítes"** — é o catálogo do prédio afirmado por conta própria (a v1302 já
  barrava "tem apartamentos de", mas não conhecia "temos", "dispomos de", "trabalhamos com").
- **"Prefere que eu te envie os valores ou gostaria de saber mais detalhes?"** — a regra **UM
  CAMINHO SÓ** está escrita no pedido desde a v1296 e nunca teve rede. Agora tem: pergunta com "ou"
  sobre **o que o corretor vai fazer** cai; pergunta com "ou" sobre **o que o cliente precisa**
  ("2 ou 3 dormitórios?", "morar ou investir?") continua livre, porque é justamente a qualificação
  que precisa acontecer — e oferecer dois horários pra marcar também continua livre.

Escolher o caminho é trabalho do corretor. Duas opções de formato dão ao cliente uma chance a mais
de adiar, e a resposta costuma ser "pode mandar tudo" — que é onde a conversa morre.

## O que continua igual

O código **não corta, não emenda e não substitui** texto (proibição do dono, v1247): ele percebe o
problema e devolve a mensagem inteira pra IA reescrever, agora com o Cérebro na mão. Reescrita que
falhar, demorar ou voltar ainda suja não entra — fica o texto original.

Guarda: `tests/v1303-cerebro-na-reescrita-e-um-caminho-so.test.mjs` — as duas sugestões do print caem
na rede, o pedido de reescrita precisa conter a regra e o tom do Cérebro e a conversa do cliente, e
seis perguntas boas de qualificação (inclusive "2 ou 3 dormitórios?" e a oferta de dois horários)
continuam passando.
