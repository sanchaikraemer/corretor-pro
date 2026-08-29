# Corretor Pro v1409 — matriz de consolidação

Esta versão implementa primeiro os conflitos P0/P1 da auditoria de 27/08/2026 sem criar um motor paralelo.

| Conceito alvo | Implementação atual promovida | Decisão v1409 |
|---|---|---|
| Conversation/Event log | timeline + eventos de aprendizado | preservar; separar cópia de envio |
| Fact Engine | montarEstadoComercialDeterministico + extratores | promover para `commercialState.facts` |
| Open loops | perguntas abertas + promessas + compromisso | consolidar em `commercialState.open_loops` |
| Commercial State | estado determinístico + relogioDaConversa | persistir dentro da análise como schema v1 |
| next_actor | relogioDaConversa + resposta da IA | relógio vence contradição de autoria |
| Strategy | leituraDaConversa + nextAction | executar antes da mensagem |
| Message Engine | mensagens da análise | 1 recomendada; alternativas opcionais; vazio é válido |
| Learning | aprendizado atual | preservado nesta etapa; versionamento amplo fica para migração dedicada |
| Histórico incremental | montarEntradaIncremental | preservado, ainda desligado por padrão; ativação fica para etapa com equivalência/reconciliação |
| Mídia | leitor visual já existente no backend | reativado no frontend com seleção por citação e teto |
| Observabilidade | telemetria de custo/uso já existente | preservada; expansão para request_id/latência/fallback/importação/frontend ainda pendente |
| Gate | testes-antes-de-publicar.mjs | fail-closed |

## Não implementado nesta versão

Esta versão não declara a auditoria inteira como concluída. Ficam para etapas próprias, porque exigem migração/infraestrutura e regressão dedicada:

- refatoração física completa de `app.js`/`_pipeline.js`;
- repository multiempresa obrigatório e remoção progressiva de acesso direto com service role;
- automação de migrations;
- integração oficial do WhatsApp e reconciliação automática de eventos reais;
- checkout/assinatura automática;
- Learning Engine totalmente tipado, escopado e versionado;
- análise incremental como caminho padrão, com testes de equivalência vs. reconciliação completa;
- observabilidade completa (request_id, latência por etapa, tentativas, fallback/repair, erros de front/importação);
- redução ampla de `innerHTML`, handlers inline, catches silenciosos e code splitting adicional.

A v1409 entrega os conflitos P0 que contaminavam o estado e a fundação do `CommercialState`/`next_actor` sem fingir que o roteiro de 90 dias acabou em um único deploy.
