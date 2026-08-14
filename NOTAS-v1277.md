# v1277 — a mensagem que o cliente já ignorou não volta com outras palavras

Dono, 14/08/2026, com print das três sugestões: *"cadê a retomada? DE NOVO!!!!"*

## O caso

A conversa (lead que entrou por formulário, 4 mensagens):

- **18/06, cliente:** *"Preenchi seu formulário e gostaria de saber mais sobre sua empresa."*
- **18/06, corretor:** apresenta o empreendimento e termina com *"Você tem alguma dúvida principal
  ou posso seguir com a apresentação?"*
- **16/07, corretor:** *"Passando para saber se posso ajudar com mais informações… e enviar
  apresentação ou esclarecer alguma dúvida?"*

A cliente **nunca respondeu nenhuma das duas**. E as três sugestões que o app devolveu foram:

1. *"…posso te apresentar mais detalhes… Posso te encaminhar uma apresentação completa pelo
   WhatsApp ou prefere conversar por ligação?"*
2. *"Fico à disposição para explicar melhor… Tem algum ponto específico que você gostaria de
   entender primeiro?"*
3. *"Já posso te encaminhar agora a apresentação completa… Você prefere que eu envie o material ou
   prefere marcar uma ligação rápida?"*

Ou seja: a **mesma oferta**, pela terceira vez, com outras palavras. A saudação estava lá (foi o
conserto da v1274), mas retomada não é cumprimentar — é chegar com algo que a mensagem anterior não
tinha. Do jeito que saiu, a cliente receberia pela terceira vez a pergunta que já ignorou duas.

## A causa

A IA não tinha como saber que aquilo já tinha sido tentado. O pedido enviado a ela levava a conversa
inteira e o número de dias parados, mas **nada dizia que as duas últimas mensagens eram do corretor e
que nenhuma foi respondida**. Sem esse fato na mão, a IA lê a conversa, vê que a apresentação nunca
foi enviada, e conclui — de forma até coerente — que o próximo passo é oferecer a apresentação. Que
foi exatamente o que já falhou duas vezes.

Havia regras parecidas no texto, mas todas só valiam pra pergunta que o corretor faz **pedindo dado
ao cliente** (faixa de valor, prazo, perfil). Nenhuma valia pra **oferta** repetida.

## O que mudou

### 1. O app conta as tentativas e manda o texto delas junto

Entrou no pedido enviado à IA uma linha nova, do mesmo tipo da que já informava os dias parados:

```
TENTATIVAS DO CORRETOR AINDA SEM RESPOSTA: 2. O cliente não respondeu nenhuma delas.
TEXTO DO QUE JÁ FOI TENTADO (…NENHUMA das três pode ser isto de novo com outras palavras):
- "…posso seguir com a apresentação?"
- "…enviar apresentação ou esclarecer alguma dúvida?"
```

"Tentativa" é **dia de contato**, não balão: três mensagens seguidas no mesmo dia contam como uma.
Só a fala do CLIENTE zera o contador — anotação do app, registro de sistema e autor indefinido não
contam nem interrompem a conta. O código **só conta e informa**: não corta, não reescreve e não
troca nenhuma palavra do que a IA escreve (o corte determinístico de frase segue removido, como o
dono mandou na v1247).

### 2. A regra dura: repetir não é retomar

- Nenhuma das três pode, tirando a saudação, dizer a mesma coisa da última tentativa — mesma oferta,
  mesma pergunta, mesmo próximo passo.
- **Licença já pedida e não respondida vira entrega.** Quem não respondeu "pode" da primeira vez não
  vai responder da segunda: o corretor anuncia o que está mandando agora, sem perguntar se pode, e
  fecha por uma escolha que não é sobre autorização (dia, horário, canal, formato).
- **Duas ou mais tentativas sem resposta = mudar de caminho, não de palavras.** Pelo menos uma das
  três precisa colocar na mesa um passo de pessoa pra pessoa — ligação com horário nomeado, visita,
  encontro — com dois dias ou horários concretos. Cliente de fora ou que não consegue ir: vira
  chamada de vídeo ao vivo com horário nomeado, nunca mais um arquivo. E se o material já tiver sido
  enviado, continua valendo o item 8 (o que falta é o encontro, não mais material).
- **Nada disso aparece escrito pro cliente:** "já te mandei mensagem", "não tive retorno", "tentei
  falar com você", "como não obtive resposta" continuam proibidos. O número de tentativas é dado
  interno, igual ao tempo parado.

### 3. Item 11 da conferência final

A lista que a IA relê antes de devolver as três mensagens ganhou o item que compara cada sugestão
com o texto do que já foi tentado: se alguma faz a mesma oferta, a mesma pergunta ou propõe o mesmo
passo, é reescrita antes de sair. (A conferência foi de 10 pra 11 itens — o teto continua sendo uma
dúzia: passou disso, o problema volta a ser o paredão de texto.)

## Conferência antes de publicar

- Suíte completa verde: 23 arquivos checados + os testes de hoje, incluindo o novo.
- Sem mudança de layout, CSS ou tela nesta versão — o que mudou é o texto de instruções que vai pra
  IA e um fato novo dentro dele.

## Arquivos alterados

- `api/_pipeline.js` — `tentativasSemRespostaDoCorretor` (contagem + texto), o bloco novo no pedido,
  a regra dura da tentativa repetida e o item 11 da conferência final.
- `tests/v1277-tentativa-repetida-nao-volta.test.mjs` — teste novo (o print vira caso de teste:
  contagem por dia, cliente que respondeu por último, o fato chegando ao pedido, as regras escritas
  e a garantia de que o código não reescreve mensagem nenhuma).
- `tests/v1263-conferencia-final.test.mjs` — guarda atualizada pros 11 itens.
- `ESTADO-ATUAL.md` — resumo da mudança.
- `package.json` / `package-lock.json` — versão 1277.

## Por que 1277

Duas outras sessões publicaram a v1275 e a v1276 enquanto esta mudança estava em preparo. Esta ficou
com o número seguinte, e nada do que elas fizeram foi desfeito.
