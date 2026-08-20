# v1329 — os quatro fatos que faltavam pra análise parar de errar

Comparação do dono, em 20/08/2026, entre a análise do app e a leitura da MESMA conversa feita à
mão. Quatro buracos apareceram — e nenhum deles é "a IA precisa ser mais esperta": são fatos que o
app pode calcular sozinho, do texto da conversa, e entregar prontos. É o mesmo remédio da v1317.

## 1. A pergunta que o cliente nunca respondeu

O corretor perguntou se o cliente pretendia **financiar o saldo**. O cliente respondeu sobre o bem
que ofereceu em troca e passou por cima da pergunta. Era a pergunta que decide se a compra existe —
a permuta cobre parte, e o resto ninguém sabe de onde vem. **Nenhuma das três sugestões tocou nela.**

O fichário já tinha a lista de perguntas JÁ FEITAS (que impede repetir). Agora tem a lista contrária:
as que **precisam voltar**, porque nunca foram respondidas.

Como o app decide, sem palpite: olha só as falas do cliente **depois** da pergunta; se a primeira
delas é um sim/não curto ("Sim", "Não temos pressa", "Pode ser"), conta como respondida; senão,
procura nas falas dele qualquer palavra de conteúdo da pergunta. Não achou o assunto, entra na lista.
Só entram perguntas que **decidem** a negociação (dinheiro, faixa, prazo, tamanho, região, quem
decide) — pergunta de cortesia, convite de visita e pergunta genérica ficam de fora, senão a lista
vira ruído e a pergunta que vale afunda no meio. Máximo de 5.

O texto entregue à IA diz que o app **não achou** resposta — não que o cliente se recusou a
responder. É conferência de assunto, não de intenção.

## 2. O produto recusado, com o MOTIVO

A sugestão da tela voltou num apartamento que a cliente tinha descartado por **tamanho**, porque a
faixa de **preço** dela tinha mudado. Motivo diferente: a faixa mudar não devolve o produto.

Agora cada recusa do cliente entra no fichário com o motivo lido da fala dele — TAMANHO, PREÇO,
LOCALIZAÇÃO, PRAZO ou POSIÇÃO —, com a data, o que estava em discussão naquele momento e o valor
que estava na mesa. E a regra que acompanha: recusado por preço pode voltar quando a faixa muda;
recusado por tamanho, local, prazo ou posição só volta se **aquilo** mudou.

## 3. A promessa que o corretor fez e não cumpriu

A sugestão inventou uma pendência ("ficou pendente eu te confirmar os 2 banheiros") que nunca
existiu — enquanto a pendência real passava batida: dois meses antes, o corretor tinha perguntado se
podia enviar o valor e as condições, e **o valor nunca foi**. A cliente sumiu ali mesmo.

O app agora varre a conversa atrás do que o corretor disse que ia mandar ("te envio", "vou
confirmar", "posso te enviar") e confere se, nos 3 dias seguintes, saiu dele alguma mensagem com
valor, arquivo ou link. Não saiu, é pendência aberta. Vai pro fichário com a data e a frase — e com
a instrução: **não invente pendência que não está nesta lista**.

## 4. Cada imóvel testado contra a regra de permuta do próprio corretor

Uma leitura feita à mão propôs reabrir um imóvel cujo preço fazia a permuta cobrir **53,7%** da
compra — acima do teto de 50% que o próprio corretor tinha dito na conversa. Aritmética, não opinião.

O fichário já calculava a faixa que a permuta abre. Agora ele também testa **cada valor já citado na
conversa** contra a regra dita pelo corretor, e marca "cabe na regra" ou "FORA da regra", com a
porcentagem. Na conversa fixa isso sai assim: o imóvel do anúncio fica fora (a permuta cobriria
84%), o imóvel antigo fica fora (54%) e o valor que o próprio corretor colocou na mesa cabe (45%).

## O que NÃO mudou

Nenhuma regra nova de escrita, nada reescrevendo o texto da IA, nenhuma informação comercial cravada
no código (o teste da conversa fixa continua proibindo nome, empreendimento e preço dentro do app).
Tudo aqui é conta sobre o texto da própria conversa, entregue como fato — do mesmo jeito que a v1317.

## Guarda

`tests/v1329-fatos-que-faltavam-na-analise.test.mjs`, rodando contra a conversa fixa do projeto:
a pergunta do saldo aparece como em aberto e a que o cliente respondeu ("não temos pressa") não;
a recusa por tamanho fica ligada ao valor que estava na mesa; a promessa cumprida não vira pendência
e a não cumprida vira; e os três valores saem com o veredito certo contra a regra de permuta.

## Suíte

`npm test`: 31 arquivos checados + 475 testes, todos verdes.
