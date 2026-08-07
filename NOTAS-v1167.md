# v1167 — o app não sugere mais contato de sábado ou domingo

Print do dono: a faixa "Ficaram de te dar uma resposta" propôs **"Sugiro retomar dom, 09/08"**.
Reação na hora: **"nunca faça isso... nem no sábado."** Com razão — é o app propondo, sozinho, um
compromisso de trabalho pro fim de semana e jogando na Agenda. Mandar mensagem de venda nessa hora
não ajuda a vender e ainda arrisca queimar o corretor com o cliente.

## A causa

A conta da data proposta (`cp1160PromessaDoCliente`, em `app.js`) soma o "Descanso após atender" do
Cérebro à data em que o cliente prometeu resposta — e simplesmente não olhava em que dia da semana
o resultado caía. Se a soma desse sábado ou domingo, a sugestão saía do jeito que caiu.

## O que a v1167 faz

Duas funções novas, pequenas: `cpEhFimDeSemana(iso)` diz se uma data cai em sábado/domingo, e
`cpEmpurraPraDiaUtil(iso)` empurra sábado pra segunda seguinte (+2) e domingo pra segunda (+1) — dia
útil não muda.

`cp1160PromessaDoCliente` passa a rodar a soma bruta e, **antes de virar a data proposta**, empurrar
pra fora do fim de semana. A promessa carrega um sinalizador (`adiadoDoFimDeSemana`) pra o banner
avisar o motivo, em vez de simplesmente pular um dia sem explicação:

> "Sugiro retomar seg, 10/08 (caía num fim de semana — o app não sugere contato de sábado ou
> domingo, foi pra segunda) — o respiro de 3 dias que você configurou..."

**O que NÃO mudou:** os botões de agendamento manual do corretor ("Amanhã", "+7 dias", "+15 dias",
"+30 dias", escolher no calendário) continuam livres — é a agenda dele, e tem corretor que atende
sábado de propósito (plantão de vendas). A regra vale só pra sugestão que o app propõe sozinho.

## Arquivos

- `app.js` — `cpDiaDaSemanaDoIso`, `cpEhFimDeSemana`, `cpEmpurraPraDiaUtil` (novas); `cp1160PromessaDoCliente` usa o empurrão; `cp1160BannerLeadHTML` explica quando adiou.
- `tests/v1167-nunca-sugere-fim-de-semana.test.mjs` — novo. Confere sábado→segunda (+2), domingo→segunda (+1), dia útil sem mudança — usando a data exata do print (09/08/2026) — e que os botões manuais não são tocados pela regra.
- `tests/v1160-…` — dois casos calculavam pra 08/08/2026 (sábado, o mesmo tipo de bug, só que não tinha sido percebido); atualizados pra segunda (10/08) com o sinalizador de adiamento.

## Conferência

- `npm test`: 24 arquivos + **334 testes**, verdes.
- Chromium headless, app publicado carregado de ponta a ponta: zero erro de JavaScript;
  `cpEhFimDeSemana('2026-08-09')` → `true`; `cpEmpurraPraDiaUtil('2026-08-09')` → `'2026-08-10'` —
  a mesma conta do print, confirmada no app de verdade, não só na função isolada.
