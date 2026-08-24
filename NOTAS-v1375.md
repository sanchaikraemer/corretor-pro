# Corretor Pro — v1375

## Correção do build

O deployment estava sendo interrompido pelo teste legado `v1145-ia-so-escreve-o-que-aparece.test.mjs`.

A aplicação já havia evoluído para permitir uma guarda condicional antes de gravar `proximoPasso` e `mensagemQueEuEnviariaHoje`, mas o teste ainda exigia a forma textual antiga da propriedade (`proximoPasso: clean(...)`). O fallback protegido pela v1145 continuava presente e correto; o teste é que estava desatualizado.

A v1375 atualiza somente essa asserção estrutural: ela continua exigindo que `proximoPasso` tenha fallback em `raw.nextAction` e que a mensagem gravada venha de `msgA`, sem obrigar que não exista uma guarda antes deles.

Nenhuma regra comercial da v1374 foi alterada.
