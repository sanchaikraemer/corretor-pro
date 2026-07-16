# Corretor Pro — Atualização 813

## Correção: app voltava sozinho pra tela inicial

- Corrigido o problema em que o app largava o cliente que estava aberto e voltava pra Home sozinho.
- Acontecia principalmente no fluxo normal de uso: abrir o lead, tocar em "Copiar", ir pro WhatsApp e voltar pro Corretor Pro.

## Causa

Sempre que o app recarrega — por atualização de versão, troca de service worker ou porque o Android reabriu o PWA depois de ele ficar em segundo plano — o boot montava a Home e ignorava a rota que já estava guardada em `history.state`. Como a URL não muda ao abrir um lead, todo reload caía na tela inicial e o corretor perdia o lugar.

## Solução

- No boot (`iniciarDireciona`), o app agora lê `history.state` e, se o corretor estava em um lead, reabre esse lead direto, em vez de cair na Home.
- A Home e a agenda continuam carregando em segundo plano, então tocar em "Voltar" já mostra a lista pronta.
- `abrirLead` busca o detalhe pela API e volta pra Home sozinho caso o lead não exista mais, então a restauração é segura.
- Adicionado teste `tests/boot-route-restore.test.mjs` para impedir que a restauração de rota seja removida sem querer.

## Validação

- Versão interna: `7.113.0`.
- Versão exibida: `813`.
- Suíte de testes completa concluída, incluindo o novo teste de restauração de rota no boot.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
