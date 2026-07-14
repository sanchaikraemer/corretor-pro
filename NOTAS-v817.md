# Corretor Pro — Atualização 817

Reaplicação das correções sobre a base v811 reenviada, consolidando tudo numa versão só.

## Correções de interface (app.js) — reaplicadas

- **Análise comercial "antiga" em loop:** a constante de arquitetura do front voltou a bater com a do backend (`v808-aprendizado-continuo-real`). Sem isso, toda análise recém-gerada era tratada como antiga e a tela pedia reanálise sem parar.
- **App voltava sozinho pra tela inicial:** ao recarregar (atualização, service worker ou o Android reabrindo o PWA depois do WhatsApp), o app agora reabre o lead que estava na tela em vez de cair na Home.
- **Lead arquivado continuava nas prioridades:** ao arquivar, o lead sai na hora da Home/prioridades, sem precisar de refresh manual.

## Correções de importação (api/_persistence.js) — já presentes

- **Reimportação não duplica mais o lead:** quando o lead já existe, o app atualiza em vez de criar um novo, mesmo se a atualização falhar na primeira tentativa.
- **"Mesmo nome, mesmo lead":** a reimportação reconhece o mesmo cliente mesmo quando o nome varia (ex.: "Neto" x "Neto Boulevard"), sem fundir nomes completos diferentes que só dividem o primeiro nome.

## Validação

- Versão interna: `7.117.0`.
- Versão exibida: `817`.
- Suíte de testes completa concluída, incluindo os testes de sincronização de arquitetura, restauração de rota no boot e deduplicação por nome.

Não há criação de tabela, coluna ou função nova no Supabase nesta atualização.
