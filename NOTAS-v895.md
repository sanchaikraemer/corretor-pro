# v895 — marcar/desmarcar não zera mais a barra de "Interesse do cliente"

## Bug (prints do dono, #894)
Ao marcar e depois desmarcar atendimento, a barra "Interesse do cliente" caía de
**108 mensagens do cliente** para **4** (barra cheia → quase vazia).

## Causa
`recarregarLeadFoco` (chamado após marcar) recarrega o lead a partir da **lista**
(`getLeadsData`), que traz só um **recorte** das mensagens — não o histórico completo. Ele
substituía o lead aberto (com todas as mensagens) por essa versão curta, e a barra
(`mensagensDoCliente`, que conta `recentMessages`) despencava. Marcar/desmarcar não muda a
conversa, então isso é indevido.

## Correção
No `recarregarLeadFoco`, quando a versão aberta tem MAIS mensagens que a recarregada, preserva
o histórico completo (`recentMessages`), o `historyLoaded` e o `messageCount`. Assim a barra
não oscila ao marcar/desmarcar. (Já existia a mesma preservação em outro caminho de reload.)

## Arquivos
- `app.js` — `recarregarLeadFoco` preserva as mensagens da versão aberta.
- `tests/v895-recarregar-preserva-mensagens.test.mjs` (novo).
- `package.json` — versão 894 → 895.
