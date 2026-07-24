# v957 — lembrete a partir de mensagem tarde da noite podia cair no dia errado

## Contexto

Revisão linha a linha de `api/reanalisar-lead.js` (804 linhas), concluída. Achado na função
`diasAteDiaSemana`, usada por `lembreteDoTexto`/`lembreteDaTimeline` pra calcular "quantos dias
até sábado" quando o corretor ou o cliente escreve algo como "te chamo sábado" — o cálculo
precisa saber a partir de QUE DIA contar, e esse dia vem da data/hora real da mensagem (não de
"agora").

## O problema

`diaSemanaBR()` (usada quando não há uma data-base específica) já é cuidadosa de propósito com
fuso horário — o comentário original já dizia "Evita virar o dia no UTC à noite", porque o
servidor roda em UTC e o Brasil está 3h atrás. Só que `diasAteDiaSemana`, quando RECEBIA uma
`baseDate` (a data de uma mensagem específica), usava `d.getUTCDay()` — o dia da semana em UTC
cru, sem considerar o fuso — exatamente o erro que a função irmã evita.

Na prática: uma mensagem enviada entre 21h e meia-noite em Brasília cai na madrugada do dia
SEGUINTE em UTC. Nesse intervalo (bem comum — mensagem de fim de noite), calcular "quantos dias
até sábado" a partir dessa mensagem podia dar 1 dia de diferença — o lembrete criado no dia
certo da semana, mas errado por 24h.

## O que mudou

Extraído `diaSemanaBRDe(date)` — a mesma lógica consciente do fuso de `diaSemanaBR()`, mas pra
uma data qualquer, não só "agora". `diaSemanaBR()` agora só chama `diaSemanaBRDe(new Date())`, e
`diasAteDiaSemana` usa `diaSemanaBRDe(d)` no lugar de `d.getUTCDay()` quando recebe uma
`baseDate`. Mesmo padrão, sem duplicar lógica.

## Verificação

- `npm test` verde (suíte completa, incluindo o teste novo `v957-dia-semana-baseDate-fuso-br`).
  O teste acha (sem cravar uma data fixa — funciona em qualquer ano) um horário de madrugada em
  UTC onde o dia da semana em UTC diverge do dia real em Brasília, e confirma que
  `diasAteDiaSemana` agora calcula certo nesse caso — antes do fix esse mesmo teste teria
  falhado (a conta dava 1 dia a menos).
- `node --check api/reanalisar-lead.js` OK.

## Achado registrado, não corrigido (comportamento intencional, não é bug)

`podeReusar6863` (linha ~448) está travado em `false` desde a v752 ("botão de reanalisar nunca
reutiliza análise antiga") — o bloco de código que ele guarda (reuso de análise por assinatura
de timeline) fica morto de propósito. Mesma categoria de "desativado intencionalmente" já vista
em `finalizarAnaliseComercial`/`normalizarModeloComercial` (achado da v951) — não mexi.

## Arquivos
- `api/reanalisar-lead.js` (`diaSemanaBRDe` extraída, `diasAteDiaSemana` corrigida),
  `tests/v957-dia-semana-baseDate-fuso-br.test.mjs` (novo), `package.json`/`package-lock.json`,
  `NOTAS-v957.md`, versão **956 → 957**.
