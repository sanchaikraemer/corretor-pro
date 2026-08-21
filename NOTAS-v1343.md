# v1343 — a revisão achou duas coisas: uma que já estava travando a publicação e um bug de virada de ano

Você mandou revisar se tudo ficou funcionando. Revisei, e **não estava**. Dois problemas reais, os
dois corrigidos aqui.

## 1. A publicação estava travada desde a meia-noite (e ninguém tinha percebido)

Uma das conferências automáticas tinha um número escrito na mão: "há 211 dias". Esse 211 era a
distância entre uma data da conversa de teste e o dia em que a conferência foi escrita — ontem. À
meia-noite virou 212, a conferência ficou vermelha sozinha, **sem ninguém ter mexido em nada**.

E como a trava nova (versão 1338) para a publicação quando alguma conferência está vermelha, o
resultado seria exatamente o que te irritou na 1324: **versão nova pronta e site sem atualizar**.
Peguei antes de você ver.

Corrigido: a conta agora é feita na hora, não escrita na mão.

## 2. Na noite de 31 de dezembro, remarcar compromisso ia dar erro

Esse é bug de verdade, no app. A parte do sistema que remarca um compromisso conferia o ano usando
**o relógio de Londres**. Às 21h do dia 31 de dezembro em Brasília, em Londres já é 1º de janeiro —
então o sistema achava que o ano já tinha virado e **recusava** um compromisso marcado pro próprio
dia 31, com a mensagem "Data fora do intervalo válido". No Acre o erro começaria às 19h.

Corrigido: o ano agora é o que **você** está vivendo, em qualquer ponto do país. O resto da regra
continua igual — não dá pra marcar num ano que já passou, e o limite de 5 anos à frente segue valendo.

## Como achei — e o que fica de proteção

Rodei a conferência inteira do sistema **com o relógio adiantado**: 31 de dezembro às 23h50, março
de 2027, novembro de 2028 e fevereiro de 2030. Foi assim que as duas coisas apareceram. Corrigi
mais duas conferências que tinham datas escritas na mão e explodiriam na virada do ano pelo mesmo
motivo.

Hoje a conferência inteira passa nos quatro momentos futuros que testei — ou seja, o sistema não vai
mais travar sozinho numa madrugada.
