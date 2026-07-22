# v918 — atendimento marcado não sumia mais ao voltar rápido pra Home

## O bug (print do dono)

Marcou "Atendido" no Matheus Bruel, copiou a mensagem, voltou pra Home — e ele continuava
aparecendo em "Oportunidades esquecidas" com o mesmo "187d parado" de antes, como se nada
tivesse acontecido. O contador de "Fazer agora" (10) também não mudou, mas isso é esperado: o
dono mesmo percebeu que o Matheus não fazia parte dos 10 do dia (essa dose vem de um pool
diferente, sempre completado até 10 a partir do backlog — comportamento intencional da v914).
O problema real era só o card continuar "esquecido" mesmo depois de atendido.

## Causa raiz

`ui667MarcarAtendido` faz duas coisas em paralelo depois de marcar:
1. Aplica o atendimento **localmente**, na hora, nos objetos já carregados em memória
   (`state.itemsAtivos`, `state.todosLeads`, `state.leads`) — isso está certo e é instantâneo.
2. Dispara `loadRecentLeads(false)`, que busca a carteira atualizada do servidor e **substitui**
   `state.todosLeads`/`state.leads` por objetos novos vindos da resposta.

O problema: esse fetch pode responder com uma versão do banco de **alguns instantes atrás**
(o mesmo caso que `recarregarLeadFoco` já tratava — só que aquele tratamento cobre apenas o
`state.lead` da tela do lead aberto, nunca os arrays que alimentam a Home). Como
`loadRecentLeads` troca os arrays por objetos **novos**, se essa resposta "atrasada" chegar
depois da marcação local, ela apaga o que tínhamos acabado de aplicar — sem erro nenhum, sem
aviso, só silenciosamente perde a marcação até um F5.

Ao voltar pra Home logo em seguida, `carregarDashboard()` reprocessa as listas a partir desses
arrays (agora sem o atendimento) e "Oportunidades esquecidas" volta a mostrar o lead como se
nunca tivesse sido atendido.

## O que mudou

Nova função `ui667ReconciliarAtendimentoLocal(leadId, aplicarFn)`: roda no `.then()` do
`loadRecentLeads(false)`, depois que a resposta (possivelmente atrasada) já substituiu os
arrays — e **reaplica** a marcação (ou a desmarcação) em cima dos objetos que sobraram. Não
importa quando o fetch responde nem o que ele trazia: a marcação que o corretor acabou de fazer
nunca é perdida. Se a Home já estiver na tela nesse momento, ela também recalcula as listas com o
dado corrigido na hora, em vez de esperar o próximo carregamento.

Usado tanto por `ui667MarcarAtendido` quanto por `ui667DesmarcarAtendido` (mesma lacuna nos dois
sentidos).

## Verificação
- `tests/v918-atendido-sobrevive-fetch-atrasado.test.mjs` (novo): simula exatamente a corrida —
  marca localmente, simula o fetch atrasado substituindo os arrays por objetos sem o evento, roda
  a reconciliação e confirma que a marcação sobrevive nos três arrays (`itemsAtivos`,
  `todosLeads`, `leads`). Também confirma que `ui667MarcarAtendido`/`ui667DesmarcarAtendido`
  encadeiam a reconciliação no `.then()` do fetch.
- Suíte inteira verde; `node --check app.js` e build OK.

## Arquivos
- `app.js` (`ui667ReconciliarAtendimentoLocal` + wiring em `ui667MarcarAtendido`/
  `ui667DesmarcarAtendido`), `tests/v918-atendido-sobrevive-fetch-atrasado.test.mjs` (novo),
  `NOTAS-v918.md`, versão **917 → 918**.
