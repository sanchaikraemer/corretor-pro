# Corretor Pro — Atualização 821

## Topo da tela do lead em 2 cards

- O topo agora tem dois cards lado a lado (no desktop): à esquerda os dados do lead
  (menor) e à direita a "Registrar observação" já aberta, pronta pra digitar ou gravar áudio.
- A observação saiu dos accordions de baixo (não fica mais duplicada).
- No celular/tablet os dois cards empilham em uma coluna só.

## Validação

- Versão interna: `7.121.0`.
- Versão exibida: `821`.
- Novo teste `tests/v821-observacao-topo.test.mjs`: confirma que o campo da observação
  aparece uma única vez (id não duplicado), que o topo tem os dois cards e que a
  observação não é mais um accordion.
- Testes de sintaxe e regressão concluídos; build limpo.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
