# NOTAS v1049 — "Atendidos recentemente" e o ponto de "cliente aguardando" seguem o mesmo prazo

## O relato

Na entrega da v1048 (o campo "Descanso após atender", configurável no Cérebro), eu avisei que duas
partes do sistema continuavam com um prazo FIXO de 5 dias, separado do que o corretor escolhesse:
a tela "Atendidos recentemente" (dentro da Condução do atendimento) e a bolinha vermelha de
"cliente aguardando você" nos cards de lead. O dono pediu pra unificar também.

## Por que isso importa

Sem essa unificação, um corretor que configurasse, por exemplo, 10 dias de descanso continuaria
vendo essas duas telas liberarem o lead já no 6º dia — voltando a ter **duas contas diferentes
discordando sobre o mesmo lead**, exatamente a classe de bug que já apareceu várias vezes antes
neste sistema (relatado e corrigido nas versões v1017 e v1022).

## O que mudou

- `protegidoPosAtendimento` (a função por trás da tela "Atendidos recentemente" e da bolinha de
  "cliente aguardando você") deixou de usar um número fixo (5 dias, `PRAZO_PROTECAO_ATENDIDO`) e
  passou a usar o mesmo valor configurável no Cérebro que a fila "Fazer agora" já usa desde a
  v1048.
- O texto da tela "Atendidos recentemente" ("Leads que você já atendeu nos últimos X dias...")
  agora mostra o número de verdade que você configurou, não mais um "5" cravado.
- A constante antiga (`PRAZO_PROTECAO_ATENDIDO`) foi removida — não sobra nenhum número fixo
  competindo com o valor escolhido no Cérebro.

## Testes

- `tests/v1049-protecao-pos-atendimento-usa-descanso-configurado.test.mjs` (novo): confirma que a
  constante antiga sumiu, que a proteção e o texto usam o valor configurável, e o comportamento
  real — lead atendido há 7 dias libera com o padrão (5 dias), mas continua protegido com 10 dias
  configurados.
- `tests/v886-calibragem-prioridade.test.mjs`, `tests/v1022-prazo-compromisso-antigo-atendimento-e-reaproveitar-importacao.test.mjs`:
  ajustados pra travar o novo comportamento (mesmo resultado no cenário padrão).
- `npm test`: suíte inteira verde.
- `npm run build`: build limpo, 27 arquivos publicados.

## Arquivos

`app.js` (`protegidoPosAtendimento` e o texto de "Atendidos recentemente" usam
`cpDiasDescansoPosAtendimento`; `PRAZO_PROTECAO_ATENDIDO` removida),
`tests/v1049-protecao-pos-atendimento-usa-descanso-configurado.test.mjs` (novo),
`tests/v886-calibragem-prioridade.test.mjs`,
`tests/v1022-prazo-compromisso-antigo-atendimento-e-reaproveitar-importacao.test.mjs` (ajustados),
`package.json`/`package-lock.json` (versão + script `test`), `NOTAS-v1049.md`, versão
**1048 → 1049**.
