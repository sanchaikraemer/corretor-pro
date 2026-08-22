# v1368 — nove sugestões, nove perguntas: o interrogatório acabou

## O que o dono mandou (prints de 22/08/2026 — Flavio, Ilario e Julsimar)

Três clientes diferentes, nove sugestões de mensagem. **As nove perguntavam alguma coisa ao
cliente. Nenhuma entregava nada** — nem um número, nem uma data, nem uma resposta.

- **Flavio:** "era sobre imóvel ou sobre contratação de empreiteiros?", "me diz o que chamou sua
  atenção nele", "me envie uma imagem ou o link do anúncio".
- **Ilario:** "é sobre o Edifício Evolutti ou outro imóvel?", "o que quer saber primeiro?", "me
  envie a imagem ou o link".
- **Julsimar:** "o que pesa mais: reduzir a entrada ou os reforços?", "posso preparar duas formas,
  qual quer ver primeiro?", "me diga quanto pensa colocar na entrada".

O cliente chega perguntando e leva um interrogatório de volta. E o app **não reclamava de nada**,
porque cada mensagem, olhada sozinha, parecia correta.

## O que mudou

### 1. Pelo menos uma das três precisa ENTREGAR

Quando o app sabe que havia o que entregar — um valor já citado na conversa, uma pergunta do
cliente esperando resposta, ou uma visita pendente de data — ele agora exige entrega: um número,
uma condição montada, um dia com hora, a resposta que ele pediu. E deixa claro o que **não** é
entrega: dizer que você *pode* preparar ("posso preparar duas formas de pagamento", "eu organizo
as informações") é prometer trabalho e devolver a bola.

Se o dado faltar, a mensagem sai com o espaço pra você completar (*"a entrada fica em R$ ___"*) —
nunca vira pergunta pro cliente, e nunca é inventado.

Em conversa que ainda é pura qualificação, perguntar continua sendo o certo e nada é apontado.

### 2. O que é seu não vira pergunta pro cliente

Anúncio publicado, imóvel da carteira, material enviado, preço, cidade, bairro, metragem: isso é
**seu**. Ficou proibido escrever mensagem pedindo ao cliente que identifique ou reenvie o que saiu
de você. Era a raiz do caso Flavio — e a mesma doença do Adairton, onde o app queria você
confirmando a cidade do próprio apartamento.

Perguntar ao cliente só vale para o que **só ele** sabe: o que precisa, quanto pode pagar, quando
pode, quem decide com ele, o que achou do que viu.

### 3. A armadilha que pintava de vermelho a mensagem recomendada

No print do Julsimar a **mensagem 1** — a recomendada — saiu com tarja: *"abre contando os dias
parados"*. Ela abria com *"Há 4 dias você comentou..."*.

O app se contradizia: uma regra manda a recomendada **reconhecer o intervalo** desde a última
mensagem; outra **reprova** quem escreve o número de dias. A IA tentou obedecer as duas e levou a
tarja. Agora está explicado onde precisava estar: reconhecer o intervalo **não é** dizer quantos
dias passaram — é retomar o assunto de onde parou ("sobre as condições que te passei"). Quem conta
os dias é o corretor, não o cliente.

### 4. Nome de campo do programa aparecendo na sua tela

Na ordem de envio do Flavio estava escrito *"use a **maisDireta** para pedir a imagem"*. Isso é
nome interno do código — na tela as sugestões são 1, 2 e 3. O texto ia do robô direto pro card sem
nada traduzir. Agora sai "a mais direta (sugestão 3)". É só tradução de rótulo: nenhuma palavra
comercial é reescrita pelo código.

### 5. Falar do cliente como ficha de cadastro

*"entender melhor a parte do **perfil de compra**"* (print do Ilario). O texto de orientação já
proibia esse jeito de escrever, mas nada conferia se tinha sobrado. Agora confere.

### 6 e 7. As duas tarjas vermelhas que estavam ERRADAS

- **"promete enviar e não pergunta nada"** em cima de *"Me envie uma imagem ou o link do anúncio"*.
  A mensagem pede — só não tem ponto de interrogação, porque no WhatsApp se pede assim. O app só
  entendia pedido com "?". Agora entende "me envie", "me mande", "me confirme", "me mostre".
- **"pede a mesma coisa que a sugestão A"** comparando *"para morar ou investir?"* (finalidade) com
  *"morar logo ou sem pressa?"* (prazo). São perguntas diferentes; compartilhavam só a palavra
  "morar" — e como a segunda tinha só essa palavra, a conta dava 100%. Com uma palavra de cada
  lado, "metade" não significa nada: agora só acusa quando as duas pedem exatamente a mesma coisa.

Os acertos reais das duas continuam: promessa vazia sem pedir nada, e duas sugestões pedindo a
visita ou a faixa de valor.

## O que NÃO mudou

Nada foi mexido no miolo do texto de orientação (a parte que o dono mandou congelar na v1247) —
inclusive a regra contraditória dos dias, que **está** lá dentro: ela foi neutralizada por fora, no
fichário. O código continua sem reescrever uma vírgula do texto comercial da IA.

## Verificação

Suíte: 34 arquivos + **508 testes verdes**. Teste novo (v1368) com as frases exatas dos três prints
— as duas tarjas erradas não podem voltar, o interrogatório precisa ser pego, o nome interno
precisa sair da tela, e os contrapesos (promessa vazia de verdade, duas iguais de verdade,
qualificação legítima) precisam continuar funcionando.
