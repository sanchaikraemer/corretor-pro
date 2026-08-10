# v1195 — o app.js foi dividido: o processamento da importação só é baixado quando você importa

## O pedido

Depois da faxina da v1194, o dono pediu: *"então divide o app.js em pedaços pra ficar mais leve"*.

## Antes de cortar: onde o corte cabia

O arquivo principal tem 13.4 mil linhas e 630 blocos de código. Cortar no lugar errado quebra
tela, então a primeira etapa foi medir — com analisador de sintaxe, montando o **grafo de quem
chama quem** — quanto de código é exclusivo de cada tela e poderia sair sem ser duplicado.

O resultado foi humilde e vale registrar, porque desmente a intuição:

| tentativa de corte | quanto sairia de verdade |
|---|---|
| tela da Agenda | **0 KB** — reusa inteiramente o desenho da Home |
| tela do Cérebro | **0 KB** |
| Carteira / Arquivados | **0 KB** |
| tela do cliente | **0 KB** |
| **processamento da importação** | **82 KB** |
| observação por voz | 12 KB |
| exportação/backup | 8 KB |

Ou seja: as telas parecem separadas pra quem usa, mas por dentro compartilham quase todo o
código de desenho. **O único bloco grande de verdade separável é o processamento da conversa
importada** — e faz todo sentido: ele fala com o servidor, monta o resultado e grava o cliente,
coisas que nenhuma outra tela faz.

Havia ainda um detalhe que decidiu o desenho: existe **um ponto único** por onde as telas são
ativadas, e a checagem de compartilhamento roda em toda abertura. Por isso a parte do
**compartilhamento** (o ZIP que chega do WhatsApp) ficou no arquivo principal, e só o
**processamento** saiu — se o compartilhamento saísse junto, o pedaço seria baixado em toda
abertura e a economia viraria zero.

## O que mudou

29 funções (o processamento da conversa, de ponta a ponta: enviar o ZIP, acompanhar as etapas no
servidor, montar o resultado, achar o cliente que já existe, salvar ou atualizar) saíram para um
arquivo novo, **`js/importacao.js`**. O app só o busca no instante em que uma conversa é
importada — e, dali em diante, ele fica guardado no aparelho.

**A porta de entrada é uma só.** A varredura provou que, das 29, apenas `processFile` é chamada de
fora — nos dois lugares de sempre (retomar um compartilhamento e escolher o arquivo na tela). No
lugar dela ficou uma ponte de 4 linhas que busca o pedaço e repassa a chamada, com a mesma
assinatura de antes.

## O que o corretor ganha

| | antes (v1193) | agora (v1195) |
|---|---|---|
| baixado ao abrir o app | 966 KB | **918 KB** |
| trafegado na rede (comprimido) | 252 KB | **240 KB** |
| arquivo principal | 551 KB | **505 KB** |

**48 KB a menos para baixar e interpretar em toda abertura** — 12 KB a menos trafegando de fato.
Quem abre o app pra ver a fila do dia, olhar um cliente, conferir a agenda ou mexer no Cérebro
**nunca** baixa o pedaço da importação.

E quem vai importar? Paga uma busca de 12 KB — no exato momento em que o app já vai subir o ZIP e
esperar a análise da IA, que leva segundos. Na prática, não aparece.

## Como isso foi verificado (não só com teste de texto)

Uma divisão dessas tem um risco claro: esquecer de levar uma função junto. O app abriria normal e
quebraria **só na hora da importação** — o pior lugar possível pra um defeito aparecer. Por isso:

1. **Varredura de escopo, como um empacotador faz**: cada nome usado dentro do pedaço foi
   conferido contra o que ele declara, o que importa e o que é do navegador. Zero pendências.
2. **Navegador de verdade** (Chromium, app publicado):
   - abertura normal: o pedaço **não** é baixado, a Home aparece, **nenhum erro**;
   - abertura vinda de compartilhamento: idem, sem erro;
   - escolhendo um arquivo ZIP na tela de importar: o app **busca o pedaço na hora**, a barra de
     etapas preenche e o processamento roda — **nenhum erro**.
3. **Prova visual**: 7 telas fotografadas antes e depois e comparadas pixel a pixel — idênticas,
   fora o número da versão no topo.

## Guarda nova (`tests/v1195-pedaco-importacao-fechado.test.mjs`)

Trava as cinco condições que mantêm a divisão segura e útil:

1. o pedaço é **fechado** — se alguém usar lá dentro algo do arquivo principal sem trazer junto, o
   teste quebra dizendo o nome que faltou (testei de propósito removendo um: ele apontou certo);
2. o arquivo principal **não pode** importar o pedaço de forma fixa (isso o traria de volta pra
   toda abertura);
3. continua existindo **uma única porta de entrada**;
4. o pedaço **não entra** no pacote guardado na instalação (mesma regra já aplicada ao leitor de
   ZIP na v1186);
5. ele **é publicado** nas duas listas do build.

## Testes

`npm test` — **364 testes, todos verdes**. 41 arquivos de teste foram ajustados: eles conferiam
esse código lendo o arquivo principal como texto, e agora leem os dois arquivos juntos. Cada um
tem, dentro dele, a anotação de por que mudou — os asserts continuam valendo exatamente sobre o
mesmo código de antes, nenhum foi enfraquecido.

## O que não entrou

- **Dividir as telas (Agenda, Cérebro, Carteira, cliente)**: medido e descartado — dariam 0 KB,
  porque compartilham o mesmo código de desenho. Dividir só criaria mais arquivos e mais idas à
  rede, sem tirar peso.
- **Observação por voz (12 KB) e exportação/backup (8 KB)**: são separáveis, mas pequenos perto do
  risco de mexer em mais dois fluxos na mesma versão. Ficam anotados como próximo passo natural.
- **O maior alvo restante não é o app.js**: a biblioteca do Supabase são 199 KB (50 KB na rede),
  20% de tudo que é baixado na abertura, e o app usa só uma parte dela (login e consultas — nada
  de tempo real). Enxugá-la renderia mais que esta divisão inteira. Não foi feito aqui porque não
  era o que o dono pediu, e mexer em biblioteca de login pede uma rodada só pra ela.
