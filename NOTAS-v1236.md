# NOTAS v1236 — "faz sentido" banido de vez, e a IA para de escrever antes de pensar

Data: 12/08/2026. Dois retornos do dono logo depois da v1235.

## 1. "Não quero a expressão 'faz sentido', já disse mil vezes"

**Erro meu na v1235.** Ele tinha mandado uma sugestão do ChatGPT que usava a expressão, e eu
li aquilo como aprovação — afrouxei "faz sentido" pra uma lista branda, onde a expressão podia
passar quando fosse "pergunta de verdade".

Não era isso. Ele mandou a mensagem do ChatGPT **só pra mostrar o quanto ela era superior às
sugestões do sistema**, não pra endossar a expressão.

Voltou pra lista dura, agora em todas as formas: `faz sentido`, `faça sentido`, `fizer
sentido`, `fizesse sentido`, `fazia sentido`. **Sem exceção** — inclusive na frase do exemplo
que ele elogiou.

## 2. "Ele não lê o histórico… inventa 3 coisas aleatórias sem pensar"

Aqui ele apontou o sintoma certo. Duas conferências:

**A conversa CHEGA inteira na IA.** O corte por tamanho só entra acima de 30.000 caracteres, e
a conversa do lead dele tem cerca de 7.000. Não estava sendo truncada, e o "leu a conversa
inteira (41 mensagens)" na tela é verdade.

**Mas a ORDEM da resposta estava errada — e é exatamente isso que produz "3 coisas
aleatórias".** O sistema mandava a IA responder nesta ordem:

```
diagnóstico  →  AS TRÊS MENSAGENS  →  etapa  →  próximo passo
```

Ou seja: **as três sugestões eram escritas ANTES de o sistema perguntar qual era o próximo
passo.** A IA escrevia a conclusão antes de ter decidido a conclusão. Não é um detalhe de
organização — é a diferença entre responder pensando e responder chutando.

A ordem agora é:

```
diagnóstico  →  etapa  →  próximo passo  →  AS TRÊS MENSAGENS (por último)
```

E ficou escrito no pedido que **as três precisam ser TRÊS CAMINHOS PARA O MESMO próximo
passo** — não três assuntos diferentes, nem a mesma frase reescrita três vezes. Antes de
entregar, a IA confere uma a uma: a que não levar ao passo definido está errada e é
reescrita.

Somado a isso: quando o "último compromisso do cliente" for uma condição da **vida dele** (a
colheita, vender um bem, uma viagem, a decisão de outra pessoa) e esse prazo já passou, o
próximo passo é **perguntar como aquilo ficou** — nunca reoferecer o material que ele não
respondeu. Era o buraco exato do caso do lead: o cliente disse que ia olhar a colheita, e as
seis sugestões insistiam na simulação.

A releitura da v1235 também passou a receber o passo já decidido, pra ela consertar o clichê
**sem trocar o assunto** da mensagem.

## A regra da v1145 continua de pé

A primeira versão desta correção criava um bloco novo ("o que o cliente quer", "a condição que
ele pôs", "por que parou", "o passo certo") só pra IA pensar antes de escrever. **Isso quebra
a regra dele da v1145** — *"se não aparece na tela, não precisa existir, estamos perdendo
tempo e gastando energia à toa"* — porque o tempo de espera da importação é justamente o tempo
que a IA leva pra escrever, e nada daquilo apareceria pra ele.

Refeito: **nenhum campo novo.** O conserto é só de ordem, usando os campos que a tela já
mostra (último compromisso, pedido sem resposta, impedimento, próximo passo). Ganha o
raciocínio antes da escrita **sem** um caractere a mais de espera.

## Validação

- Versão: `7.1236.0` / exibida **1236**.
- Novo teste `tests/v1236-entender-antes-de-escrever.test.mjs`: tranca a proibição dura de "faz
  sentido" em todas as formas, tranca a ordem dos campos (mensagens por último), tranca que
  **nenhum campo novo** entrou no pedido, e roda a análise ponta a ponta conferindo que a
  releitura recebe o passo decidido e o compromisso do cliente — e que não inventa um
  compromisso quando não existe.
- `tests/v1235-…` atualizado: "faz sentido" saiu da lista branda e virou proibição dura.
- `npm test` inteiro verde (402 testes).
