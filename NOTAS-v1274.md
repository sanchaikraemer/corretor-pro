# v1274 — a saudação voltou, e a retomada voltou a parecer retomada

Dono, 14/08/2026, com print das três sugestões de um lead do Evolutti parado desde 06/08:
*"cadê a saudação? a retomada?"*

## O caso

As três sugestões que o app deu:

1. **Recomendada** — *"Das opções e valores que você conferiu no material, ficou alguma dúvida ou
   gostaria de conhecer o apartamento pessoalmente?…"*
2. **Alternativa** — *"Recebeu tempo de analisar as opções que te passei?…"*
3. **Direta ao ponto** — *"Consigo agendar uma visita ao apartamento do Evolutti…"*

Nenhuma cumprimenta. Nenhuma chama o cliente pelo nome. E, na MESMA conversa, todas as mensagens
que o dono escreveu de próprio punho abrem assim: *"Bom dia Gabriel, tudo bem?"*. Além disso, a
conversa estava parada havia dias (o corretor mandou os valores e o link com as opções, e o assunto
morreu ali) — as três escreviam como se fosse a continuação de uma conversa de cinco minutos atrás.

## A causa: duas regras minhas brigando dentro do mesmo pedido

O texto de instruções que vai pra IA tinha, ao mesmo tempo:

- a regra da **retomada** (v1225): *"RECONHEÇA o tempo… 'faz um tempo que a gente não se falava'"*;
- a regra do **tempo parado** (v1255, ordem direta do dono: *"não quero q use os dias"*): proibido
  citar o intervalo em qualquer forma.

Uma mandava falar do tempo, a outra proibia. Diante da contradição, a IA fazia o pior dos dois
mundos: largava a retomada inteira e escrevia como se a conversa nunca tivesse parado. E a regra da
"espinha" das mensagens (*"abre por um fato concreto… nunca abra por estado de espírito"*), pensada
pra matar o check-in vazio do tipo "tudo bem por aí?", acabava lida como *"não cumprimente"* — daí
as três começarem secas, direto no assunto.

## O que mudou

### 1. Cumprimentar virou obrigação, não opção

As três mensagens abrem com a saudação do horário mais o primeiro nome do cliente
(*"Boa tarde Gabriel, tudo bem?"*), no jeito que o próprio corretor cumprimenta. Mensagem que começa
direto no assunto passou a estar escrita como ERRO.

A única exceção é a que já existia desde a v1253 (o caso da Milena, que cumprimentava duas vezes
seguidas): conversa que **continua hoje**, com o cumprimento já trocado hoje. E agora está dito com
todas as letras que cumprimento de ontem ou de dias atrás **não conta** — dia novo, conversa
retomada, a saudação volta.

### 2. A retomada aparece no assunto, nunca no calendário

A regra da retomada continua dura, só que sem a contradição: a mensagem tem que **soar** como quem
volta a falar — cumprimentando e puxando o fio real da conversa (o material que já foi enviado, a
opção que o cliente escolheu, a pergunta dele que ficou sem resposta) — e continua **proibido** citar
o intervalo ("faz um tempo", "faz X dias", "desde nossa última conversa"). As duas regras agora se
referenciam, então não há mais como escolher uma e largar a outra.

Também ficou escrito o que a proibição de falar dos dias **não** autoriza: ela não manda tirar a
saudação, nem manda escrever como se nada tivesse acontecido entre uma conversa e outra.

### 3. Uma rede de segurança discreta, só pro cumprimento

Se, mesmo com a regra, a IA entregar uma sugestão sem cumprimento **numa conversa que está parada**
(pelo prazo de retomada que o próprio corretor configura), a saudação com o nome entra na frente do
texto. Nada do que a IA escreveu é apagado, trocado ou reescrito — só entra o cumprimento que
faltava. Em conversa que continua hoje o app não encosta em nada: lá quem manda é a regra de não
cumprimentar duas vezes.

A faixa do dia (bom dia / boa tarde / boa noite) continua sendo acertada **na hora de mostrar** a
mensagem, como desde a v1218 — análise feita de manhã e copiada à noite sai com "boa noite".

## Arquivos alterados

- `api/_pipeline.js` — regra da retomada sem a contradição; saudação obrigatória nas três; exceção
  do "não cumprimente duas vezes" limitada ao mesmo dia; rede de segurança do cumprimento.
- `js/saudacao.js` — `garantirSaudacaoAbertura` e `primeiroNomeDoCliente`.
- `tests/v1274-saudacao-e-retomada-nas-tres.test.mjs` — teste novo (o print vira caso de teste).
- `tests/v1225-retomada-de-verdade.test.mjs`, `tests/v1253-pedido-do-cliente-manda-na-recomendada.test.mjs`,
  `tests/v1255-tres-mensagens-conduzem.test.mjs`, `tests/v1219-esperando-resposta-e-nada-de-novidade-inventada.test.mjs`
  — guardas atualizadas pro texto novo (a exigência de "reconhecer o tempo" foi revogada de vez).
- `package.json` / `package-lock.json` — versão 1274.
