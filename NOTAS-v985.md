# v985 — o bug de verdade do "Mensagens copiadas" zerado

## Contexto

Na v984 eu tinha corrigido um bug real (o botão de copiar rápido do card da Home nunca
registrava a cópia certa), mas o dono me corrigiu: ele nunca usa esse botão. Ele só copia a
mensagem sugerida de **dentro do lead**, na seção "Fazer agora" (os botões "Copiar" das opções
1/2/3). Ou seja, a v984 corrigiu um bug real só que não era o que ele estava vivendo — eu tinha
chutado a causa em vez de rastrear o botão que ele realmente usa.

## O que estava acontecendo (agora sim, a causa raiz)

O botão "Copiar" da seção "Fazer agora" dentro do lead é `window.cp704CopyMsg`. Ele copiava o
texto pra área de transferência e chamava `registrarMensagemEnviada(...)` — que registra um
**atendimento** (mesma coisa que "marcar atendido"), pra contar como contato feito e entrar na
linha do tempo. Isso é correto e continua acontecendo. O problema: em NENHUM lugar desse fluxo
o evento `mensagem_copiada` (o que a tela Desempenho conta em "Mensagens copiadas") era
registrado. Ou seja, o botão de copiar mais usado do app inteiro nunca alimentava esse contador
— em nenhuma circunstância, pra ninguém. Não era um caso raro, era o caminho principal.

## Fix

- `app.js` — `window.cp704CopyMsg`: agora registra o evento `mensagem_copiada` (via
  `POST /api/lead-update`, `action:"aprendizado"`) usando o lead aberto no momento
  (`state.lead.id`), ANTES de chamar `registrarMensagemEnviada` — que já invalida o cache e
  recarrega a lista de leads, então o Desempenho já pega o evento novo na sequência, sem
  precisar de F5.

## Verificação

- `npm test`: suíte inteira verde, incluindo o novo
  `v985-copiar-fazer-agora-registra-copia.test.mjs` (cobre o registro do evento e a ordem —
  registrar ANTES do recarregamento da lista).
- `tests/attendance-refresh.test.mjs` ajustado pro novo formato de `cp704CopyMsg`.

## Arquivos

`app.js` (fix do `cp704CopyMsg`), `tests/attendance-refresh.test.mjs` (assert atualizado),
`tests/v985-copiar-fazer-agora-registra-copia.test.mjs` (novo), `package.json`/
`package-lock.json`, `NOTAS-v985.md`, versão **984 → 985**.
