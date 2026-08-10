# v1207 — hora no "Agendar" de dentro do lead (antes só dava pra escolher o dia)

## O pedido

Print do celular com o calendário do Android aberto: *"não acho no celular onde agendar a hora, só
dia"*. E no texto da conversa que aparece atrás do calendário está exatamente o caso de uso:
*"quinta que vem, às 9 horas eu tô livre"*.

## O que estava acontecendo

A hora **existia**, mas no lugar errado pra quem está com o cliente na linha.

- No painel **Agendar** de dentro do lead (o ícone de calendário no topo da análise — o que ele
  usa no dia a dia) só havia campo de **dia**.
- O campo de **hora** só existia no **Reagendar** da tela Agenda (v1199), ou seja: era preciso
  agendar no lead, depois sair, ir na Agenda, achar o compromisso, abrir o Reagendar e só então
  botar a hora. No celular ele simplesmente não achou.

## O que mudou

O painel **Agendar próximo contato** (dentro do lead) agora tem, numa linha só:

**[ dia ] [ hora ] [ Confirmar ]**

- A **hora é opcional** — sem ela, o compromisso fica marcado só no dia, exatamente como antes.
- Escolher o dia já agenda na hora (comportamento de sempre) e leva junto a hora, se estiver
  preenchida.
- Preencher a hora depois do dia também agenda, com os dois juntos.
- O botão **Confirmar** existe pra quem preenche os dois campos e espera um botão de salvar (mesma
  lição da v1200 na tela Agenda). Sem dia escolhido, ele avisa em vez de falhar calado.
- Os atalhos **Hoje / Amanhã / +7 / +15 / +30** passaram a levar a hora junto: com "09:00"
  preenchido, "Amanhã" marca **amanhã às 9**, não amanhã sem hora.

No celular a linha quebra sozinha quando não cabe — nada estoura pro lado.

## Detalhe técnico (pra quem for mexer depois)

- `app.js` — `ui670ScheduleHtml` ganhou o `<input type="time">`, o botão Confirmar e a dica de
  "hora opcional"; `reagendarDias(id, dias, horaStr)` passou a aceitar e repassar a hora. Nada
  mudou no servidor: `reagendarLembrete` já mandava `hora` desde a v1199 e já ignora hora vazia
  ou inválida.
- `styles.css` — `.ui670-schedule-row` (a linha que quebra sozinha), `.ui670-schedule-ok` e
  `.ui670-schedule-dica`.
- Conferido no navegador (Chromium headless, 412x915 e 1280x900): os três controles ficam na
  mesma linha, sem barra de rolagem lateral, e a hora preenchida chega junto tanto pelo atalho
  quanto pelo Confirmar.
- Teste: `tests/v1207-hora-no-agendar-do-lead.test.mjs`.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
