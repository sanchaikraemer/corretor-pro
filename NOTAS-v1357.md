# v1357 — o "vocês" inventado, e a senha da leitura que passava batido

Dois problemas no print que você mandou.

## 1. As três sugestões falavam no plural

*"Esse horário funciona para vocês?"*, *"vocês preferem mais cedo"*, *"que funcione para vocês"*.

O Vande é **uma pessoa**. Na conversa inteira ele fala de si no singular — "estou em visita", "não
vou chegar a tempo", "te confirmo" — e você o trata por **"o Sr"**. O plural foi inventado. E isso
custa caro: mensagem no plural pra quem está sozinho parece modelo mandado pra qualquer um, e o
cliente sente.

O conserto não foi mandar a inteligência "escrever melhor". O app agora **conta e diz**: lê a
conversa, confere se o cliente alguma vez falou de si no plural ("nós", "a gente", "nosso"), confere
como você o trata, e escreve isso como fato dentro do pedido:

> É UMA pessoa só. O corretor trata este cliente por "o Sr". Escreva no singular. Não use "vocês",
> "de vocês", "para vocês", "preferem".

**Cliente que fala no plural continua no plural.** Se o cliente disser "nós vamos ver", ou se você
já o tratar por "vocês", o app não força nada — a régua é a sua conversa, não uma opinião minha.

## 2. A leitura da imagem devolvia a senha como se fosse conteúdo

Na sua conversa aparece esta linha:

> [Imagem lida pela IA] SEM CONTEÚDO COMERCIAL

A leitura funcionou e respondeu **certo**: naquela imagem não havia nada comercial. O problema é que
o app procurava exatamente "SEM CONTEUDO COMERCIAL" **sem acento**, e a resposta veio com "Ú". Não
bateu — então o app tratou a senha como se fosse o texto da imagem e mandou essa frase pra dentro
da análise, como fato da conversa.

Agora a conferência ignora acento, maiúscula e ponto final. A senha volta a ser senha.

## Na prática

Reimporte a conversa do Vande. As mensagens saem no singular, tratando ele por "o Sr", e a análise
não vai mais carregar aquela linha de "SEM CONTEÚDO COMERCIAL" como se fosse informação.
