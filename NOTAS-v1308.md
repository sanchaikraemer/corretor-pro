# v1308 — o plano B silencioso acabou, "boa viagem" deixa de ser cobrança, e as três chaves

Esta atualização vem inteira de uma auditoria que o dono trouxe em 19/08/2026, feita **medindo o
código com uma conversa real** — não é palpite. A conversa: um cliente queria dar um imóvel de
R$ 1.200.000 na negociação de um de R$ 1.450.000, e o corretor já tinha dito que estuda permuta até
40–50% do negócio. Em 14/08 (sexta) o cliente escreveu *"Opa. Falamos semana que vem. Estou
viajando"* e o corretor respondeu *"Certo, boa viagem e até semana que vem"*. Em **19/08 — a quarta
dessa mesma semana que vem** — o app analisou e disse que o cliente *"não retornou no prazo
indicado"* e que houve *"apenas silêncio"*. As três sugestões viraram variações de "ficou alguma
dúvida?".

Um ChatGPT comum, com a mesma conversa na mão, fez a conta (1,2 milhão dentro de 1,45 = mais de 80%
do negócio, contra os 40–50% aceitos) e propôs atacar o obstáculo: perguntar se o cliente já pensou
em vender a cobertura para viabilizar a compra, e pedir uma conversa hoje.

Seis coisas mudaram.

---

## 1. Nunca mais uma análise pior sem você saber

O app pedia a análise para o modelo bom. Se a resposta demorasse mais de 34 segundos, ele **refazia
tudo num modelo mais barato e entregava na tela sem avisar**. A reescrita das sugestões caía no mesmo
modelo fraco quando sobrava pouco tempo.

Isso acabou. Agora:

- se a primeira tentativa falhar, o app **tenta de novo no mesmo modelo** (repetir só conserta erro
  passageiro da OpenAI, que é o único caso em que tentar de novo faz sentido);
- falhando as duas, a tela diz, em português: **"Não deu pra analisar esta conversa agora — a IA não
  respondeu a tempo. Toque em Reanalisar."**;
- a reescrita das sugestões roda **só** no modelo bom. Sem tempo pra ela, a mensagem vai pra tela do
  jeito que a IA escreveu, **com a marca de problema** (item 5) — em vez de ser costurada por um
  modelo pior.

Análise pior sem aviso é pior que análise nenhuma, porque você age em cima dela achando que é a de
sempre.

**O nome do modelo continua trocável na configuração da hospedagem, sem publicar código nenhum** —
nada foi cravado aqui.

### E o modelo passou a ser o GPT-5.6 Terra

O app analisava no **gpt-4.1**, duas gerações atrás. Passou para o **GPT-5.6 Terra**, o nível
equilibrado da linha atual da OpenAI — mais forte que o anterior e rápido o bastante pra caber no
tempo da rota. Os outros dois níveis, se um dia fizer falta, são o **Sol** (o mais inteligente e o
mais lento) e o **Luna** (o mais barato). Trocar é uma linha na configuração da hospedagem, sem
publicar nada.

**E se o modelo novo não estiver liberado na sua conta da OpenAI?** O app percebe na hora (a OpenAI
responde "esse modelo não existe para você"), roda a análise no modelo anterior e **escreve isso em
vermelho na tela**: *"o modelo novo não está liberado na sua conta da OpenAI — esta análise saiu no
modelo anterior; libere o modelo no painel da OpenAI ou avise o suporte"*. Sem essa rede, uma conta
sem acesso ficaria com **todas** as análises falhando sem explicação. E isso não é o plano B
silencioso que acabou logo acima: ali um modelo que funcionava era trocado por um pior, calado;
aqui o modelo pedido simplesmente não existe para a conta, e a tela diz.

### A análise ganhou 41% mais tempo pra pensar

Pergunta do dono: *"e se não couber em 34 segundos, por que não aumenta esse prazo?"*. Ele estava
certo — os 34 segundos eram desperdício, não limite.

O teto de verdade é da hospedagem: a rota é morta aos **60 segundos**, e passar disso não devolve
nada. Dentro desse teto, o app reservava uns 16 segundos **parados**, guardados para uma segunda
tentativa. Só que segunda tentativa não conserta lentidão — serve para erro passageiro da OpenAI
(fora do ar, fila cheia, queda de rede), e esse tipo de erro volta em segundos, deixando o tempo
sobrando sozinho. Ou seja: os 16 segundos guardados só encurtavam a única tentativa que interessa.

Agora a análise tem **48 segundos** em vez de 34. Se estourar o tempo, o app não repete (repetir uma
chamada lenta falha igual e ainda custa dinheiro): a tela avisa e você toca em Reanalisar. Se o erro
for passageiro, o que sobrou do tempo vira a segunda tentativa, no mesmo modelo.

Para passar dos 60 segundos seria preciso subir o limite da hospedagem (os planos pagos da Vercel
aceitam até 5 minutos). Se um dia isso for necessário, é uma linha de configuração e o teste da
suíte trava a conta pra ninguém estourar o teto por engano.

---

## 2. "Boa viagem" nunca mais conta como cobrança sua ignorada

O app contava, de trás pra frente, quantas mensagens suas ficaram no fim da conversa sem resposta do
cliente — e parava só quando achava uma fala dele. Como **você** deu a última palavra, o pedido
enviado à IA dizia, com todas as letras:

```
TENTATIVAS DO CORRETOR AINDA SEM RESPOSTA: 1
- "Certo, boa viagem e até semana que vem"
```

Sua despedida virou uma cobrança ignorada. É daí que saiu o "apenas silêncio".

Agora, **mensagem sua que é só educação não conta como tentativa**: concordar, agradecer ou se
despedir é o fim do que o cliente acabou de dizer, não uma cobrança esperando resposta. A regra é
estreita de propósito — mensagem curta, sem pergunta, sem valor, sem link e sem material. Pergunta,
entrega e compromisso (*"te mando as plantas hoje"*) continuam contando como tentativa, e uma
cobrança de verdade **antes** da despedida também continua contando.

---

## 3. Prazo marcado pelo cliente é prazo dele — e o app agora entende isso

"Falamos semana que vem" não virava data em lugar nenhum. O app só sabia contar "dias desde a última
mensagem" e comparar com os seus dias de descanso (5). Por isso ele mandou cobrar dentro do prazo
que o próprio cliente pediu.

Agora o app faz a conta de calendário e conta o fato pra IA:

> **PRAZO MARCADO PELO PRÓPRIO CLIENTE:** na última mensagem dele (14/08/2026) ele escreveu "Opa.
> Falamos semana que vem. Estou viajando" — o retorno ficou combinado para "semana que vem". Esse
> prazo vai até 23/08/2026. Hoje ainda está DENTRO do prazo (faltam 4 dias). Isto NÃO é silêncio,
> NÃO é sumiço e NÃO é tentativa ignorada.

Entende "semana que vem", "mês que vem", "depois do dia 20", "daqui a 10 dias", "amanhã", "quando eu
voltar". Vencido o prazo, ele diz isso também — e aí a retomada é legítima.

**Nenhum lembrete é criado por causa disso.** Agendamento continua existindo só quando **você**
marca; isso não mudou nem vai mudar.

---

## 4. Os exemplos do seu jeito de escrever ficaram limpos

Toda análise manda pra IA as suas últimas 8 mensagens como *"COMO ESTE CORRETOR ESCREVE"*. Nessa
conversa entraram a **saudação automática do anúncio** ("Anúncio Olá! Muito obrigado pelo seu
interesse... Como posso lhe ajudar?") e a **despedida de uma linha**. Nenhuma das duas foi escrita
pensando naquele cliente — uma é robô de verdade, a outra é educação.

As duas saíram. O que fica é mensagem sua de verdade.

---

## 5. O aviso agora diz QUAL das três está com problema

A linha "1 sugestão saiu com problema" não dizia qual, e você tinha que adivinhar em qual das três
olhar (naquela conversa, era a de número 3, pelo fecho *"só me chamar que sigo aqui pra ajudar no
que precisar"*).

Agora:

- a linha de resumo diz o **número**: "sugestões 1 e 3 saíram com problema";
- e cada sugestão furada carrega, **embaixo do texto dela**, o que há de errado: *"Confira antes de
  enviar: pede licença para entregar · fecho que devolve a bola pro cliente. O app tentou refazer
  esta mensagem e não conseguiu tirar isso."*

---

## 6. Medir o tamanho do obstáculo — em número

Era a única coisa que o ChatGPT fez e o app não fazia. O pedido tinha cerca de 50 proibições e
nenhuma linha mandando a IA **medir** o tamanho do problema comercial. Entrou agora, como instrução
**do que fazer**:

> Quando o negócio depende de um imóvel entrando na troca, faça a conta com os números desta
> conversa: o valor do imóvel do cliente, o valor do negócio, quanto o primeiro representa do
> segundo em porcentagem, e a comparação com o limite de permuta que o seu Cérebro declara. Escreva
> o resultado com os números à vista e trate a diferença como **o** obstáculo central. As três
> mensagens têm que atacar esse obstáculo — vender o imóvel antes, reduzir a parte dada na troca,
> entrar com dinheiro na diferença, ou procurar um negócio de valor compatível.

Faltando um dos dois valores, a IA precisa **dizer qual falta e pedir exatamente esse número** — sem
estimar e sem inventar. Nenhum valor ou limite está cravado no código: tudo sai do seu Cérebro ou da
própria conversa.

O resultado aparece no cliente, no bloco "Detalhes comerciais", na linha **"A conta da troca"**.

---

## 7. As três chaves (Cérebro → Chaves da análise)

Pedido direto do dono: poder **pausar** três coisas, separadamente, pra rodar a mesma conversa com
cada uma ligada e desligada e ver com os próprios olhos o que melhora e o que piora.

| Chave | Desligada, o que sai do pedido |
|---|---|
| **Usar o meu Cérebro** | seu método, tom, diferenciais, o que evitar, regras e objeções |
| **Usar o aprendizado** | o seu jeito de escrever aprendido e as suas mensagens desta conversa |
| **Usar as regras de escrita** | as listas de frase de robô e de palavra em inglês proibidas — e o app deixa de refazer a sugestão que sair com uma delas |

O normal é as três ligadas, e **quem nunca mexer continua exatamente como estava**. Desligar não
apaga nada: o texto continua salvo, e religar é um toque.

Isso é chave e não faxina por um motivo escrito no histórico do projeto: arrancar as regras
concretas do pedido já foi tentado (v1240) e piorou tanto que precisou ser desfeito (v1247). Desta
vez a experiência é reversível.

E toda análise feita com alguma chave desligada mostra, **em destaque, acima das sugestões**:
*"Análise de teste: o seu Cérebro e as regras de escrita estavam desligados."* Sem isso, comparar
duas telas não prova nada.

---

## O que foi conferido

- `npm test` — 29 arquivos checados + 462 testes, todos verdes, incluindo o teste novo
  `tests/v1308-sem-plano-b-prazo-do-cliente-e-chaves.test.mjs`, que guarda cada um dos sete pontos
  acima rodando as funções de verdade contra a conversa do caso.
- Conferência visual no navegador (celular 390×844 e computador 1440×900) das duas telas novas: as
  três chaves na tela do Cérebro e o aviso dentro da sugestão furada. Nenhuma delas estoura a
  largura da tela.
- A bateria de conversas (`evals/executar.mjs`) — o antes e o depois nas mesmas 10 conversas —
  depende da chave da OpenAI e é a última coisa antes de publicar.

Uma expectativa da bateria mudou de propósito: no caso "o corretor falou por último", as tentativas
sem resposta passaram de **1 para 0** — a última mensagem dali (*"Perfeito, Fernando! Fico à
disposição..."*) é resposta educada, não cobrança ignorada. É exatamente o conserto do item 2.
