# v865 — ajustes finos na barra de etapa (em andamento)

Versão que agrupa ajustes pedidos depois da v864 (barra de progresso em gradiente).

## Mudanças

- **Texto da barra de etapa em peso normal**: o rótulo ("Nome da etapa · passo X de 6")
  estava em negrito pesado (`font-weight:950`) e, sobre o gradiente, ficava com aparência
  borrada. Passou para `font-weight:400` (normal), mantendo o branco e a sombra leve pra
  legibilidade.

## Verificação

- `tests/v864-barra-progresso-etapa` ganhou uma checagem de que o texto da barra fica em
  peso normal (400).
- `npm test`: suíte completa verde.
