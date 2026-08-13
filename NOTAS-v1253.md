# v1253 — o pedido do cliente que ficou sem resposta passa a mandar na sugestão nº 1

Veio de um caso real que o dono trouxe com print: a lead **Milena**, do loteamento Nova Vila
Rica III.

## O que aconteceu na conversa

| Quando | Quem | O quê |
|---|---|---|
| 10/06 09:25 | Cliente | "Gostaria de mais informações sobre **valores de terreno**. E tudo mais." |
| 10/06 14:10 | Corretor | Respondeu a **condição de pagamento** (20% + 60x), o prazo, o link e um vídeo |
| — | — | **O valor do lote nunca foi enviado** |
| 07/08 | Corretor | Follow-up: "tem alguma **metragem ou localização** preferida?" → cliente não respondeu |
| 13/08 16:39 | Cliente | Voltou sozinha: "Boa tarde. Tudo bem?" |
| 13/08 17:01 | Corretor | "Boa tarde, tudo e vc?" |

## O que o app sugeriu (errado)

- **Nº 1, "Recomendada"** — perguntava de novo sobre metragem/localização. É **a mesma pergunta
  de 07/08 que a cliente já tinha ignorado**, reescrita com outras palavras.
- **Nº 2, "Alternativa"** — também perguntava (centrais ou laterais?).
- **Nº 3, "Direta ao ponto"** — a única que oferecia a tabela de valores, ou seja, a única que
  atendia o pedido de 10/06. Ficou em **último**.

E a nº 1 abria com "Boa tarde Milena!" — o corretor **acabara de dizer "Boa tarde" às 17:01**.
Copiando aquela sugestão, ele daria boa tarde duas vezes seguidas.

## Por que o app errou

Duas coisas, as duas na instrução que a IA recebe pra montar as sugestões:

1. **O pedido do cliente em aberto era só um dado de diagnóstico.** O app já detectava e mostrava
   "Pedido do cliente ainda sem resposta direta" no painel — mas **nada mandava as três mensagens
   fazerem alguma coisa com aquilo**. Ficava só escrito na tela, pro corretor ler.
2. **A pergunta do corretor tinha prioridade e o pedido do cliente não.** A instrução dizia, com
   todas as letras, que uma pergunta de qualificação que o cliente não respondeu "costuma ser o
   passo que mais destrava a conversa; priorize-a entre as três mensagens" — sem nenhum limite.
   Então a pergunta do CORRETOR ganhava do pedido do CLIENTE. Foi exatamente o que aconteceu.

## O que mudou

**1. Pedido do cliente em aberto manda na nº 1.** Quando existe um pedido do cliente que nunca
foi atendido, a sugestão "Recomendada" agora **precisa entregar aquilo** (ou dizer que está
enviando agora) — nunca fazer uma pergunta no lugar da entrega. E vale mesmo depois de meses: o
tempo parado não cancela o pedido, aumenta a dívida.

**2. A pergunta do corretor deixa de atropelar o pedido do cliente.** Ela continua importante,
mas agora vai **junto da entrega**, nunca no lugar dela. E refazer sozinha uma pergunta que o
cliente já ignorou — só trocando as palavras — está proibido como conteúdo de mensagem: é repetir
a mensagem que já falhou.

**3. Nada de cumprimentar duas vezes.** Se a última mensagem da conversa já for um cumprimento do
próprio corretor ("boa tarde", "oi", "tudo bem?"), a sugestão não abre com saudação nenhuma —
começa direto pelo assunto.

## O que isso muda na prática

Na conversa da Milena, a nº 1 passa a ser uma mensagem que **manda a tabela de valores** — o que
ela pediu em 10/06 e nunca recebeu — em vez de perguntar pela terceira vez o que ela prefere.
A pergunta sobre metragem continua existindo, mas emendada na entrega: ela olha os valores,
escolhe, e aí responde.

## O que NÃO mudou

Nenhuma informação comercial foi cravada no código — nem valor, nem empreendimento, nem nome de
pessoa. Tudo continua vindo do Cérebro e da própria conversa.

As regras entraram no prompt de quem **TEM Cérebro** (o prompt principal), nunca só no modo
prévia — é a regra da v1247, e o teste novo verifica isso de propósito.

## Teste

`tests/v1253-pedido-do-cliente-manda-na-recomendada.test.mjs`, com a linha do tempo da conversa
real escrita por extenso, travando as três regras e o lugar onde elas moram.
