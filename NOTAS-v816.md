# Corretor Pro — Atualização 816

## Deduplicação: "mesmo nome, mesmo lead"

- Reimportar a conversa de um cliente agora reconhece o mesmo lead mesmo quando o nome lido varia entre uma importação e outra (ex.: "Neto" x "Neto Boulevard").
- Isso reduz os casos de contato duplicado quando a exportação do WhatsApp não traz número de telefone.

## Como funciona

- O casamento por nome passou a aceitar variação: dois nomes apontam para o mesmo lead quando são iguais ou quando o nome menor está inteiro dentro do maior.
- Nomes completos diferentes que só compartilham o primeiro nome (ex.: "João Silva" x "João Souza") continuam sendo tratados como pessoas diferentes, para não fundir contatos distintos.
- A ordem de identificação segue: telefone → nome do arquivo do WhatsApp → nome do cliente.

## Validação

- Versão interna: `7.116.0`.
- Versão exibida: `816`.
- Novo teste `tests/dedup-nome.test.mjs` cobrindo os casos de mesmo lead e de leads diferentes.
- Suíte de testes completa concluída.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
