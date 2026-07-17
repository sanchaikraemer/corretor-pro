# v862 — botões travados durante a importação

## Contexto

Na tela "Importar conversa", os botões **"Nova análise"** (`#clearAnalysis`) e
**"Diagnóstico"** (`#diagnoseOpenAI`) continuavam clicáveis enquanto o ZIP estava sendo
processado. Dava pra apertar "Nova análise" no meio de "Transcrevendo" e zerar a tela, ou
disparar o "Diagnóstico" concorrendo com a análise em andamento. O pedido do dono: os dois
botões ficam **desabilitados (apagados, sem clique)** enquanto qualquer etapa do
processamento estiver rodando (Recebendo, Enviando, Extraindo, Transcrevendo, Analisando,
Salvando) e só voltam a ficar ativos quando aparece **"Concluído"**.

## O que mudou

### `app.js`
- Novo helper `setBotoesImportacao(desabilitados)`: liga/desliga o `disabled` dos dois
  botões (e marca a classe `is-processando`).
- `renderEtapas(idxAtual, …)` — o funil único por onde **toda** transição de etapa passa —
  agora chama `setBotoesImportacao(idxAtual >= 0 && idxAtual <= 5)` logo no início. Ou seja:
  - etapas **0..5** (Recebendo…Salvando) → botões **travados**;
  - etapa **6** (Concluído) e **7** (Falha recuperável) → botões **liberados** (na falha
    também libera, pra o corretor poder recomeçar ou diagnosticar).
- O ramo de falha terminal de `uploadLargeZipToSupabase` (que retorna `false` sem passar por
  `renderEtapas`) agora chama `setBotoesImportacao(false)` explicitamente, pra não deixar os
  botões presos quando a análise falha nessa etapa.

### `styles.css`
- Regra `.btn:disabled,.btn[disabled]` dá a aparência "apagada" (opacidade reduzida,
  cursor bloqueado, sem clique) — antes não existia estilo de botão desabilitado genérico.

## Verificação

- Novo teste-guarda `v862-botoes-importacao`: extrai `setBotoesImportacao` + `renderEtapas`
  e roda contra um DOM falso, conferindo que os **dois** botões ficam desabilitados em
  **cada uma** das etapas intermediárias (0..5) e voltam a ficar habilitados em "Concluído"
  (6) e na falha recuperável (7). Também confere que o CSS apaga o botão desabilitado.
- `npm test`: suíte completa verde.

## Não mudou

- Nada da lógica de análise, pipeline ou persistência — só o estado clicável dos dois
  botões da tela de importação e o estilo do botão desabilitado.
