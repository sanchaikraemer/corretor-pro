# Atualização 661

## Base de leads

- Fonte consolidada: `ranking-probabilidade-venda-399-leads.xlsx`, complementada pelos dois CSVs enviados.
- 399 registros avaliados.
- 199 registros com etapa/motivo de perda excluídos.
- 2 duplicidades reais mescladas antes da importação.
- Resultado: 198 leads ativos e únicos.

## Informações preservadas

- Nome, telefone, produto, etapa, prioridade, temperatura, ranking e score.
- Perfil do cliente, motivo de prioridade, preferências, observações e pontos contrários.
- Histórico completo do Direciona e histórico/observações do sistema anterior.
- Datas, responsável, origem, próximo contato e ID original quando disponíveis.

## Funcionamento

- Importação automática e idempotente pela rota `/api/importar-base-leads`.
- Leads existentes são enriquecidos no mesmo registro, sem duplicação.
- Leads já marcados como perdidos no banco não são reativados pela importação.
- Botão de conferência manual disponível em Configurações.
