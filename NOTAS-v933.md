# v933 — "Meta de hoje batida" não podia aparecer com a meta ainda pendente

## O bug (achado por print)

O dono mandou um print da Home mostrando, tudo na mesma tela:

- Saudação: "10 leads pra atender hoje"
- Card "Fazer agora: 10"
- Caixa verde "🎉 Meta de hoje batida! Ainda tem 179 leads esperando prioridade" com o botão
  "Vamos atender mais um?"

Contraditório: se a meta do dia (10) ainda está pendente e ninguém foi atendido, ela não pode
estar "batida" ao mesmo tempo.

## Causa raiz

`renderBotoesHome` decide o que mostrar no corpo da Home usando DUAS contas diferentes:

1. `metaHoje = cpFazerAgoraDose(items)` — a dose real do dia (10 menos quem já foi atendido
   hoje). É esse número que aparece na saudação e no card "Fazer agora".
2. `urgentes` — só os leads dentro do balde categorizado (`grupos["acao-hoje"]` +
   `grupos["retomar-cuidado"]`), cortado em `metaHoje`.

O branch de "Meta de hoje batida" disparava sempre que `urgentes` vinha vazio e havia gente na
fila ranqueada completa (`disponiveisParaPuxar`) — **sem checar se `metaHoje` de fato tinha
caído a 0**. Só que o balde categorizado pode vir vazio por outro motivo (nenhum lead passa nos
critérios de "entra em retomada"/mensagens mínimas agora), mesmo com a dose do dia intacta e
ninguém atendido. Ou seja: "balde de urgentes vazio" foi tratado como sinônimo de "meta
cumprida", e não são a mesma coisa.

## O que mudou

`renderBotoesHome` (`app.js`) agora separa os dois casos:

- `disponiveisParaPuxar.length && metaHoje === 0` → meta REALMENTE cumprida (dose consumida por
  atendimento de hoje). Mantém a mensagem "🎉 Meta de hoje batida!" + "Vamos atender mais um?".
- `disponiveisParaPuxar.length` (com `metaHoje > 0`) → a meta NÃO foi cumprida, só não tem
  ninguém no balde categorizado agora. Mensagem nova, sem afirmar meta batida: "📋 Nenhum lead
  prioritário pelas regras agora" + "Ainda faltam {metaHoje} pra bater a meta de hoje. Tem
  {N} leads na fila geral esperando prioridade — pode puxar de lá." com botão "Puxar da fila"
  (mesmo `cpAtenderMaisUmHoje()` de antes).

## Verificação

- `tests/v933-meta-batida-vs-dose-pendente.test.mjs` (novo): roda o trecho real de decisão do
  `top3Html` extraído do `app.js` em dois cenários — (a) `metaHoje=10`/balde vazio: confirma que
  "Meta de hoje batida" NUNCA aparece e que a mensagem nova mostra o número certo de pendentes;
  (b) `metaHoje=0`: confirma que a mensagem de meta batida continua correta e não se mistura com
  a nova.
- Suíte inteira verde (`npm test`), incluindo os testes antigos de v925/v926 que exercitam o
  mesmo trecho de código.

## Arquivos
- `app.js` (`renderBotoesHome`), `tests/v933-meta-batida-vs-dose-pendente.test.mjs` (novo),
  `package.json`/`package-lock.json`, `NOTAS-v933.md`, versão **932 → 933**.
