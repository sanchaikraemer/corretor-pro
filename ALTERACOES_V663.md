# Atualização 663

## Importação mostra o erro real quando não salva

- Antes, quando a importação de leads (Configurações → "Importar leads (CSV)") não conseguia
  gravar nenhum lead, a tela só dizia "a refazer" e engolia o motivo devolvido pelo servidor.
- Agora, se nenhum lead for salvo, o importador mostra em vermelho o **erro exato** do servidor
  (motivo da recusa: coluna/constraint/permissão/Supabase), permitindo identificar a causa na hora.
- Cache PWA isolado na versão 663 (`service-worker.js`) para forçar a atualização do app.
