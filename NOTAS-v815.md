# Corretor Pro — Atualização 815

## Correção: reimportação criava lead duplicado

- Corrigido o caso em que reimportar uma conversa criava um novo lead em vez de atualizar o existente (ex.: dois "Neto").

## Causa

A deduplicação encontrava o lead existente e tentava atualizá-lo, mas se essa atualização falhasse por qualquer motivo, o código caía no caminho de criação e inseria um registro NOVO — gerando o contato duplicado.

## Solução

- Quando a deduplicação já encontrou o lead, o app agora tenta atualizar de novo e, se ainda falhar, prefere retornar erro a criar um lead duplicado.
- O caminho de criação de registro novo só roda quando a deduplicação realmente não encontrou nenhum lead correspondente (por telefone, nome de arquivo ou nome do cliente).

## Observação sobre deduplicação

A deduplicação casa a conversa por telefone, depois por nome do arquivo do WhatsApp e por fim pelo nome do cliente. Exportações do WhatsApp sem número de telefone dependem do nome/arquivo, que pode variar entre importações. Se ainda aparecer duplicidade nesses casos, é possível deixar o casamento por nome mais tolerante — com o cuidado de não unir dois contatos diferentes de mesmo nome.

## Validação

- Versão interna: `7.115.0`.
- Versão exibida: `815`.
- Suíte de testes completa concluída.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
