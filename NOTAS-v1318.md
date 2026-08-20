# v1318 — as três mensagens saem prontas pra enviar

Print do dono (20/08/2026, 07h32, na versão 1317). A **leitura** da conversa ficou boa — pegou a
permuta, os 3 terrenos, os R$ 360 mil, a faixa dos R$ 800 mil e até escreveu "evite insistir em
visita, repetir a pergunta sobre financiamento ou tratar a permuta como aprovada".

As **três mensagens**, não: *"sem bom dia, sem saudação, sem retomada, veja q lixo de sugestões"*.
E as três terminando na mesma pergunta.

## A causa (não era o Cérebro dele)

Ele perguntou se precisava desligar as regras do Cérebro. Não precisava — e o Cérebro dele chega
inteiro na IA (o teto por caixa é de 20 mil caracteres; o texto dele está longe disso, os 100% da
tela são reais). O defeito estava em duas linhas do **pedido fixo do app**, aquele que vai em toda
análise e que o corretor não vê nem edita:

1. **A saudação era delegada e nunca exigida.** O pedido dizia "a saudação (...) deve seguir o
   Cérebro". A regra das faixas de horário existe no Cérebro dele e chegava na IA — só que, sem
   ninguém EXIGIR que houvesse cumprimento, ela se perdia no meio do resto.
2. **Recomendar esperar liberava mensagem pela metade.** A IA marcou "aguardar, sem mandar
   mensagem" e continuou obrigada a preencher as três. Devolveu rascunho.

## O que mudou

- **Piso de forma, valendo para as três, sempre**: toda mensagem abre cumprimentando pelo primeiro
  nome; havendo dias parados, a recomendada reconhece o intervalo antes de pedir qualquer coisa;
  toda mensagem termina de um jeito que a pessoa consiga responder. *"Mensagem que começa direto no
  assunto, sem cumprimento, é rascunho — não devolva rascunho."*
- **Convergir no passo não é repetir a pergunta.** As três podem ir para o mesmo próximo passo
  (regra do Cérebro dele) — mas por caminhos diferentes: uma responde o que o cliente pediu, outra
  traz o que ele não sabe, outra trata a objeção de pé. Terminar as três na mesma pergunta, com as
  mesmas palavras, é uma mensagem escrita três vezes.
- **Recomendar esperar não libera rascunho**: as três continuam sendo as mensagens completas para
  enviar quando o prazo vencer.

## Duas regras do dono que continuam intocadas

Durante o trabalho eu cheguei a remover as duas, e os testes antigos me pararam — funcionaram:

- **A convergência das três** é do Cérebro dele (documento V3, 10/08/2026) e foi conciliada com o
  pedido fixo na v1206. Voltou inteira; só ganhou a proibição de repetir a pergunta ao lado.
- **A autoridade do Cérebro sobre saudação, retomada e próximo passo** é da v1225. Continua escrita
  como estava. O Cérebro decide QUAL saudação e se reconhece o intervalo; o piso novo só garante
  que a mensagem chegue inteira. Se o Cérebro define faixas de horário próprias, valem as dele.

Nada aqui reescreve o texto da IA. A rede que fazia isso saiu na v1315 e não voltou.

## Testes

`tests/v1318-mensagem-pronta-pra-enviar.test.mjs`, em cima da conversa fixa: as regras novas no
pedido, as duas regras do dono ainda de pé, a instrução do "aguardar" fora do formato de resposta
(dentro dele a IA podia devolvê-la como se fosse um campo) e o fim a fim até o pedido enviado.

`npm test`: 30 arquivos checados + 462 testes, verdes.
