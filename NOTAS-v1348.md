# v1348 — três arquivos sumiram da análise e nenhuma tela te avisou

Seu print das 15h22 de hoje mostra o card "Últimas mensagens" do cliente Gordo. As três últimas
linhas da conversa — todas **depois** de você perguntar *"Ele teria alguma entrada? Ou até permuta,
carro, moto..."* — eram a mesma frase repetida:

> [Arquivo enviado nesta mensagem: arquivo — conteúdo não analisado pela IA]

Você estava certo em achar isso grave. No momento mais importante daquele atendimento, três
arquivos foram trocados, **a IA não fazia ideia do que tinha neles** — e em lugar nenhum do app
isso estava escrito.

## Por que aconteceu

Quando o WhatsApp exporta a conversa **sem os arquivos** (a opção leve, a que quase todo mundo usa),
cada foto, PDF, catálogo ou áudio vira uma linha só: `<Mídia oculta>`. Essa linha **não diz o tipo**
— não dá pra saber se era foto, PDF ou áudio.

O app já tinha um aviso pronto pra isso, desde a versão 1323: *"a IA ainda não leu X fotos e Y PDFs
desta conversa"*. Só que a conta por trás dele só sabia contar três coisas: **foto**, **PDF** e
**áudio**. Arquivo sem tipo — que é exatamente o que a exportação leve produz — **não era contado**.
A conta dava zero. Zero não dispara aviso nenhum.

Ou seja: o aviso existia justamente pra esse problema e era **cego no caso mais comum de todos**.

## O que mudou

**1. Arquivo que não veio agora é contado — e aparece na tela do cliente.**
Na mesma linha de prova onde já aparecia "a IA não leu tal coisa", entra agora:

> *3 arquivos não vieram nesta conversa* (ela foi enviada SEM os arquivos — a IA sabe que houve
> envios ali, mas não o que tinha dentro deles. Reexporte no WhatsApp com **"Incluir mídia"** e
> importe de novo)

São **dois problemas diferentes com consertos diferentes**, e agora cada um tem a sua frase:
- **não foi lido** → o arquivo veio, mas o app lê só alguns por importação. Conserto: reimportar.
- **não veio** → o arquivo não está na conversa que você mandou. Conserto: reexportar com mídia.

Antes, misturar os dois era mandar você fazer um trabalho que não resolvia nada.

**2. O aviso da hora da importação parou de falar só de áudio.**
Ele dizia *"os áudios não vieram no arquivo"*. Mas na exportação leve não é só o áudio que some —
foto, PDF, tabela de preço, tudo vai junto. Agora ele diz isso, com o número: *"3 arquivos ficaram
de fora — foto, PDF e áudio não vieram"*.

**3. Exportação de iPhone sem mídia também passou a ser reconhecida.**
O iPhone escreve *"imagem omitida"* na linha, sem os sinais `< >` que o Android usa. A conta só
enxergava o formato do Android — então quem exporta do iPhone sem mídia não recebia aviso nenhum.

**4. Três fotos numa mensagem só agora contam três.**
A conta era por mensagem: quem manda três fotos de uma vez aparecia como se tivesse mandado uma.

**5. Na tela, o marcador virou uma linha em vez de um parágrafo.**
Era isso que estava empilhado no seu print: a mesma frase de 26 palavras, três vezes. Agora cada
uma dessas linhas aparece assim:

- 📎 Arquivo enviado — não veio no envio da conversa
- 📎 Foto enviada — a IA não leu o conteúdo
- 📎 PDF enviado — a IA não leu o conteúdo
- 📎 Áudio enviado — não virou texto
- 📎 Vídeo enviado — a IA não lê vídeo

Isso é **só aparência**: o registro guardado não muda, e o botão **"Copiar histórico" continua
copiando a frase inteira** — ele é a prova do que aconteceu e não pode ser encurtado.

## O que fazer com a conversa do Gordo

Reexporte ela no WhatsApp escolhendo **"Incluir mídia"** e importe de novo. Aí a IA lê as fotos e os
PDFs que foram trocados ali — inclusive os três das últimas mensagens, que são justamente a resposta
à sua pergunta sobre entrada e permuta.

Se um deles for áudio, ele é transcrito. Se for vídeo, aí não tem jeito: o app não lê vídeo (decisão
sua, de outra conversa) — mas pelo menos agora ele diz isso na cara, em vez de ficar calado.
