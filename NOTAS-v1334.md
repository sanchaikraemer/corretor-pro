# v1334 — os quatro defeitos que a medição apontou viram fato na mão da IA

A primeira medição da bateria com IA de verdade (feita pelo dono no painel em 20/08/2026: **156 de
191 pontos**, 17 das 32 conversas sem falha) mostrou uma coisa importante: as falhas **não eram
aleatórias**. Eram quatro, repetidas conversa após conversa, e todas na hora de **escrever**:

1. as mensagens não mudam de abordagem depois de tentativas sem resposta;
2. não propõem passo concreto com **dia e hora** ("quando você puder" não marca nada);
3. não reconhecem o atraso do próprio corretor quando ele prometeu e não voltou — foi o pior caso
   da bateria, **2 de 6 pontos**;
4. não perguntam a faixa quando o cliente diz que está caro.

E o print do Jamil, no mesmo dia, trouxe o quinto: cliente que diz **não ter capital hoje, mas ter
em dois anos**, sendo tratado como "não vai comprar" — quando a resposta comercial é imóvel em obra,
com entrada parcelada até a entrega.

## Por que não virou "mais uma regra no prompt"

Porque isso já foi tentado e não funcionou — a regra das três jogadas diferentes existe no prompt e
mesmo assim duas sugestões saíram pedindo a mesma coisa. O que funciona neste projeto, desde a
v1317, é entregar o **fato calculado**, com número e data. É o que esta versão faz.

## Os fatos novos no fichário

- **O tipo de pedido que já foi feito e ignorado.** Não só o texto das tentativas (que já ia), mas a
  CATEGORIA: encontro, material, valor/condição, confirmação. Repetir o mesmo tipo colhe o mesmo
  silêncio — a instrução colada no fato manda mudar o que se pede, não insistir igual.
- **Dias úteis para propor**, calculados a partir de hoje ("segunda-feira 24/08, terça 25/08…").
  Quando a jogada for encontro, visita, avaliação ou simulação, a mensagem propõe **dia com nome**.
- **O cliente disse que está caro e nunca disse quanto pode pagar** — com a data e a frase dele. Se
  ele já tiver dito a faixa em qualquer momento, o fato não existe (e ninguém pergunta de novo).
- **O cliente disse que não tem o capital agora**, com o prazo que ele mesmo deu e com o produto em
  obra que já apareceu na conversa. Junto, a leitura fácil é desmontada ali mesmo: *"não tenho
  capital hoje" não é "não vou comprar" — é restrição de calendário*.
- **Reconhecer o atraso**, dentro do bloco de promessas não cumpridas (v1329): reconhecer na
  primeira frase, entregar ali mesmo ou dizer o dia em que entrega. Prometer de novo sem data é
  repetir o erro que causou o silêncio.

Nenhuma linha do miolo do prompt foi tocada.

## Guarda

`tests/v1334-os-quatro-defeitos-medidos.test.mjs`: cada detector com caso positivo e negativo
(cliente que já deu a faixa não é perguntado de novo; conversa sem sinal não ganha bloco nenhum), e
a checagem de que tudo chega ao pedido enviado à IA com a instrução colada no fato.

Suíte: 34 arquivos checados + 480 testes, todos verdes.
