# NOTAS v1021 — número da barra sobrepondo o nome do produto no celular

## O relato

Print do dono, no celular: o número da barra de mensagens (ex.: "29", "232") aparecia por cima do
nome do empreendimento ao lado — dava pra ler coisas como "Ren**29**aissance" e "Ev**23**lutti"
misturados, os dois praticamente ilegíveis.

## Causa

No celular, a barra de mensagens e o nome do produto dividem a mesma linha, um do lado do outro.
Quando o nome do produto era mais comprido, sobrava pouco espaço pra barra — mas a barra tinha um
tamanho FIXO que nunca diminuía pra caber no espaço que sobrou. Resultado: em vez de encolher, ela
"vazava" por cima do texto do produto.

Reproduzi o problema isolado (mesmo estilo visual, fora do app) pra confirmar a causa exata antes
de mexer em qualquer coisa, e testei a correção do mesmo jeito antes de aplicar no código de
verdade — incluindo um caso ainda mais apertado (produto com nome bem comprido, número de 3
dígitos) pra garantir que não volta a acontecer.

## Correção

A barra de mensagens no celular agora encolhe quando o nome do produto é mais comprido, em vez de
sobrepor o texto. Continua com o mesmo tamanho "comprido" de sempre quando há espaço sobrando.

## Teste novo

`tests/v1021-barra-mobile-nao-sobrepoe-produto.test.mjs`. Dois testes existentes (v976 e v978)
travavam o valor fixo antigo da barra no celular — atualizados para a barra responsiva, sem mudar
o que garantem no desktop (que não teve esse problema e não mudou).

## `npm test`

Suíte inteira verde.
