# v1127 — quando o cliente já disse "pode sim", as mensagens param de pedir permissão de novo

## O caso real que revelou o problema

Lead **Gilmar** (Renaissance → Premium Office), conversa importada em 04/08/2026.

Linha do tempo resumida:

- **30/04** — Gilmar pede informações do Renaissance, recebe apresentação e tabela de valores.
- **30/04 11:23** — ele diz: *"quero valores menores pra investimento"*.
- **30/04 12:32** — o corretor apresenta o Premium Office **a partir de 470 mil** e pergunta:
  *"Esse perfil fica mais dentro do q vc busca?"* — **Gilmar nunca respondeu essa pergunta.**
- **03/08** — retomada: *"Posso te mostrar alternativas que possam encaixar melhor no seu orçamento?"*
- **04/08 07:10** — Gilmar responde: *"Bom dia, pode sim"*.

As três sugestões que o app gerou:

1. *"Recebi sua autorização para trazer opções que fiquem em uma faixa menor para investimento.
   **Posso sugerir** algumas alternativas residenciais e comerciais...?"*
2. *"...tem alguma preferência por localização ou por tipo de imóvel...?"*
3. *"Separei duas opções... **Já posso te encaminhar** os detalhes dessas alternativas por aqui?"*

## O que estava errado

**1. Duas das três pediam de novo uma permissão que já tinha sido dada.** O cliente autorizou
("pode sim") e o app mandava o corretor perguntar outra vez se podia mostrar/enviar. Na prática o
cliente fica esperando um segundo sim — é exatamente onde a conversa esfria. A sugestão 3 é o caso
mais claro: ela diz que já separou as opções e mesmo assim pergunta se pode mandar.

**2. Linguagem de cartório.** *"Recebi sua autorização para trazer opções"* não é jeito de corretor
falar no WhatsApp. Devolver a autorização por escrito soa a protocolo.

**3. A pergunta que realmente destravava a conversa não foi feita por nenhuma das três.** Desde
30/04 a **faixa de valor do Gilmar era desconhecida** — ele só disse "valores menores" e nunca
respondeu se 470 mil cabia. Sem esse número não dá pra separar opção nenhuma. As três mensagens
gastaram o turno pedindo permissão ou perguntando preferências secundárias (localização, tipo de
imóvel) em vez de ir atrás do dado que faltava.

## O que mudou

Duas regras novas no **prompt fixo da análise** (`api/_pipeline.js`) — a base que o app sempre manda
junto do Cérebro. **O Cérebro do corretor não foi tocado e continua sendo a autoridade:** qualquer
regra que ele tenha configurado prevalece sobre estas.

### `CLIENTE JÁ DISSE SIM — NÃO PEÇA A MESMA PERMISSÃO DE NOVO`

- Reconhece resposta afirmativa do cliente ("pode sim", "pode mandar", "sim", "claro", "manda aí",
  "quero sim", "pode ser", "bora") como **autorização já concedida**.
- **Nenhuma** das três mensagens pode voltar a pedir a mesma permissão ("posso te mostrar?",
  "posso te enviar?", "já posso encaminhar?", "posso sugerir?"). Vale para as três, não só pra
  recomendada — no caso do Gilmar duas erraram.
- As três precisam **dar seguimento** ao que foi autorizado. Quando falta um dado do cliente pra
  entregar certo (faixa de valor, tipologia, prazo, localização), a pergunta que falta vem
  **emendada na entrega, nunca no lugar dela**, e o envio não pode ficar condicionado a uma segunda
  autorização.
- Proíbe devolver a autorização em linguagem de protocolo ("recebi sua autorização", "conforme
  autorizado", "mediante sua confirmação").

### `PERGUNTA DO CORRETOR SEM RESPOSTA`

- Pergunta de qualificação que o corretor fez e o cliente **nunca respondeu** deixa aquele dado
  **DESCONHECIDO**. O app não pode tratá-lo como sabido nem **presumir a faixa de valor pelo produto
  que foi oferecido** (o erro que faria assumir que Gilmar aceita ~470 mil).
- Retomar essa pergunta em aberto passa a ser **priorizada** entre as três mensagens — respeitando a
  regra acima, ou seja, emendada na entrega e não como novo pedido de permissão.

Isso é o espelho do `pedidoSemResposta` que já existia: aquele cobre um **pedido do cliente** sem
resposta; este cobre uma **pergunta do corretor** sem resposta.

## Teste de regressão

`tests/v1127-cliente-ja-disse-sim-nao-repede-permissao.test.mjs` trava:

- a existência das duas regras e das formas de "sim" reconhecidas;
- que a proibição vale para as **três** mensagens;
- que as frases erradas do caso real estão citadas como exemplo proibido;
- que a pergunta que falta vem junto da entrega, não no lugar dela;
- que a segunda regra aponta de volta pra primeira (não reabre a porta que ela fechou);
- que as duas regras estão **dentro do prompt realmente enviado** na análise (não num trecho morto);
- que o Cérebro do corretor continua declarado como autoridade.

## Sem mudança visual

Nada muda na tela — a alteração é no conteúdo das três mensagens sugeridas. Não se aplica a
verificação visual em Chromium headless.
