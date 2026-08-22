# v1366 — apagada a tarja vermelha que reprovava mensagem boa

## O que aconteceu

Print do dono, 22/08/2026, cliente **Pâmela**: as **três** sugestões saíram com a mesma tarja
vermelha embaixo —

> **Confira antes de enviar:** não conduz para o compromisso pendente (visita ainda sem dia e
> horário).

E as três estavam **certas**. A cliente tinha acabado de perguntar sobre outro edifício em
Carazinho, e as três mensagens respondiam exatamente isso — uma perguntando o que ela quer evitar,
outra oferecendo a escolha (sem piscina / mínima área comum), a terceira já dizendo que ia separar
as opções. Atender o que o cliente pediu é a coisa certa a fazer; o próprio documento de análise
que originou a v1364 diz isso com todas as letras ("quando o cliente pediu algo, atender o pedido
vem primeiro").

Pergunta do dono: *"e o que você fez que não te mandei? coisas que você inventou por conta, como
esses parágrafos vermelhos em cada sugestão"*. Resposta honesta: **a régua era minha.** O documento
pedia que o app conferisse se alguma sugestão "ignora compromisso existente"; o critério que eu
escrevi ficou grosseiro — enquanto houvesse visita combinada sem dia e hora, ele carimbava
**qualquer** mensagem que não empurrasse a visita. Ordem do dono: **apagar**.

## O que mudou

- A conferência **"não conduz para o compromisso pendente" foi removida**. Nenhuma mensagem leva
  mais tarja vermelha por tratar de outro assunto.
- Saiu junto o dado que só ela lia (`temPromessaPendente`): dado que ninguém lê engana quem mexer
  no código depois.

## O que NÃO mudou

As outras conferências, que continuam valendo porque cada uma aponta um erro de fato:

- abre contando os dias parados;
- cita empreendimento que não aparece nesta conversa;
- cita produto seu, mas de outra conversa;
- pergunta de novo algo que o cliente já respondeu;
- promete enviar e não pergunta nada;
- duas das três pedem a mesma coisa;
- **atribui ao cliente uma decisão que foi do corretor** (v1364);
- **trata como desinteresse um cancelamento que foi só de agenda** (v1364).

Nada da análise, do Cérebro ou das três mensagens mudou nesta versão — só o aviso saiu.

## Trava pra não voltar

O teste da v1364 foi virado do avesso: ele **exigia** essa tarja; agora ele **proíbe**. O cenário
de teste é o formato exato do print da Pâmela — visita pendente de data, três mensagens tratando
de outro assunto — e falha se alguma delas voltar a sair com aviso. O comentário no código diz o
caminho, se um dia isso precisar existir de novo: entra como **fato no fichário** (o app já
entrega o compromisso pendente lá, e a IA decide junto com o Cérebro), **nunca** como reprovação
automática da mensagem escrita.
