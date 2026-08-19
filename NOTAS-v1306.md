# v1306 — a importação passou a LER as imagens e os PDFs da conversa

Pedido do dono, 19/08/2026: *"vamos testar importar pra análise junto pdf e imagem — vídeo não — e
vamos ver se melhora as respostas"*.

## O que estava acontecendo

Até aqui a importação levava para a IA **só o texto e os áudios**. Imagem, vídeo e documento eram
jogados numa lista de "ignorados", e na conversa que a IA lia sobrava uma linha:

> [Arquivo enviado nesta mensagem: imagem — conteúdo não analisado pela IA]

Ou seja: a arte do anúncio com o preço de hoje, a tabela de valores, o folder do empreendimento, a
planta — nada disso existia para a análise. O caso que mostrou o tamanho do estrago foi o da cliente
que voltou dez meses depois: o preço atual estava **na arte** que o corretor tinha mandado, a IA não
via a arte, e respondeu com o único número que enxergava — o preço em texto, de dez meses antes.

## O que muda

**Imagem (JPG, PNG, WEBP) e PDF passam a ser lidos na importação.** O que está escrito neles vira
texto na linha do tempo, na própria mensagem em que o arquivo foi enviado:

> [Imagem lida pela IA] Anúncio. De R$ 390.000 por R$ 350.000. 2 dormitórios, semimobiliado, 1 box
> de garagem, piscina e academia.

A partir daí é conversa como qualquer outra: entra na análise, fica no histórico do cliente, aparece
na reanálise e pode ser conferido por você.

**Vídeo continua fora**, como você pediu.

O pedido de leitura segue a regra da casa: copiar o que está escrito — valores, condições, nome do
empreendimento, endereço, características —, **sem interpretar e sem inventar**. Imagem sem nada
comercial (selfie, figurinha, meme) é descartada e não vira linha nenhuma.

## Custo, que é o ponto sensível

Ler imagem custa por imagem. Três travas, todas conservadoras:

- **No máximo 6 arquivos por importação**, e sempre os **mais recentes** — numa conversa longa, a
  peça que vale é a última; material velho é justamente o que traz preço vencido (v1305).
- **Só o que a conversa cita.** Arquivo solto no ZIP, que nenhuma mensagem menciona, não é lido.
- **Teto diário por conta** (120 leituras; 8 em conta de teste), conferido **antes** de gastar. O que
  passar do teto fica sem leitura naquele dia.

Se o tempo da importação apertar, a leitura é a **primeira coisa a ser cortada** — e qualquer falha
deixa a conversa exatamente como era antes desta versão. Nada trava por causa dela.

## Na tela

O resultado da importação passa a mostrar quantos arquivos viraram texto:

> **Imagens/PDFs lidos:** 2 · **arquivos ignorados:** 1

## Detalhe técnico que precisou ser consertado junto

O nome do arquivo anexado (`ARTE-PROMO.jpg`) era apagado na leitura do TXT e trocado pelo marcador
genérico. Sem o nome não havia como ligar a imagem lida à mensagem em que ela foi enviada. Agora o
nome fica guardado ao lado da mensagem — o texto que a IA lê continua igual ao de antes.

## Conferido

`tests/v1306-importacao-le-imagem-e-pdf.test.mjs` monta um ZIP de verdade (TXT + imagem + PDF +
vídeo) e confere: vídeo fica fora e nem é descompactado; imagem e PDF saem da lista de ignorados;
o PDF vai para a IA como PDF (e não como imagem); erro, falta de tempo e imagem sem conteúdo
comercial não quebram nem poluem a conversa; e o texto lido aparece na linha do tempo com o rótulo
certo. Tela conferida em navegador, em tamanho de celular.

**Isto é um teste, como você pediu.** O que dá para afirmar é que o material passa a chegar na IA.
Se a qualidade das sugestões melhora, quem diz é o próximo print.
