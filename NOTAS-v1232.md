# NOTAS v1232 — Agenda: semana no topo da tela + bloco único no menu de cima

Data: 12/08/2026. Duas escolhas do dono a partir dos modelos apresentados (página de
comparação com 4 modelos de tela + 4 modelos de menu): **modelo 4** para a tela Agenda e
**modelo C** para o menu de cima — mais o ajuste do avatar, que estava fora da paleta.

## 1. Tela Agenda — faixa da semana no topo (modelo 4)

- A tela Agenda agora abre com uma faixa horizontal de dias: **Tudo**, **Atrasados** (só
  aparece quando há) e os **próximos 7 dias** (Hoje, Amanhã, seg, ter...), cada um com a
  quantidade de compromissos/lembretes do dia e a data (dd/mm).
- Tocar num dia filtra a tela para mostrar só o que é daquele dia; tocar em "Tudo" volta ao
  normal. Dia sem nada mostra "Nada marcado para este dia."
- As contagens saem das MESMAS listas que a tela já desenhava (cpAgendaDoDia + lembretes
  futuros + compromissos futuros) — nenhuma régua nova, só um recorte por dia. Compromisso
  sem data concreta (texto solto tipo "semana que vem") continua aparecendo na visão "Tudo",
  só não entra na conta de nenhum dia específico.
- O dia é calculado no fuso de São Paulo, o mesmo do resto do app.
- O filtro escolhido fica em `state.agendaFiltroDia`; se ficar velho (virou o dia, atraso
  resolvido), a tela volta sozinha pro "Tudo" em vez de abrir vazia.

## 2. Menu de cima — bloco único calendário + sino (modelo C)

- O card "Agenda" **saiu da fileira de números da Home** (pedido do dono, com print).
- No topo, no lugar do sino solto, entrou uma **cápsula única**: calendário com o **total**
  da agenda (mesma régua do card antigo — `cpAgendaContagem`, que bate com a tela Agenda
  desde a v931) e sino com a quantidade de **hoje**. Os dois lados abrem a tela Agenda.
- A metade de hoje **acende** em ciano (`--acao`, a cor da agenda no app inteiro) quando há
  compromisso no dia, e em vermelho (`--risco`) quando há atraso — número sempre visível,
  nada de pontinho discreto.
- Os dois números atualizam juntos em `atualizarSinoAgenda` (fonte única — lição das
  v1215/v1227 de nunca ter dois relógios).
- O desenho antigo do sino (pontinho/badge das v787/v1093/v1168) foi aposentado: o
  `#bellBadge` continua no HTML sempre escondido e os blocos de CSS antigos seguem no
  arquivo, **inertes** (o sino agora usa classes próprias `cp-hoje-alerta`/`cp-hoje-atraso`
  justamente pra não ser atropelado pelos `!important` legados — lição da v1077→v1078).

## 3. Avatar dentro da paleta

- O avatar "S" do topo usava um degradê âmbar/marrom (`#efb28c` → `#8b5d4a`) que não existe
  na paleta oficial. O dono barrou ("nenhuma cor pode fugir da paleta escolhida"). Agora usa
  o coral da marca (`--cp-coral` → tom mais escuro do mesmo coral).

## 4. Detalhe pego na conferência visual (celular estreito)

- Com o bloco novo no topo, o rótulo "Atualização #NNNN" da marca ficava por baixo dele em
  telas de até ~430px. Em tela estreita a palavra "Atualização" sai e fica só o "#NNNN"
  (que é a referência que o dono confere). Junto, o corretor antigo de versão (#724-2)
  passou a só reescrever o rótulo quando o número está realmente errado — ele gravava o
  texto sempre e apagava a marcação nova por dentro.

## Testes

- `tests/v1232-agenda-topo-bloco-e-semana.test.mjs` (novo): garante o bloco do topo com os
  dois números, as classes novas do sino (e que as antigas não voltam), a faixa da semana
  com filtro e fuso certo, e que o degradê âmbar não volta.
- `tests/v931-agenda-tile-bate-com-agenda.test.mjs` (atualizado): a guarda da v931 ("o
  número da Agenda bate com a tela Agenda") continua — só que agora vigia o total do topo
  (`#cpAgTotalN` vindo de `cpAgendaContagem` dentro de `atualizarSinoAgenda`) e que o tile
  não volte pra fileira da Home.

## Verificação visual

Conferido em Chromium headless (desktop 1440px e celular 390px, temas escuro e claro):
bloco do topo com os dois números e a metade de hoje acesa, fileira da Home sem o card
"Agenda", faixa da semana na tela Agenda filtrando por dia, avatar coral.
