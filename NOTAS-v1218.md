# v1218 — "Boa noite" às 17h37: a saudação passa a seguir a régua

Print do dono às **17h37**: a sugestão de mensagem abria com *"Boa noite Luane, tudo certo?"*.
Pergunta dele: **"qual a regra q deve ser seguida?"**.

## A régua (a do português do Brasil, escrita num lugar só)

| Horário | Saudação |
|---|---|
| até 11h59 | **Bom dia** |
| 12h00 às 17h59 | **Boa tarde** |
| a partir das 18h00 | **Boa noite** |

Horário de Brasília. É a mesma régua que a saudação da tela inicial já usava — o que faltava era
ela valer também para as **sugestões de mensagem**, que quem escreve é a IA.

## Por que saía errado

A hora certa **já ia** no pedido enviado à IA ("Data e hora atuais da análise no Brasil:
11/08/2026 17:37:12"). O que **não** ia era a régua — e sem ela a IA escolhia a faixa do dia por
conta própria, acertando às vezes. Havia ainda um segundo risco: a análise roda num servidor que
trabalha em UTC, três horas à frente; qualquer conta de hora feita sem fixar o fuso do Brasil
transforma 17h37 em 20h37, e aí "Boa noite" fica até coerente — só que errado.

## O que mudou

1. **A IA recebe a saudação pronta.** O pedido agora leva `Saudação correta para este horário:
   "Boa tarde"`, junto com a régua por extenso e o aviso de que, se a mensagem abrir com saudação,
   tem que ser exatamente aquela. A hora usada é sempre a de Brasília, nunca a do servidor.
2. **O app corrige na hora de mostrar.** Toda sugestão passa por um mesmo funil antes de aparecer
   na tela; ali, se a mensagem **abre** com uma saudação da faixa errada, só essa palavra é
   trocada. Isso resolve dois problemas de uma vez:
   - as análises **já salvas** saem certas sem precisar reanalisar nada;
   - uma análise feita de manhã e copiada à noite não vai mais sair com "Bom dia" às 21h.
3. **A saudação da tela inicial** passou a usar a mesma régua, em vez de ter a dela escrita à
   parte — duas cópias da mesma regra é como uma delas envelhece.

O código **não reescreve conteúdo comercial**: mexe só na saudação de abertura. Saudação no meio
do texto não é tocada, mensagem sem saudação fica intacta, e o jeito que foi escrito é mantido
(maiúsculas continuam maiúsculas; "Oi, boa noite" vira "Oi, boa tarde", em minúscula).

## Arquivos alterados

- `js/saudacao.js` (novo) — a régua e a correção, sem tela e sem rede (é o que permite o teste
  executá-la de verdade).
- `app.js` — a saudação da Home usa a régua única; toda sugestão passa pela correção em
  `mensagensDaAnalise`.
- `api/_pipeline.js` — o pedido à IA leva a saudação pronta e a régua por extenso, na hora de
  Brasília.
- `service-worker.js` — o arquivo novo entra no pacote offline (é import fixo do app).
- `build.js` — publica o arquivo novo.
- `tests/v1218-saudacao-certa-para-o-horario.test.mjs` — executa a régua hora a hora (com as
  viradas de 11h59→12h e 17h59→18h), confere o caso exato do print (20h37 UTC = 17h37 no Brasil)
  e garante que o código não mexe em nada além da saudação de abertura.
- `package.json` / `package-lock.json` — versão 1218.

Conferido no navegador (Chromium headless sobre `public/`) com o relógio congelado no horário do
print: a mensagem do print sai como *"Boa tarde Luane, tudo certo? …"*.
