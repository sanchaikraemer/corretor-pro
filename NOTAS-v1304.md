# v1304 — a prova embaixo das sugestões virou porcentagem, verde e vermelho

Pedido do dono, olhando a linha cinza embaixo das sugestões: *"mude esses números para percentual,
verde 100% e quando não conclui vermelho"*.

## Como era

> seu Cérebro enviado: método 6.577, tom 1.892, diferenciais 2.519, o que evitar 3.115, regras
> 6.037, objeções 6.319 (26.459 caracteres)

Seis contagens de caracteres. Para saber se estava tudo lá, era preciso somar de cabeça e lembrar de
quanto tinha cada campo do Cérebro.

## Como ficou

> Análise feita com o seu Cérebro · leu **100%** da conversa (2 mensagens) · seu Cérebro: **100%** ·
> aprendizado aplicado: seu jeito de escrever, 1 mensagem sua desta conversa

Duas porcentagens, cada uma respondendo uma pergunta:

- **quanto da conversa** a IA leu de verdade;
- **quanto do seu Cérebro** chegou até ela.

**Verde só no 100%.** Qualquer coisa abaixo disso aparece em **vermelho**, com o motivo do lado:

> leu **62%** da conversa (81 de 130 mensagens — conversa longa demais) · seu Cérebro: **68%**
> (parte do texto não coube e ficou de fora)

## O que essa porcentagem mede

O Cérebro tem um limite de tamanho por campo (proteção antiga, pra um campo sozinho não estourar o
espaço da conversa). Se você escrever mais que isso, o excesso é cortado antes de ir pra IA — e até
agora **esse corte era invisível**: a linha mostrava o número enviado e você não tinha como saber
que faltava pedaço. Agora a porcentagem é a divisão do que foi enviado pelo que está salvo: se der
menos que 100%, alguma coisa ficou de fora e a tela avisa em vermelho.

Conta sem Cérebro nenhum mostra **0%**, não 100% — número zerado não pode se passar por tudo certo.

## Conferido na tela, não só no teste

A linha foi aberta num navegador de verdade, em tamanho de celular (412 px), com o CSS publicado: o
verde do 100% sai em #25D366 e o vermelho em #E35454, os dois legíveis sobre o fundo do cartão, sem
rolagem lateral. (Vale a lição da v1078: teste verde não enxerga cor atropelada por regra antiga de
CSS.)

Guarda: `tests/v1304-cerebro-em-porcentagem.test.mjs`.
