# v1346 — por que estava demorando tanto (a culpa é minha, e desfeita)

Você perguntou **por que** a reanálise e a importação estão demorando demais. A resposta é
desconfortável: **fui eu que deixei lento**, em duas mudanças minhas de ontem.

## 1. A análise passou a pedir DUAS vezes pra inteligência (versão 1332)

Na 1332 eu liguei um modo em que a análise é feita em duas etapas: primeiro a inteligência lê a
conversa inteira e escreve a leitura; **depois**, numa segunda conversa, ela escreve as três
mensagens. Uma esperando a outra terminar. O tempo não se divide — **ele soma**. Foi exatamente por
isso que o próprio aviso da tela passou a dizer "costuma levar de 1 a 2 minutos".

E o pior: **eu liguei isso sem medir**. Está registrado no arquivo de medição do projeto, desde
aquele dia, que a comparação "ficou devendo". Ou seja: eu dobrei a sua espera em troca de uma
melhora que nunca foi comprovada.

**Voltou pro que estava antes: uma pergunta só.** É o modo que foi medido de verdade (156 de 191
pontos na régua das 32 conversas) e é o que você já usava. Tudo que entrou depois e não depende
disso continua valendo: o fichário de fatos, o estado comercial e a conferência das três mensagens.

O modo de duas etapas não foi apagado — ele liga com um comando, sem publicar nada. Só volta a ser
o padrão quando a medição mostrar, **com número**, que entrega mais.

## 2. Na importação, duas leituras faziam fila (uma esperando a outra)

Quando você importa uma conversa, antes da análise o app ainda:

- lê as imagens e PDFs que apareceram (com até 22 segundos pra isso);
- abre os links que você mandou (com até 20 segundos).

As duas coisas são independentes — uma mexe em arquivo, a outra busca página na internet — mas
estavam **uma esperando a outra**. Numa conversa com arte **e** link, eram até 42 segundos em fila
antes de a análise sequer começar. Agora rodam juntas: a espera passa a ser a da mais demorada, não
a soma das duas. Cada uma manteve a sua própria janela de tempo e o seu teto do dia.

## O que isso deve mudar na prática

A análise passa a ser **uma** conversa com a inteligência em vez de duas, e a importação deixa de
somar dois tempos de leitura. Não consigo cronometrar a sua conta daqui — mas o que foi tirado do
caminho é isso, e é grande.

Se ainda estiver lento depois desta versão, me diga em qual das duas coisas (importar ou
reanalisar) e com que tamanho de conversa, que eu vou atrás do que sobrou.
