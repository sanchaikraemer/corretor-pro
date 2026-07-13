# Corretor Pro — Atualização 810

## Correção da Home

- Removida a coluna lateral redundante da tela Hoje.
- Removidos os três blocos de skeleton que podiam permanecer indefinidamente.
- A área principal agora ocupa toda a largura disponível no desktop.
- O modo de segurança da Home também limpa qualquer placeholder lateral.
- Uma falha em conteúdo secundário não pode mais derrubar a lista principal de atendimentos.

## Causa

Na v809, quando alguma etapa do processamento do dashboard lançava erro, a lista central era substituída pelo fallback seguro. O fallback não limpava o `homeRight`, que continuava exibindo o HTML inicial de carregamento. Além disso, a coluna estava reservada para indicadores redundantes já solicitados para remoção.
