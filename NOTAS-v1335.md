# v1335 — O app aprende o que você vende, sem você digitar tabela nenhuma

## De onde veio

Quando as sugestões apareceram citando um empreendimento que nunca tinha sido falado com aquela
cliente ("nós nem falamos de Evolute, eu mandei um link, mandei vídeo do Quality"), a saída que eu
propus foi errada: colar a lista de produtos no Cérebro. A resposta do dono, e ele está certo:

> "não adianta botar tabela, porque esse produto não é pra mim como comercial duma construtora que
> tem x produtos. Esse sistema é pra corretores de imóveis, eles podem ter mais de cem produtos na
> carteira deles, nos sites de venda... Aí você vai dar mais trabalho pro corretor em vez de ajudar
> ele a resolver."

## O que mudou

O material dos seus produtos já passa pelo app todos os dias: a arte com o preço, o PDF do
empreendimento, o link da seleção que você manda pro cliente. O app lê tudo isso desde as versões
1306/1307 — só que jogava fora depois de usar naquela conversa.

Agora ele guarda. Cada importação alimenta sozinha uma lista dos seus produtos: o nome, o que
estava escrito no material e **a data** daquele material. Você não digita nada, não preenche nada,
não mantém nada.

## Pra que serve — e pra que NÃO serve

Serve pra **uma** coisa: quando o app confere as três sugestões e encontra um nome de
empreendimento que não apareceu na conversa daquele cliente, ele agora sabe diferenciar dois erros
que são muito diferentes:

- **nome inventado** — não está na conversa, não está no seu Cérebro e não é produto seu. O aviso
  continua o mesmo de antes: *"cita X, que não aparece nesta conversa"*;
- **produto seu na conversa errada** — o nome existe de verdade na sua carteira, só não tem nada a
  ver com aquele cliente. Foi o caso da Vanessa. O aviso agora diz isso com todas as letras:
  *"cita Evolutti — é produto seu, mas não foi falado com este cliente"*.

E **não serve** pra alimentar o texto das mensagens. Essa lista não entra no pedido que a
inteligência recebe pra escrever as três sugestões, e não pode entrar: foi exatamente uma fonte
assim (os casos de outros clientes) que fez a IA escrever o endereço de outro imóvel, e que o dono
mandou tirar na v1301 — *"tira as duas fontes"*. Existe um teste que fica vermelho de propósito se
alguém tentar colar o catálogo lá dentro.

## As travas

Material de venda vem misturado com dado de gente, então:

- nome de pessoa, telefone, e-mail, documento e endereço saem antes de guardar (a mesma limpeza do
  aprendizado, v1326);
- papel que é de UM cliente ("proposta para Fulana", CPF, assinatura) não vira catálogo;
- só entra o que **você** mandou na conversa. Arte que o cliente te mandou é do cliente, não é
  produto da sua carteira;
- cada item carrega a data do material, e a lista tem teto — não cresce pra sempre.
