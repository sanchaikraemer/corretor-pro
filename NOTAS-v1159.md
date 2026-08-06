# v1159 — a fila do "Fazer agora" perdeu o volume de mensagens e a penalidade por tempo parado

O dono revisou a régua item por item e cortou dois fatores. Os dois cortes têm o mesmo espírito do
corte da v1158 (o palpite "cliente esperando"): **só fica na conta o que a conversa importada
comprova, e o que um negociador de verdade usaria.**

## 1. Saiu "+1 por mensagem dele (até 30)"

> "+1 por mensagem dele (até 30) · +6 por pergunta que ele fez (até 20) — cara, isso é a mesma
> coisa, ou não????"

Não era a mesma coisa, mas **se sobrepunha**: toda pergunta já contava duas vezes (+1 de mensagem e
+6 de pergunta). E volume de mensagem não diz se o cliente compra — quem escreve muito pode estar só
curioso. Ficaram os dois fatores que medem interesse de verdade: **em quantos dias** ele voltou a
escrever e **quantas perguntas** fez.

O volume continua vivo onde faz sentido: na **barrinha** do cliente na Home (últimos 90 dias) e como
**desempate** entre notas iguais na fila — em nenhum dos dois ele decide a prioridade.

## 2. Saiu "−2 por cada dia sem você atender" (até −180)

> "isso é ridículo... se o cliente não me responde vai baixando por quê? Tem que respeitar o prazo,
> o cara tem outras coisas pra fazer também, pensa nisso, como humano, negociador, e não como um
> robô chato."

Essa penalidade nasceu de um pedido dele na v1056 ("fazer o tempo parado pesar contra a posição") e
foi revogada por ele agora. Além do argumento — que está certo: o silêncio do cliente não é culpa do
cliente nem sinal de desinteresse — ela tinha dois defeitos concretos:

1. Desde a régua de 90 dias (v1139), cliente frio **já pontua perto de zero sozinho** (recorrência,
   perguntas e negociação contam só os últimos 90 dias). A penalidade cobrava a mesma coisa duas
   vezes.
2. Pior: cliente **novo**, que nunca foi atendido, caía no teto (−180), como se estivesse 90 dias
   parado. Quem escreveu hoje começava no fim da fila.

**Quem esfriou não fica esquecido:** as vagas de resgate do dia (3, na configuração dele) continuam
escolhendo justamente quem está há mais tempo sem atendimento — esse é o caminho de volta, e ele é
explícito, não um efeito colateral de peso.

## Como a fila fica

| Fator | Peso |
| --- | --- |
| Dias em que o cliente voltou a escrever (últimos 90, até 20) | +8 cada |
| Perguntas que ele fez (últimos 90, até 20) | +6 cada |
| Já falaram de valor/entrada/condição | +35 |
| Proposta ou contraproposta em aberto | +35 |

Nada mais. Quem entra na fila (dias de atendimento, descanso, cadência de quem nunca respondeu) e as
vagas de resgate do dia seguem exatamente como estavam.

## Arquivos

- `app.js` — `cpProbabilidadeFechamento` com três fatores; sumiram `engajamento` e todo o bloco
  `diasFrio` (com ele, o uso de `ultimoAtendimentoTs`/`diasCalendarioBR` dentro do ranking).
- `tests/v1159-fila-sem-volume-e-sem-penalidade-de-tempo.test.mjs` — **novo**, substitui
  `tests/v1056-tempo-parado-pesa-contra-posicao-na-fila.test.mjs` (que travava a penalidade
  revogada). Roda a função de verdade: mesma conversa atendida há 2 ou 90 dias dá a mesma nota,
  cliente novo não começa mais no fim, 218 mensagens não valem mais que 1 — e o que sobrou continua
  ordenando (recorrência, perguntas, negociação, com os tetos).
- `tests/v943-...` e `tests/v1017-...` — as duas travas que exigiam volume dentro da nota foram
  invertidas: agora proíbem o volume de voltar.

## Conferência

- `npm test`: 24 arquivos + **325 testes**, verdes.
- Chromium headless: app abre na versão 1159, Home monta, sem erro de JS.
