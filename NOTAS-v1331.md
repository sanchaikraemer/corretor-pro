# v1331 — entender primeiro, escrever depois (desligado, pronto pra medir) e mais tempo pra análise

## 1. A análise que não coube no relógio

Print do dono, 20/08/2026 às 19h: conversa de **176 mensagens**, importação concluída, e na tela o
aviso vermelho *"Estas três mensagens são da análise ANTERIOR deste cliente — a nova não foi
concluída"*. A análise gastou IA e não entregou.

O orçamento interno da análise estava em **150 segundos** desde a v1321, enquanto a rota já aceita
**300**. Numa conversa longa, com a leitura completa que a v1320 pediu, 150s não dá. Subiu para
**240 segundos**, com 60 de folga até o teto do servidor. Continua ajustável por
`DIRECIONA_ANALYSIS_BUDGET_MS`.

## 2. A análise em duas etapas — no repositório, desligada

Até aqui um pedido só fazia tudo: ler a conversa inteira, entender o histórico, diagnosticar, achar
a virada, montar o plano **e** escrever as três mensagens. A primeira medição da bateria (feita
pelo dono no painel, 20/08, **156 de 191 pontos**) mostrou onde isso dói: quase toda falha estava
na hora de **escrever** —

- as três mensagens não mudam de abordagem depois de tentativas sem resposta (4 conversas);
- não propõem passo concreto com dia e horário (3);
- não reconhecem o atraso do próprio corretor — o pior caso da bateria, 2/6;
- não perguntam a faixa quando o cliente diz que está caro.

O fato já estava na mão da IA (o fichário da v1329 entrega "o que você prometeu e não enviou") e
mesmo assim não virava mensagem. É o sintoma de pedido grande demais: o modelo pula de "entender"
para "redigir" dentro da mesma resposta.

Agora existe o modo de **duas etapas**:

- **Etapa 1 (leitura):** conversa inteira + Cérebro + fichário → o diagnóstico, sem escrever
  mensagem nenhuma.
- **Etapa 2 (redação):** o diagnóstico **já pronto** + Cérebro + fichário + a cauda recente da
  conversa → as três jogadas.

Nenhuma regra do prompt foi removida ou afrouxada: os blocos (piso de forma, regras das três,
linguagem proibida, revisão final) foram recortados inteiros e mandados para a etapa em que mandam.
O mesmo Cérebro vai nas duas. Nenhuma etapa reescreve o texto da outra — a etapa que escreve nunca
recebe mensagem pronta pra consertar (a rede de reescrita saiu na v1315 e não volta).

**Ele entra DESLIGADO.** O modo padrão continua sendo o pedido único — que é o modo medido em
156/191 e o que todo corretor usa hoje. Ligar sem medir seria repetir agosto.

## 3. Como medir o modo novo

No painel administrativo, o cartão "Qualidade da análise" ganhou o segundo botão:

- **Medir agora** — a análise como está hoje;
- **Medir o modo novo** — a mesma bateria, com as duas etapas ligadas **só naquela medição**. O app
  segue como está; ninguém é cobaia.

O placar diz qual dos dois foi medido. Comparando os dois números, a decisão de ligar (ou não) para
de ser opinião. Ligar pra valer é `DIRECIONA_ANALISE_ETAPAS=2` na hospedagem — sem publicar código.

Junto: enquanto a primeira dupla de conversas não volta, a tela agora diz "Começando pela conversa
1 — a primeira dupla leva uns 2 minutos, é análise de verdade", em vez de um "Começando…" mudo.

## Guarda

`tests/v1331-analise-em-duas-etapas.test.mjs`: desligado por padrão (uma chamada só), ligado vira
duas com as tarefas separadas, o diagnóstico da etapa 1 chega inteiro na etapa 2, o Cérebro é o
mesmo nas duas, nenhuma etapa recebe texto pronto pra reescrever, e a análise sobrevive quando a
redação falha (as três ficam pendentes, como já era).

Suíte: 34 arquivos checados + 477 testes, todos verdes.
