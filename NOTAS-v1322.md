# v1322 — sem fala de funil na mensagem, e o produto largado por preço volta quando a faixa muda

Dois defeitos apontados pelo dono no print das 09:51 (v1321), os dois com causa no pedido fixo.

## 1. "Você tinha entrado pelo apartamento"

Linguagem de sistema numa mensagem pro cliente. Cliente não "entra" por nada — ele pergunta, pede,
responde. O pedido fixo proibía jargão de escritório, mas não proibía descrever o cliente pra ele
mesmo em fala de funil ("você demonstrou interesse", "seu perfil de busca", "sua jornada"). Agora
proíbe: a mensagem fala do IMÓVEL e do que a pessoa DISSE ("o apartamento de R$ 430 mil que você
perguntou", "você me disse que 43 m² ficou pequeno").

## 2. O produto de janeiro sumiu das jogadas

O pedido mandava "não ressuscitar produto superado" sem definir superado — e produto abandonado
POR PREÇO era tratado como superado mesmo quando a virada abriu uma faixa nova em que ele volta a
caber. Agora tem definição: superado é só o que o cliente descartou por critério que continua
valendo (tamanho, região, tipo). Largado por preço, com faixa nova, é candidato de novo — e
reabri-lo pelo ponto da objeção que ficou de pé é jogada legítima (a jogada 3 da análise-modelo).

A proteção original das v1280/v1289 (recusa registrada não volta pro cliente) continua de pé; os
dois testes foram ajustados só na vírgula, com a nuance documentada.

## Testes

`tests/v1322-produto-por-preco-volta-e-sem-fala-de-funil.test.mjs`, rodando fim a fim na conversa
fixa. `npm test`: 30 arquivos checados + 466 testes, verdes.
