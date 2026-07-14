# Corretor Pro — Atualização 823

## Ações no topo e Últimas mensagens no rodapé

- Os botões Agendar retorno e Editar lead subiram para o topo da tela do lead, ao lado
  de Reanalisar e Marcar atendimento (aproveitando o espaço vazio do topo).
- Removido o "Marcar atendimento" duplicado — agora aparece uma vez só.
- Removida a barra de ações antiga que ficava no lado direito.
- "Últimas mensagens" desceu para o rodapé, junto de "Ferramentas e ações", continuando
  como o único bloco que abre/fecha (setinha).

## Validação

- Versão interna: `7.123.0`.
- Versão exibida: `823`.
- Novo teste `tests/v823-topo-acoes.test.mjs`: confirma as ações no topo na ordem certa,
  a remoção da barra antiga e "Últimas mensagens" no rodapé colapsável.
- Testes de sintaxe e regressão concluídos; build limpo.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
