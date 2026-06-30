# Corretor Pro v075 — execução das melhorias funcionais

## Foco
Versão aplicada sobre o pacote recebido, sem login e sem cadastro de imóveis. O objetivo é melhorar o uso real do corretor: importar, analisar, priorizar e responder melhor.

## Alterações executadas
- Versão atualizada para `v075` / `0.75.0` em app, HTML, cache, pacote, build e documentação.
- Corrigido o seletor de transcrição de áudios: `90 dias` volta a ser o padrão real na tela de importação.
- Priorização da home refinada: agora quem respondeu fica acima de qualquer outro lead.
- Leads sem análise continuam em destaque, mas não passam na frente de cliente que acabou de responder.
- Retomadas frias e oportunidades fortes entram depois, por pontuação comercial.
- Top da home ampliado para 5 atendimentos, deixando mais claro o que agir primeiro.
- Texto da home ajustado para explicar a lógica comercial sem parecer painel genérico.
- Fluxo recomendado reescrito com uso prático: importar, analisar, copiar, marcar atendido e reimportar quando o contato responder.

## Validação
- `npm run check`: OK.
- `npm test`: 55/55 testes passaram.
- `npm run build`: OK, pasta `public` gerada.
