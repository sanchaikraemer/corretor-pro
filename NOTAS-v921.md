# v921 — mensagem copiada não vira mais "resposta do cliente"

## O bug (print do dono)

Mauricio Berlando apareceu em "Fazer agora" com o badge **"Cliente aguardando"** (prioridade
máxima) mostrando "43 dias sem resposta" numa caixa e "1 dia de contato" na outra. O dono
desconfiou: como o cliente estaria "aguardando" se ele mesmo tinha retomado o contato ontem?
Conferimos o WhatsApp real: a última fala do Mauricio foi há 43 dias ("Hoje e amanha estou fora
da cidade"); ontem o corretor **copiou a mensagem sugerida** de retomada pelo app — o cliente
ainda não respondeu.

## Causa raiz

Ao copiar uma mensagem sugerida, o app grava na timeline um item com
`author: "Mensagem enviada (você)"`. A função `ehMsgDoCliente(m, nomeDoCliente)` — usada em
mais de 10 lugares do app pra decidir "quem falou por último" — só sabe reconhecer dois casos:
autor bate com o nome do cliente, ou autor bate com a empresa (`BUSINESS_RE`: Senger, Direciona,
seu nome etc.). Como "Mensagem enviada (você)" não bate com nenhum dos dois, o código caía na
regra padrão: **"em conversa individual, qualquer outro autor é o contato"** — tratando a
**sua própria mensagem copiada** como se fosse uma resposta do cliente.

Isso alimentava `clienteAguardandoVoce = true` em `prioridadeAtendimento`, e
`filaPorFatos()` **pula de propósito** a proteção de 5 dias pós-atendimento quando
`clienteAguardandoVoce` é verdadeiro (faz sentido quando é verdade: se o cliente respondeu, a
proteção não deveria segurar você de agir) — só que aqui a premissa estava errada. Resultado:
o lead furava a proteção e virava prioridade máxima, com o rótulo mais enganoso possível
("Cliente aguardando" quando na verdade é você quem está aguardando o cliente).

O "43 dias sem resposta" mostrado na tela já estava certo — esse número vem de um cálculo
separado, no servidor, que já excluía corretamente os registros manuais.

## O que mudou

`ehMsgDoCliente` agora começa checando `ehMsgManualTimeline(m)` (nova função: cobre
`mensagem_enviada`, `atendimento`, `nota`, `ligacao`, `visita`, `presencial`, `proposta`,
`observacao_manual`, `print-whatsapp` e `source` manual/crm) — se o item é um registro interno
do corretor, a resposta é sempre `false`, **antes** de olhar o nome do autor. Como todos os
outros ~10 lugares do app que decidem "quem falou por último" chamam essa mesma função (em vez
de reimplementar a checagem), a correção se propaga sozinha para todos eles: a barra de
prioridade, o "cliente falou por último" da Condução, o histórico do lead (`Você`/`Contato`), a
detecção de "cliente prometeu retorno", e o cálculo de "Aguardando cliente" — sem precisar
tocar em cada um.

## Verificação
- `tests/v921-mensagem-manual-nao-e-cliente.test.mjs` (novo): confirma que uma mensagem com
  `type:"mensagem_enviada"` (e os demais tipos manuais) nunca é lida como fala do cliente,
  mesmo com um autor que não bate nem com a empresa nem com o cliente; confirma que uma
  mensagem real do cliente continua reconhecida normalmente; e demonstra em `filaPorFatos` que
  a proteção de 5 dias volta a funcionar com o autor corrigido (documentando também, lado a
  lado, o comportamento do bug antigo).
- Suíte inteira verde; `node --check app.js` e build OK.

## Arquivos
- `app.js` (`ehMsgManualTimeline` nova, `ehMsgDoCliente` corrigida),
  `tests/v921-mensagem-manual-nao-e-cliente.test.mjs` (novo), `NOTAS-v921.md`,
  versão **920 → 921**.
