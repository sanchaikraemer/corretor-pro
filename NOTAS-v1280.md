# v1280 — "overview" e o balanço de recusas saem das mensagens

Duas correções, dos dois prints que o dono mandou no mesmo dia.

# Parte 1 — "overview" e o resto do inglês

## O que aconteceu

O dono mandou o print das três sugestões do lead Claudia (Renaissance). A sugestão 2 terminava
assim:

> "...Assim posso te dar um **overview** mais prático do que faz sentido para você."

Reação dele: "overview??? hahahahahahahaha".

Ele tem razão: corretor nenhum escreve "overview" pra um cliente no WhatsApp. A palavra em inglês
entrega na primeira linha que aquilo não foi escrito por uma pessoa — o mesmo estrago das frases
prontas que já eram proibidas ("fico à disposição", "espero que esteja bem", "não hesite em").

## Por que passava

O pedido enviado à IA já tinha a lista "LINGUAGEM DE IA — PROIBIDO", mas ela cobria só clichê em
**português**. Palavra em inglês e jargão de escritório não estavam proibidos em lugar nenhum — a
IA achava que estava sendo profissional ao escrever "overview", "insight", "feedback", "call".

## O que mudou

Entrou uma regra nova no pedido, ao lado da lista antiga:

- Palavra em inglês com equivalente óbvio em português está proibida na mensagem — e a regra já
  diz o que escrever no lugar (overview = uma ideia geral/um resumo; feedback = retorno;
  call = ligação; budget = quanto pretende investir; follow-up = retomar o contato;
  timing = momento; update = novidade; meeting = reunião).
- Jargão corporativo em português cai junto: "alinhar expectativas", "validar com você",
  "estruturar o processo", "de forma assertiva", "agregar valor", "solução personalizada".
- **A exceção**, escrita de propósito pra regra não estragar nada: nome próprio (empreendimento,
  construtora, bairro, rua) e o vocabulário que já é assim no mercado imobiliário brasileiro —
  studio, loft, duplex, garden, closet, playground, home office, coworking, hall, fitness —
  continuam como são, quando a conversa ou o Cérebro usarem essas palavras.

Nada de corte automático no texto depois de pronto: a v1247 tirou esse tipo de cirurgia de
propósito, e ela não voltou. Quem segura a regra é o próprio pedido enviado à IA, como no resto do
projeto.

## Teste

`tests/v1280-nada-de-palavra-em-ingles.test.mjs` guarda a regra: as palavras da lista, as trocas em
português, o jargão corporativo, a exceção do vocabulário de mercado, e a checagem de que a regra
está no trecho que vale pra TODO corretor (não só pra quem ainda não configurou o Cérebro — erro da
v1240, que não pode se repetir).

Onde a regra ficou: logo DEPOIS do bloco do fecho ("O FECHO CURTO NÃO PODE SER PEDIDO DE LICENÇA" e
"FECHOS QUE VALEM"). Na primeira tentativa ela entrou no meio da lista de linguagem de IA e o teste
da v1262 reprovou na hora — aquela proibição precisa ficar colada na regra do fecho curto, senão a
IA lê uma e larga a outra (foi o motivo de a v1261 não ter pegado). O teste antigo fez o trabalho
dele.

---

# Parte 2 — o histórico de recusa não volta pra cliente

## O que aconteceu

Segundo print, lead Dona Venivia: conversa que vai de junho/24 a agosto/26, onde ela pediu
informação de vários empreendimentos (Quality, Evolutti, Prime, Personalité, Premium Office) e
recusou todos — a última resposta dela foi "querido não muito luxo e grande obgd".

As três sugestões abriram assim:

1. "Das opções que você já recebeu, **nenhuma encaixou no que procura**."
2. "Notei que **as últimas sugestões não agradaram**, talvez porque o perfil delas era diferente do
   que busca."
3. "Para avançar e **te mostrar só o que vale a pena**..."

Ou seja: a primeira linha — a única que a cliente lê na notificação do WhatsApp — é um resumo de
fracasso. E ainda convida ela a concordar que nada serve, que é o contrário de vender.

## O que mudou

Entrou a regra **O HISTÓRICO DE RECUSA NÃO VOLTA PRA CLIENTE**, na mesma lógica do tempo parado
(v1255): a lista de tudo que ela recusou é dado INTERNO, serve pra escolher melhor o que oferecer
agora e não aparece na mensagem.

- Proibido o balanço das tentativas: "nenhuma das opções encaixou", "as últimas sugestões não
  agradaram", "nada do que te mandei serviu", "o perfil delas era diferente do que você busca".
- Proibida também a frase que se coloca acima do cliente ("pra te mostrar só o que vale a pena",
  "pra não te fazer perder tempo") — ela diz, nas entrelinhas, que até aqui foi perda de tempo.
- No lugar entra o CRITÉRIO que a recusa revelou, dito de forma positiva e com as palavras da
  própria cliente ("algo mais prático, sem tanto luxo", "menor e mais fácil de manter"), seguido do
  que o corretor vai fazer com esse critério.

## Teste

`tests/v1280-recusa-antiga-nao-volta-pro-cliente.test.mjs`, com as frases exatas do print.

---

Suíte inteira verde (`npm test`): 436 testes.
