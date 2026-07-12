# Atualização #795 — Agenda na barra de baixo e sino da agenda

## Mudanças

- Na barra de navegação inferior (celular), o botão **Propostas** foi substituído por **Agenda**. Propostas continua acessível pelo menu **Mais**.
- O **pontinho vermelho do sino** (topo) agora indica a **agenda do dia**: aparece somente quando há compromisso ou lembrete para hoje; sem agenda no dia, sem pontinho. O sino continua abrindo a Agenda ao toque.

## Detalhe técnico

- O sino passa a usar a contagem de agenda de hoje (`state.agendaCount`, já calculada), em vez de "clientes que pedem ação".
- Atualiza em qualquer tela, sem precisar recarregar (ao criar, excluir ou reagendar lembrete/compromisso).

## Compatibilidade

- Nenhuma alteração em importação, análise, dados, Supabase ou OpenAI.
