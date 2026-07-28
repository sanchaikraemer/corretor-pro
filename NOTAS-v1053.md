# NOTAS v1053 — o número da lista agora mostra o atendimento, não a mensagem

## O relato

Depois da v1052 (a regra de descanso passou a contar só do último atendimento marcado, ignorando
mensagem), o dono viu de novo a Karine na fila "Fazer agora", com "há 5d" escrito do lado do nome
— e perguntou "esse número 5 que aparece nesse print é o quê então?".

## A causa

O número mostrado na tela (cpHomeLeadRow) e a regra que decide quem aparece na fila
(emJanelaDeEspera) eram calculados de formas DIFERENTES: a regra (desde a v1052) olha só a data do
atendimento; mas o número na tela ainda escolhia a data mais recente entre atendimento e mensagem
— então quando a mensagem era mais recente que o atendimento (caso da Karine: atendimento há mais
de 7 dias, mensagem há 5), a tela mostrava "5", dando a impressão de que a regra dos 7 dias
configurados estava sendo ignorada, quando na real só o NÚMERO exibido não batia com o que a regra
realmente usa.

## A correção

O número mostrado na lista "Fazer agora" agora usa **sempre** a data do atendimento, quando existe
um atendimento marcado — nunca mais a data da mensagem, mesmo que a mensagem seja mais recente.
Só mostra a data da mensagem quando o lead nunca foi atendido nenhuma vez (aí é a única data que
existe). Assim, o número na tela sempre bate exatamente com o que decide se o lead está ou não
descansando.

## Testes

- `tests/v1053-numero-fila-hoje-usa-atendimento-nao-mensagem.test.mjs` (novo): reproduz o caso da
  Karine (atendimento de 10 dias, mensagem de 5 dias → mostra "10d", não "5d") e confirma que sem
  atendimento nenhum continua mostrando a última interação normalmente.
- `npm test`: suíte inteira verde (nenhum teste antigo dependia do comportamento anterior).
- `npm run build`: build limpo, 27 arquivos publicados.

## Arquivos

`app.js` (`cpHomeLeadRow`: número e title sempre usam o atendimento quando ele existe),
`tests/v1053-numero-fila-hoje-usa-atendimento-nao-mensagem.test.mjs` (novo),
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1053.md`, versão
**1052 → 1053**.
