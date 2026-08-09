# v1188 — auditoria comercial: o cliente que respondeu voltou a ser a prioridade nº 1

Depois da bronca certeira do dono na v1187 ("parece que você não leu o sistema"), esta rodada
auditou o que o app **decide** — não o encanamento. Método: o app de verdade, rodando num
navegador de verdade, recebendo uma carteira de teste com 10 situações reais de corretor
(cliente que respondeu depois do atendimento, lembrete vencido, visita amanhã, "vou pensar",
parado há 12 dias, arquivado…), com o relógio congelado numa segunda-feira às 10h — e a leitura
do que cada tela realmente mostrou. Nada de ler arquivo e supor.

## Defeito A — "Cliente respondeu" nunca acontecia (o mais caro)

**O caso medido:** Bruno foi atendido ontem. Hoje, 3 horas atrás, ele respondeu: *"Recebi!
Consegue ver se o banco aceita entrada menor?"*. Um cliente com a mão levantada, pronto pra
avançar.

**O que o app fazia com ele: nada.** Invisível em todas as superfícies da Home:

- fora do **"Fazer agora"** — o descanso pós-atendimento (5 dias) bloqueava;
- fora de **"Aguardando cliente"** — essa categoria exige que VOCÊ tenha falado por último;
- a fatia **"Cliente respondeu"** do gráfico: eternamente 0%.

**A causa:** o detector (`cp786ClienteRespondeu`) existia. A ordenação já colocava "respondeu"
em primeiro lugar. O badge "Responder" existia. **Só que nada produzia a categoria** — o fio
ficou desligado quando a Home trocou de geração. É a regra número 1 do próprio produto, definida
pelo dono na v826 ("cliente respondeu e não recebeu resposta vem antes de tudo"), perdida sem
ninguém ver.

**A correção:** a categoria passou a ser produzida, com a guarda que o dono já tinha aprovado na
v1017 — um "Obrigada!" de despedida não vira prioridade; só fala que realmente pede retorno. E o
"Fazer agora" deixou o cliente-que-respondeu **furar o descanso**: a espera existe pra "eu falei
e ele não respondeu", nunca pro contrário.

**Depois da correção, medido no navegador:** Bruno em **1º lugar** na fila do dia. A tela diz
"5 leads pra atender hoje" e ele encabeça.

## Defeito B — compromisso vencido dizia "Hoje"

**O caso medido:** Diego tinha retorno combinado que **venceu anteontem**. O box "Próximos
compromissos" mostrava **"Hoje"** (era só o valor padrão de uma variável, não uma data) com o
chip azul "Agenda" — o esquecimento vestido de coisa em dia.

**A correção:** vencido agora diz **"Venceu há 2 dias"**, em vermelho, com chip **"Vencido"**, e
ordena ANTES dos compromissos futuros. A regra escrita no próprio código ("vencido fica em
Programados com destaque de atrasado") passou a existir na tela.

## Também nesta versão

- A linha **"Cliente respondeu"** entrou na legenda do gráfico de prioridade (a fatia laranja
  existia, mas sem linha na legenda o número ficava mudo).
- Confirmado no mesmo teste: aguardando legítimo, visita de amanhã, arquivado e prospecção rasa
  continuam exatamente onde estavam. A Iara (parada há 12 dias, última fala sem pedido) NÃO virou
  "respondeu" — a guarda segura o falso positivo.

## O que o teste de regressão guarda

`tests/v1188-cliente-respondeu-e-vencido-visiveis.test.mjs` roda a árvore de decisão REAL
(extraída do fonte, com espiões nas dependências): o caso do Bruno, o "Obrigada!" que não vira
prioridade, a visita confirmada que continua vencendo, o aguardando intacto — e o rótulo "Venceu
há N dias" calculado de verdade. E confere que produtor e consumidores estão LIGADOS, não só
escritos — a lição da v1186/v1187.

Suíte: **355 testes verdes.**
