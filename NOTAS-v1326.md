# v1326 — o que a IA aprendeu com um cliente para de levar os dados dele para a conversa de outro

Quarto bloco da auditoria de 20/08/2026. Este é o ponto que ela chamou de **risco residual de
contaminação entre clientes**.

## O que estava acontecendo

Quando a IA escreve as três mensagens, ela recebe um bloco chamado "SEU JEITO" — pedaços do que o
app aprendeu observando **outras conversas suas**: uma mensagem real que você escreveu, a resposta
que funcionou numa objeção, a técnica que deu certo, o follow-up que trouxe resposta. Isso é bom e
continua: é o que faz a sugestão sair com a sua cara.

O problema é que esse pedaço ia **como estava guardado**. Uma mensagem real sua pode conter o nome
do cliente daquela conversa, o empreendimento, o valor, a condição, o endereço. O pedido avisava
"imite a forma, não o conteúdo" — mas isso é instrução, não garantia. E foi exatamente instrução
parecida que falhou em 18/08, quando um endereço de outro imóvel apareceu numa mensagem pronta pro
cliente (a v1301 tirou dali as duas fontes mais perigosas; esta sobrou).

## O que mudou

Antes de qualquer coisa aprendida em **outra** conversa entrar no pedido, ela passa por uma
limpeza. Sai:

- **nome do cliente** daquela conversa (pelos mesmos apelidos que a exportação já usava — e agora
  também o nome de qualquer outro cliente que já tenha ensinado alguma coisa, pra ninguém escapar
  citado no meio da frase de outro);
- **nome do empreendimento**;
- **valor em dinheiro** (R$ 200 mil, 430 mil, R$ 9.000…);
- **endereço** (rua, avenida, esquina, número);
- telefone, e-mail, documento e link, que já saíam na exportação.

Fica tudo o que ensina a **conduzir**: a forma de escrever, a sequência da condução, a objeção em
si, percentual, prazo, metragem, número de dormitórios.

Na prática, o que atravessa de um cliente pro outro deixou de ser

> "No Renaissance conseguimos R$ 200 mil de entrada e o saldo…"

e passou a ser

> "No [empreendimento] conseguimos [valor] de entrada e o saldo…"

— que é o aprendizado de verdade: a estrutura da jogada, não os dados de quem foi atendido.

O pedido também passou a **explicar** os marcadores para a IA: que aquilo foi retirado de
propósito, que ela não deve adivinhar o que estava ali, e que **nunca** pode escrever `[valor]` ou
`[empreendimento]` na mensagem que vai pro cliente.

**Limite honesto, escrito no código:** um nome próprio que nunca apareceu no nome do arquivo nem no
campo do empreendimento (o vizinho citado no meio de uma frase, por exemplo) ainda pode escapar.
Por isso o aviso do prompt continua existindo — a limpeza é a primeira barreira, não a única.

## Um bug antigo que apareceu no caminho

Escrevendo o teste, apareceu um defeito que estava ali desde a v1212: a regra que decide se um
pedaço aprendido é uma **mensagem real sua** ou só uma **descrição do seu tom** nunca reconhecia
mensagens escritas com "você" — a grafia normal. Resultado: mensagens reais suas chegavam à IA
rotuladas como "Seu tom", perdendo justamente a instrução que manda imitar a forma e não o
conteúdo. Corrigido.

## Verificação

- Guarda nova: `tests/v1326-aprendizado-nao-leva-dado-de-outro-cliente.test.mjs` — o que sai e o
  que fica, o nome de um cliente citado no aprendizado de outro, o bloco final do pedido sem
  nenhum dado das outras conversas, os casos da carteira limpos do mesmo jeito, e a limpeza não
  destruindo a frase de condução ("quando o cliente sinalizou entrada abaixo da condição padrão,
  propus validar uma exceção" passa intacta).
- Nada muda na tela: é o conteúdo do pedido enviado à IA.
- `npm test`: 31 arquivos checados + 473 testes, verdes.
