# v1213 — compromisso atendido no dia marcado deixa de ser cobrado como atrasado

Relato do dono, 11/08/2026, com print da Agenda: o lead **"Bocorni"** aparecia em **"Atrasados —
retome ou descarte"** por causa do lembrete de 10/08 — só que o próprio cadastro dele mostrava
**atendimento em 10/08**. Palavras dele: *"quando atendido na data do agendamento, obviamente deve
sair da agenda pois foi efetivado atendimento"*.

## O que estava errado

A régua de "atrasado" perdoava apenas quem tivesse sido atendido **hoje** (correção da v1199, que
resolveu o lembrete sumir da Agenda no próprio dia em que é atendido). Só que ela não olhava a data
**do compromisso**: no dia seguinte, o lembrete de ontem voltava a ser cobrado mesmo tendo sido
cumprido ontem.

Na prática, o corretor fazia exatamente o que o app pediu, no dia em que o app pediu — e no dia
seguinte o app cobrava de novo. Além do incômodo, isso inflava o número de atrasados do sino e da
tela Hoje com trabalho que já estava feito.

## O que mudou

**Atendimento registrado na data do compromisso (ou depois dela) cumpre aquele compromisso.** Ele sai
da lista de atrasados, do contador do sino e do número da tela Hoje — que usam todos a mesma régua.

Três detalhes da regra:

- **A comparação é por dia**, no fuso de São Paulo: um compromisso das 14h atendido às 9h do mesmo dia
  está cumprido do mesmo jeito. Ninguém registra atendimento com cronômetro.
- **Atendimento anterior à data não cumpre nada** — quem foi atendido dia 8 e tinha compromisso dia
  10 continua atrasado, como deve ser.
- **O que conta como atendimento continua sendo o mesmo de sempre**: botão "Marcar atendimento",
  cópia de mensagem, visita/ligação/observação registradas e os campos de último atendimento já
  gravados. Esta versão só compara datas — não inventou uma definição nova de atendimento.

A lista de compromissos vencidos que aparece **dentro do lead** segue a mesma régua, pra o contador
não dizer uma coisa e a tela do cliente dizer outra.

## Arquivos alterados

- `app.js` — `cpCompromissoJaAtendido` (nova), usada em `cp786CompromissoAtrasado` e em
  `cpCompromissosVencidosDoLead`.
- `tests/v1213-atendido-na-data-nao-e-atrasado.test.mjs` — guarda de regressão que executa a régua de
  verdade: o caso do Bocorni, atendimento depois da data, atendimento antes da data, sem atendimento,
  compromisso confirmado (não só lembrete) e a comparação por dia. Conferido que o teste falha sem a
  correção.
- `package.json` / `package-lock.json` — versão 1213.

> Nota de numeração: esta correção nasceu como v1212, mas outra sessão publicou a v1212
> (aprendizado real da carteira no prompt da análise) enquanto ela estava em revisão. Renumerada
> para 1213 na hora de juntar — o conteúdo é o que está descrito acima.
