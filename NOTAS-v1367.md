# v1367 — quando o cliente pergunta, a resposta vem antes de tudo

## O caso (print do dono, cliente Adairton, 22/08/2026)

O cliente chegou por um anúncio do Facebook, perguntou do apartamento de R$ 430 mil, disse que é
pra **morar**, recebeu os dois vídeos e escreveu a última coisa da conversa:

> **Em qual cidade.**

E ficou esperando. As três sugestões que o app entregou:

1. *"Demorei para te responder sobre a cidade... Vou te confirmar isso ainda hoje e, se ficar bom
   para ti, podemos deixar uma visita para segunda-feira, 24/08, de manhã?"*
2. *"A informação da cidade ficou pendente comigo. Ainda hoje eu te confirmo certinho..."*
3. *"Vou confirmar a cidade do apartamento ainda hoje. Para a visita, consigo te atender..."*

**Nenhuma respondia a cidade.** E as três faziam o corretor parecer que não sabe onde fica o
próprio apartamento — na frente de um cliente que só queria saber isso pra seguir adiante.

Rodando essa conversa pelo app, apareceram **três causas**. Duas foram criadas por mim na v1364.

## Defeito 1 — a pergunta do cliente não era tratada como pergunta

O app tinha a lista das perguntas que **o corretor** fez e o cliente não respondeu. Não tinha a
lista contrária. Então "Em qual cidade." afundava no meio de "o que o cliente já disse", como se
fosse mais uma fala qualquer — quando é a coisa mais importante da conversa: **tem alguém
esperando resposta.**

Agora existe o bloco **"O CLIENTE PERGUNTOU E NINGUÉM RESPONDEU"**, e ele vem cedo, com a regra:
responder isto vem antes de qualquer jogada — antes de convite, de visita e de pergunta nova. E,
explicitamente: **não vale trocar a resposta por uma promessa** ("vou verificar e te confirmo")
quando é informação óbvia do próprio produto (cidade, bairro, tamanho, preço já dito). Se a
resposta não estiver na conversa nem no Cérebro, a mensagem sai com espaço claro pra você
completar — o app nunca inventa o dado.

Dois detalhes que vieram da conversa real: **cliente não usa ponto de interrogação** ("Em qual
cidade." veio com ponto final), então a pergunta também é reconhecida pelo começo da frase; e
**pergunta de cliente é curta**, então o corte de tamanho da lista irmã jogaria fora justamente as
que mais importam.

## Defeito 2 — o anúncio do Facebook virava compromisso de visita *(meu, da v1364)*

A frase automática que o Facebook dispara quando alguém clica no anúncio — *"Anúncio do Facebook
... Quer agendar uma visita?"* — era lida como se **você** tivesse proposto uma visita. Daí nascia
um compromisso "de pé" com pendência de dia e hora, e o fichário mandava, com todas as letras, as
três mensagens convergirem em marcar. É por isso que as três empurravam visita em vez de responder.

Robô de anúncio não combina nada com ninguém: **o compromisso só começa quando uma pessoa fala em
marcar.** A mesma frase também saiu da lista "próximos passos que o corretor já propôs" — pelo
mesmo motivo, você não propôs nada ali.

## Defeito 3 — o app inventava uma dívida sua

O app dizia: *"o corretor prometeu e ainda não apareceu: valor/preço"*. Só que **o preço estava na
mesma mensagem** — "O valor é R$ 430 mil e pode ser financiado. Vou te mandar videos dele." O app
só procurava a entrega nas mensagens **seguintes**, nunca na própria.

Como ele achava que você devia alguma coisa, entrava a regra "reconheça o atraso na primeira
frase". Daí saíram o *"Demorei para te responder"* e o *"ainda hoje eu te confirmo"*.

Agora o que a própria mensagem já entrega conta como entregue. E a dívida de verdade continua
sendo apontada: quem escreve "custa R$ 430 mil, te mando as fotos depois" entregou o valor e ainda
deve as fotos — é isso que a lista passa a dizer.

## Uma regra nova de convivência

Quando existe pergunta do cliente esperando resposta, o bloco do compromisso **cede a vez**: ele
continua no fichário como fato (quem propôs, o que ficou pendente), mas para de mandar as três
mensagens convergirem em marcar dia e hora. Responder primeiro; convidar depois, na mesma mensagem
ou nas outras duas.

## Verificação

- Suíte completa verde: 34 arquivos + **507 testes**.
- Teste novo (v1367) com a conversa real do Adairton, trancando os três defeitos, mais os dois
  contrapesos: pedido de visita do cliente continua sendo compromisso (não vira "pergunta sem
  resposta"), e pergunta já respondida não vira cobrança.
- O teste do caso Vande foi ajustado: naquela conversa o bloco "próximos passos que o corretor já
  propôs" desapareceu — e desapareceu certo, porque o único item era a frase automática do anúncio.
  A checagem de ordem continua valendo com um convite escrito de verdade pelo corretor.
