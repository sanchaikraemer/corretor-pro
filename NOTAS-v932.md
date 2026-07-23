# v932 — botão de WhatsApp removido do card da Agenda

## O pedido

Print da tela Agenda: o card de um lead com telefone mostrava três ações — "Ver análise",
"Reagendar"/"Excluir" e um botão extra "💬 WhatsApp". O dono: "esse botão de WhatsApp é
desnecessário, retire".

## O que mudou

`agendaCardHTML` (a função que monta cada card da tela Agenda) não mostra mais o botão
"💬 WhatsApp", mesmo quando o lead tem telefone salvo. "Ver análise" continua levando pro
lead — de lá o WhatsApp direto continua disponível normalmente, como em qualquer outro lugar
do app.

`linkWhatsAppDireta` (a função que monta o link) não foi tocada — ela é usada em outro
ponto do app (tela do lead aberto) e continua funcionando ali.

## Verificação

- `tests/v932-agenda-sem-whatsapp.test.mjs` (novo): confirma que o card da Agenda não tem
  mais o botão de WhatsApp nem a variável que só existia pra ele, que "Ver análise",
  "Reagendar" e "Excluir" continuam no card, e que `linkWhatsAppDireta` não foi removida do
  arquivo (segue usada em outro lugar).
- Suíte inteira verde (`npm test`); `node --check` em todos os arquivos de API e
  `node build.js` OK.

## Arquivos
- `app.js` (`agendaCardHTML` sem o botão de WhatsApp), `tests/v932-agenda-sem-whatsapp.test.mjs`
  (novo), `package.json`/`package-lock.json`, `NOTAS-v932.md`, versão **931 → 932**.
