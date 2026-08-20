# v1316 — a conversa da Noemi virou caso de teste fixo do app

Pedido do dono (20/08/2026): *"coloca essa conversa como teste fixo do app"*.

A conversa da **Noemi**, da carteira da Construtora Senger — de 19/01/2026 a 19/08/2026 — passa a
ser rodada por inteiro toda vez que alguém mexe no app. Se qualquer atualização futura estragar a
leitura dela, o teste trava a publicação na hora.

## Por que esta conversa, e não outra

Ela junta, num arquivo só, quase tudo que já quebrou neste projeto:

- **sete meses de histórico**, com um sumiço de quatro meses no meio (26/02 → 27/06);
- **foto, vídeo, PDF e áudio** enviados pelos dois lados — o app precisa saber que foram enviados,
  sem inventar o que tinha dentro;
- **mensagem comprida numa bolha só** (a apresentação de 19/01, com seis linhas);
- **preço velho e preço novo convivendo**: R$ 670.000 dito em janeiro, R$ 430.000 em agosto;
- **uma virada comercial no fim**: a cliente oferece 3 terrenos (R$ 360 mil) como permuta, o que
  muda a faixa de compra dela por completo;
- **a conversa termina na mão do corretor**: cinco mensagens seguidas, no mesmo dia, sem resposta.

## O que o teste garante

1. A conversa é lida **inteira**: 64 mensagens, nem uma a mais, nem uma a menos, e as 64 chegam à
   IA (nada é cortado no caminho).
2. Os **arquivos enviados** deixam rastro: 3 fotos, 1 vídeo, 1 PDF e os 4 áudios — inclusive o
   áudio que a **cliente** mandou, que não pode ser confundido com um do corretor.
3. O cartão é **dela**, nunca da construtora. E o app **não elege empreendimento sozinho**: mesmo
   com "Ed. Evolutti" escrito na conversa, o produto fica em branco até a análise decidir.
4. As **cinco mensagens sem resposta** contam como **uma tentativa** (é o mesmo dia), e o texto das
   cinco chega à IA.
5. Os fatos que decidem o próximo passo chegam ao pedido enviado à IA, um por um: a localização que
   ela pediu (avenida Pátria ou centro), a objeção dos fundos, os R$ 670.000, a entrega em 2028, o
   "estou viajando na volta eu vejo", os R$ 430.000, os 43 m² que ela recusou, os 2 banheiros que
   pediu, os 3 terrenos, os R$ 360 mil e a regra dos R$ 800 mil.
6. **Nada desta conversa está cravado no código.** O teste procura por empreendimento, construtora,
   nome de pessoa, rua e preço dentro do app e falha se achar qualquer um. É a regra de sempre:
   informação comercial vem do Cérebro ou da própria conversa, nunca de dentro do programa.

## O que NÃO mudou

Nenhuma tela, nenhuma regra de análise, nenhum texto de prompt. Esta atualização só **acrescenta uma
rede de proteção** — o app continua fazendo exatamente o que fazia na v1315.

## Testes

`npm test`: 30 arquivos checados + 460 testes, verdes.
