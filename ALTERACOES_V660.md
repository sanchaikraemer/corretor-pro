# Atualização 660

## Restauração dos leads

- Restauração automática dos leads existentes nas tabelas antigas do Supabase.
- Migração idempotente para a estrutura atual, sem duplicar leads já existentes.
- Preservação de nome, telefone, empreendimento, etapa, observações, próximo contato e motivo de perda.
- Botão manual de conferência e restauração em Configurações.
- Fallback mantido para importação do CSV de backup.
- Cache PWA isolado na versão 660.
