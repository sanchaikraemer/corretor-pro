# Corretor Pro — Atualização 814

## Correção: lead arquivado continuava nas prioridades

- Ao arquivar um cliente, ele agora sai na hora dos "Atendimentos prioritários" e da Home.
- Antes, o lead ficava arquivado no servidor, mas continuava aparecendo na tela até um refresh manual.

## Causa

A Home lê os leads de um cache em memória (fast-path do `carregarDashboard`). Depois de arquivar, o app só chamava `carregarDashboard()`, que reaproveitava esse cache antigo — ainda com o lead como ativo. A busca de leads (`getLeadsData`) também não era invalidada.

## Solução

- `arquivarLead` agora atualiza as listas em memória (`state.todosLeads`, `state.leads`, `state.itemsAtivos`) marcando o lead como "Geladeira" na hora.
- Invalida o cache de leads (`invalidarLeadsCache`) e dispara uma releitura (`loadRecentLeads(true)`) para reconciliar com o servidor.
- Assim a lista de prioridades é recalculada sem o lead arquivado imediatamente.

## Validação

- Versão interna: `7.114.0`.
- Versão exibida: `814`.
- Suíte de testes completa concluída.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
