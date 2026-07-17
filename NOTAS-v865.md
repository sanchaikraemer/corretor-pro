# v865 — ajustes finos na barra de etapa (em andamento)

Versão que agrupa ajustes pedidos depois da v864 (barra de progresso em gradiente).

## Mudanças

- **Texto da barra de etapa em peso normal**: o rótulo ("Nome da etapa · passo X de 6")
  estava em negrito pesado (`font-weight:950`) e, sobre o gradiente, ficava com aparência
  borrada. Passou para `font-weight:400` (normal), mantendo o branco e a sombra leve pra
  legibilidade.

- **Linha "Última análise" de volta no cabeçalho do lead**: acima de "Última mensagem —
  data" voltou uma linha no mesmo formato, "Última análise — data", que mostra quando foi
  feita a última análise/reanálise do cliente (existia antes e sumiu num refactor). A data
  vem, em ordem de prioridade, de `reanalisadoEm` → `geradoEm` → última atualização do lead;
  na ausência de qualquer data, a linha simplesmente não aparece (não inventa data).
- **Linhas de meta em negrito**: "Última análise" e "Última mensagem/Último atendimento"
  passaram a `font-weight:700` (aqui o negrito ajuda a destacar — diferente da barra de
  etapa, onde foi removido).

## Verificação

- `tests/v864-barra-progresso-etapa` ganhou uma checagem de que o texto da barra fica em
  peso normal (400).
- Novo teste `tests/v865-ultima-analise`: prioridade da data (reanálise > geração >
  atualização), a linha "Última análise" acima de "Última mensagem" e o negrito das metas.
- `npm test`: suíte completa verde.
