# v1323 — não pedir o que a cliente já disse, não derrubar o preço que você mesmo ancorou, e dizer o que a IA não leu

O dono comparou, na tela, a análise publicada da conversa fixa (a da Noemi, agora com 66 mensagens)
com a conversa inteira. **A leitura estava certa em tudo o que dava pra conferir** — a virada dos
três terrenos, a conta dos 40 a 50%, o que mudou de janeiro pra agosto, onde a conversa parou.
Mesmo assim, três coisas estavam erradas. Nenhuma delas é a IA sendo burra: são fatos que o app
tinha e não entregava, e uma coisa que a tela não dizia.

## 1. A sugestão pedia o que a cliente já tinha dito

A mensagem 3 dizia: *"me manda a localização certinha deles?"* — sobre os três terrenos. Só que a
cliente **já tinha dito, no dia anterior**: *"Eu tenho 3 terrenos lá numa esquina da ouro preto"*.
Pedir de volta o que o cliente acabou de dizer é a coisa que mais parece que ninguém leu a conversa.

O fichário da conversa (v1317) já entregava à IA **as perguntas que o corretor já tinha feito** —
foi o que acabou com o "morar ou investir?" repetido sete meses depois. Faltava o outro lado: **o
que o cliente já respondeu**. Agora vai junto, com a data e a idade de cada fala, da mais recente
pra mais antiga, sem repetição, e com o teto grande de propósito (a fala mais fácil de esquecer é a
de janeiro — no caso dela, "eu quero pela avenida Pátria ou mais centro").

Junto do fato vai o que fazer com ele: antes de PEDIR qualquer informação, conferir a lista; o que
já foi dito não se pede de novo — parte-se dele e pede-se só o que falta (o detalhe, o documento, a
confirmação).

## 2. A sugestão derrubava o preço que o próprio corretor tinha ancorado

Na mensagem 1 o app escreveu para a cliente: *"estamos olhando imóveis na faixa de R$ 720 a R$ 900
mil"*. A conta está certa (R$ 360 mil de terrenos cobrindo de 40% a 50% da compra), e ela é do
próprio fichário. **Mas o corretor já tinha dito a ela, no dia anterior: "o valor da compra teria
que ser em torno de 800 mil".** Repetir a ponta de baixo da faixa devolve a negociação pra um número
abaixo do que ele mesmo colocou na mesa — perde sem ganhar nada.

O fichário passa a mostrar, coladinho na faixa, **o valor que o próprio corretor já colocou na mesa
dentro dela** (aqui: R$ 800.000, dito em 19/08, com o trecho), e a dizer que a faixa é **conta
interna pra pensar, não número pra colar na mensagem**. Valor de outro produto não vira âncora
sozinho: só entra o que cai dentro da faixa calculada — o apartamento de R$ 430 mil do anúncio, por
exemplo, fica de fora.

Nada disso é regra nova de escrita, e nada reescreve o texto da IA (a rede que fazia isso saiu na
v1315 e não volta): é fato pronto, tirado da própria conversa.

## 3. A tela não dizia que a IA estava lendo a conversa pela metade

Naquela conversa, **3 fotos, 1 PDF e 4 áudios continuavam marcados como "conteúdo não analisado"** —
inclusive o mapa da localização e a imagem do apartamento de 43 m². A análise saiu completa, com
cara de completa, e **nada na tela avisava que faltava esse material**.

Agora avisa, nos dois lugares:

- **na linha de prova do lead** (a mesma que já diz quanto da conversa e do Cérebro entrou): "a IA
  não leu 3 fotos, 1 PDF e 4 áudios desta conversa", em vermelho, com o que fazer — exportar a
  conversa no WhatsApp com **"Incluir mídia"** e importar de novo;
- **no resultado da importação**, na hora, quando sobrar foto ou PDF sem ler.

Vídeo fica **fora** dessa conta de propósito: ele nunca é lido, por decisão do dono, então avisar
seria alarme de algo que não tem conserto. A contagem viaja salva com a análise, senão o aviso
apareceria ao reanalisar e sumiria ao reabrir o cliente pela carteira.

## A conversa fixa ganhou o dia de hoje

`tests/conversa-fixa-permuta.mjs` continua com as 64 mensagens originais intactas (é o caso
"atendimento em aberto, cinco mensagens sem resposta", em que vários testes se apoiam) e ganhou uma
segunda versão, `CONVERSA_COM_RESPOSTA`, com as duas mensagens reais de 20/08: a virada enviada pelo
corretor e o **"Não temos pressa"** dela. São as 66 mensagens que o app mostra na tela hoje.

## Verificação

- Guarda nova: `tests/v1323-o-que-o-cliente-ja-disse-e-a-ancora.test.mjs` — a fala da esquina da
  Ouro Preto na lista, a fala de janeiro sobrevivendo ao teto, linha de anexo e "Sim" fora dela, a
  âncora de R$ 800.000 encontrada (e o R$ 430 mil de outro produto recusado), o texto do fichário
  com as duas instruções, a contagem 3 fotos + 1 PDF + 4 áudios, o vídeo fora da conta, e as pontas
  ligadas (análise → salvamento → tela do lead → tela da importação).
- `tests/v1178` guardava a ordem exata dos avisos na importação e foi atualizado para incluir o novo.
- Chromium (390px e 1280px): a linha de prova com o alerta em vermelho e a caixa da importação, no
  tema escuro, sem estouro de largura. A conferência foi feita com as duas peças renderizadas com o
  CSS publicado — a tela do lead inteira depende de conta e dados reais, que esta sessão não tem.
- `npm test`: 30 arquivos checados + 468 testes, verdes.
