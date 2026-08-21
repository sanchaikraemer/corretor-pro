# v1333 — o material que ficou pra trás passa a ser lido na próxima importação

Print do dono, 20/08/2026, na conversa de um cliente antigo: **"a IA não leu 11 fotos, 2 PDFs e 2
áudios desta conversa"**. E ele: *"Mentira, sempre, sempre vai com mídia"* — está certo, e a frase
da tela que mandava reexportar era mentira (corrigida na v1332).

## O que estava acontecendo

O plano de leitura pegava **os 6 arquivos mais recentes** citados na conversa. Reimportando, pegava
**os mesmos 6**. O 7º em diante nunca era lido — nem reimportando dez vezes. Entre os esquecidos
estava justamente a proposta em PDF que a própria análise citava.

## O que mudou

- O plano agora **pula o que este cliente já teve lido** e desce a fila dos que faltam. Cada
  reimportação avança no atraso em vez de repetir o mesmo trabalho.
- O teto por importação subiu de **6 para 10**. Com a fila andando, esse número virou o *passo* com
  que ela anda: uma conversa com 13 arquivos que precisava de três importações agora precisa de
  duas. Quem segura o custo continua sendo o **teto diário por conta**, conferido antes de gastar
  (e ajustável por `DIRECIONA_MAX_VISUAIS_IMPORT`).
- **Link do corretor segue a mesma regra**: eram sempre os 2 mais recentes; agora os já lidos saem
  da fila e a importação seguinte pega os que faltam.

Nada disso relê o que já foi lido — o cache por cliente da v1312 continua entregando o texto pronto,
de graça.

## Guarda

`tests/v1333-material-pendente-e-lido-na-proxima.test.mjs`: a fila anda (13 arquivos = 10 + 3 e
depois nada), o já lido nunca volta a custar leitura, a lista de citados continua inteira pra tela
saber quanto falta, e a mesma regra vale pros links.

Suíte: 34 arquivos checados + 479 testes, todos verdes.
