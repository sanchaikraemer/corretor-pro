# Validação — Corretor Pro V657

## Estrutura e identidade

- Home reconstruída na composição da Opção A: sidebar, topbar, cinco indicadores, próximos atendimentos, desempenho, funil, atendimentos em andamento e atividades.
- Versões clara e escura.
- Layout mobile com dois indicadores por linha, receita em largura total, cards compactos e navegação inferior.
- Marca Corretor Pro e destaque coral aplicados em todo o shell.
- Imóveis e Leads possuem destinos e estados ativos separados.

## Funcionalidade e desempenho

- Listagens continuam leves e carregadas sob demanda.
- Detalhe do lead mantém o histórico completo.
- Reimportação e comparação de evolução não limitam mais as mensagens novas a 40; conversas longas são processadas integralmente em blocos.
- Cache do PWA isolado em `corretor-pro-static-v657`.
- Registro do service worker versionado em `/service-worker.js?v=657` no build.

## Testes executados

- Sintaxe de `app.js`, `build.js`, `service-worker.js`, `api/lead-update.js` e `api/_pipeline.js`.
- IDs HTML sem duplicação.
- Estrutura do dashboard, navegação, temas e cache.
- Histórico de 125 mensagens: prévia leve e detalhe completo.
- Navegação única, telas sob demanda e carteira paginada.
- Build limpo de produção.
