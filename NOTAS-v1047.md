# NOTAS v1047 — tirar o número de posição da lista "Fazer agora"

## O relato

Print real da tela "Hoje": vários leads sem conversa recente (barra de mensagens em 0, um deles
parado há 141 dias) aparecendo numerados (1º, 2º, 3º...) na lista de "fazer agora", misturados com
leads realmente quentes. A reclamação: já tinha pedido pra resolver isso antes, e continuava
acontecendo — "vc diz que resolveu mas é mentira".

## O que eu investiguei

Fui direto no código (não chutei) pra explicar exatamente o critério de hoje: um lead entra nessa
lista se já escreveu pelo menos 1 mensagem **alguma vez** (sem limite de tempo) e não está em
espera nem tem compromisso marcado. A posição dele na lista vem de uma nota calculada com
mensagens/perguntas/negociação — nenhum desses pontos perde força com o tempo parado. Por isso um
lead silencioso há 141 dias pode pontuar igual a um que escreveu ontem, e por isso o número da
barrinha (que só conta os últimos 90 dias) não bate com o "141d" escrito do lado — são duas conta
diferentes.

## A decisão do dono

Depois de eu explicar o critério, a resposta foi direta: **tirar o número de posição de vez** —
"não quero número de posição como 1°, 2° ou 3°, isso é desnecessário... estando ali os 10, ou 15,
ou quantos definidos lá no cérebro, já está ok". Ou seja: a lista mostrar a quantidade certa de
leads (a meta configurada no Cérebro Comercial) já resolve — não precisa numerar cada linha
fingindo uma ordem de prioridade rígida que, pelos motivos acima, nem sempre reflete o que
importa.

## O que mudou

O badge "1º"/"2º"/"3º..." que aparecia do lado do nome de cada lead, na lista "Fazer agora" da
tela inicial, foi removido. A linha agora mostra só: bolinha de status, nome, empreendimento,
barra de mensagens e "há Xd" — sem numeração. Nada mais na lista mudou (ordem interna, quantidade
mostrada, critério de quem entra — tudo isso continua igual por enquanto).

## Testes

- `tests/v1046-2-sem-numero-posicao-fila-hoje.test.mjs` (novo): confirma que o badge de posição
  não existe mais em nenhum lugar do código (nem CSS morto sobrando) e que a linha continua
  mostrando nome e dias normalmente, só sem número.
- `tests/v972-clareza-fila-hoje.test.mjs`, `tests/v975-motivo-so-no-lead.test.mjs`,
  `tests/v1018-atendimento-e-nao-mensagem-define-espera.test.mjs`,
  `tests/v942-home-lista-densa-barra-cinza-e-perf.test.mjs`,
  `tests/v933-meta-batida-vs-dose-pendente.test.mjs`: ajustados pra nova assinatura de
  `cpHomeLeadRow` (sem o parâmetro de posição) e pra travar a AUSÊNCIA do badge em vez da presença
  dele.
- `npm test`: suíte inteira verde.
- `npm run build`: build limpo, 27 arquivos publicados.

## O que ainda não mudou (fica pra outra conversa, se você quiser)

Removi só o número — o CRITÉRIO de quem entra e em que ordem na lista continua o mesmo de sempre
(inclusive o fato de um lead antigo, sem mensagem recente, ainda poder aparecer nela). Se você
quiser que leads muito parados (tipo 141 dias) passem a ficar pra trás de verdade, ou saiam dessa
lista, isso é uma mudança separada — me avisa que a gente resolve.

## Arquivos

`app.js` (badge removido do HTML e do CSS, assinatura de `cpHomeLeadRow` simplificada),
`tests/v1046-2-sem-numero-posicao-fila-hoje.test.mjs` (novo), `tests/v972-clareza-fila-hoje.test.mjs`,
`tests/v975-motivo-so-no-lead.test.mjs`, `tests/v1018-atendimento-e-nao-mensagem-define-espera.test.mjs`,
`tests/v942-home-lista-densa-barra-cinza-e-perf.test.mjs`, `tests/v933-meta-batida-vs-dose-pendente.test.mjs`
(ajustados), `package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1047.md`, versão
**1046 → 1047**.
