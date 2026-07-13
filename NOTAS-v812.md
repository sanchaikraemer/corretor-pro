# Corretor Pro — Atualização 812

## Correção: análise comercial ficava "antiga" mesmo após atualizar

- Corrigido o loop em que a tela do lead continuava exibindo "Análise comercial antiga / pendente" e o botão "Atualizar análise comercial" logo depois de reanalisar.
- A mensagem "ainda não gerada" e a "próxima ação sem usar dados antigos" também deixam de aparecer indevidamente após uma reanálise bem-sucedida.

## Causa

Na v808 o backend passou a marcar cada análise com a arquitetura `v808-aprendizado-continuo-real`, mas o frontend (`app.js`) continuou exigindo exatamente `v806-cerebro-validacao-retomada`. Como a validação usa comparação exata, toda análise recém-gerada era tratada como antiga e a tela pedia reanálise em loop.

## Solução

- Sincronizada a constante `ARQUITETURA_MENSAGENS_ATUAL` do frontend com a do backend (`api/_pipeline.js`).
- Adicionado teste automatizado `tests/arquitetura-sync.test.mjs`, que falha se o rótulo de arquitetura do frontend e do backend divergirem, evitando que o problema volte em versões futuras.

## Validação

- Versão interna: `7.112.0`.
- Versão exibida: `812`.
- Suíte de testes completa concluída, incluindo o novo teste de sincronização de arquitetura.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
