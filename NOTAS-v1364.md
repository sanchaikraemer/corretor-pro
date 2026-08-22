# v1364 — o app aprende a enxergar o compromisso da conversa (o caso Vande)

Você trouxe a leitura correta do atendimento do Vande e a análise do que o app errou. Os erros,
resumidos: o app disse que o VANDE pediu pra deixar pra semana seguinte (foi você quem propôs);
tratou uma desmarcação por agenda como se a conversa tivesse "perdido força"; chamou o Vande de
corretor/parceiro só porque ele disse "estou em visita ao cliente"; enterrou o sinal mais forte da
conversa (ele mesmo pedindo a visita) enquanto dava destaque ao seu convite de café; e mandou três
mensagens com três objetivos inventados quando o único avanço era marcar dia e hora.

## A causa

O app já contava sozinho, antes da IA, várias coisas: valores citados, perguntas feitas, recusas,
promessas. Mas **o compromisso — visita, reunião, ligação — não existia como fato contado**. A IA
tinha que reconstruir sozinha quem pediu, quem propôs, quem adiou e por quê — e reconstruía errado.

## O que mudou

O app agora reconstrói o compromisso fala a fala, antes da IA, e entrega pronto:

- **quem pediu para marcar** (no caso do Vande: ele mesmo, "Podemos agendar para amanhã à tarde?");
- **quem propôs cada dia e horário**, com a frase de cada um;
- **quem ficou de confirmar** ("Te confirmo até o meio-dia");
- **por que não aconteceu** — e, principalmente, se o motivo foi **agenda** ("não vou chegar a
  tempo") ou **objeção de verdade** ("achei caro"). Agenda não vira esfriamento nunca mais;
- **quem propôs deixar para depois** — com ordem expressa de não atribuir ao cliente uma decisão
  que foi do corretor;
- **a preferência de período** dita pelo cliente ("Bom dia fica melhor" = manhã), que as mensagens
  têm que respeitar;
- **a situação**: se o compromisso continua de pé e o que falta (definir dia e horário).

Com o compromisso de pé e pendente, o app também passa a dizer com todas as letras: **o próximo
avanço é UM só**, e as três mensagens devem buscar esse mesmo avanço variando só o jeito — uma
propõe um horário, outra oferece duas opções, outra retoma o combinado de leve. Acabou a obrigação
de inventar três objetivos diferentes quando só existe um certo.

Mais duas proteções que nasceram do mesmo caso:

- **"Estou em visita ao cliente" não faz de ninguém corretor.** O app agora procura sinal
  imobiliário de verdade nas falas do contato (dizer-se corretor, CRECI, comissão, parceria,
  "meu cliente" tratando de imóvel). Sem nenhum, ele avisa a análise para tratar o contato como
  comprador. Quem realmente é parceiro ("Sou corretor, meu cliente gostou do apartamento")
  continua sendo reconhecido como antes.
- **Os sinais fortes do próprio cliente ganham lista com data** — pedir visita, perguntar
  condições, pedir contrato, dizer que interessa. Isso pesa mais que quantidade de mensagens,
  saudação e reação na hora de definir o estágio. Cliente que pediu visita anteontem não é
  retomada fria.

A conferência final das três mensagens também aprendeu três defeitos novos (e mostra o aviso
vermelho quando acontecem): mensagem que atribui ao cliente o adiamento que foi do corretor;
mensagem que ignora o compromisso pendente; mensagem que trata desmarcação de agenda como
desinteresse ("se você ainda tem interesse..."). E no sentido contrário: quando a visita está
pendente, as três convergirem nela **deixou de ganhar** a tarja de "pedem a mesma coisa" — agora
isso é o comportamento certo.

## O que NÃO mudou

- O texto de orientação da IA que você mandou restaurar e congelar (v1247/v1327) **não foi
  tocado** — a trava que confere isso continua verde, sem medição nova. Tudo desta versão é conta
  feita pelo próprio app, entregue como fato no dossiê da conversa.
- Nenhuma chamada de IA a mais: tudo é cálculo local. A análise não fica mais lenta nem mais cara
  de forma perceptível.
- Nada mudou na tela: importação, transcrição, agenda e o resto seguem exatamente como estavam.

## Testes

Três arquivos novos: o caso Vande inteiro por significado; os seis casos gerais (reunião que surge
não mata a visita; "achei caro" é recuo de verdade; "Ok" do cliente não transfere autoria;
"atendendo um cliente" não vira corretor; parceiro de verdade continua sendo reconhecido; um único
próximo passo autoriza convergência); e as checagens novas da conferência. Suíte completa verde:
34 arquivos + 505 testes.
