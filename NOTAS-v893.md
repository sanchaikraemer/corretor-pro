# v893 — desmarcar atendimento agora desliga mesmo o "Atendido hoje"

## Bug (print #891)
Ao desmarcar, o toast dizia "Atendimento de hoje desmarcado" mas o botão continuava
"Atendido hoje" (verde). Causa: o desmarcar removia só o evento do BOTÃO (`botao_atendido`),
enquanto o estado "Atendido hoje" (`ehContatadoHoje`) liga com QUALQUER `contato_manual` do
dia (ex.: uma "mensagem enviada" copiada hoje). Com outro evento no dia, `ehContatadoHoje`
continuava true e o botão não voltava pra "Marcar atendimento".

## Correção
Desmarcar passa a limpar **todo `contato_manual` de hoje** (API e local). Assim
`ehContatadoHoje` vira false e o botão volta a "Marcar atendimento". Contatos de outros dias
ficam intactos.

## Arquivos
- `api/reanalisar-lead.js` — ação `desmarcar-atendido` (filtro amplo do dia).
- `app.js` — `ui667RemoverAtendidoLocal` (idem).
- `tests/v893-desmarcar-limpa-tudo.test.mjs` (novo); `v888` atualizado.
- `package.json` — versão 892 → 893.
