# v886 — calibragem dos pesos da prioridade (decisão do dono)

Ajuste fino do ranking do "Fazer agora" (v885), com os valores que o dono revisou item a item.

## Decisões

| Critério | Antes (v885) | Agora (v886) |
|----------|:---:|:---:|
| A — engajamento (por mensagem) | 2 | **2** (mantido) |
| B — abandono (por dia parado) | 1 | **1** (mantido) |
| C — bônus "cliente falou por último" | +25 | **removido** |
| D — teto de mensagens | 120 | **120** (mantido) |
| E — teto de dias parado | 90 | **90** (mantido) |
| F — dose do dia ("Fazer agora") | 10 | **10** (mantido) |
| G — mínimo de mensagens pra ser prioridade | 3 | **5** |
| H — proteção pós-atendimento | 5 dias | **5 dias** (mantido) |

## Por que remover o C

O dono nunca deixa o cliente sem resposta, e a última mensagem do cliente costuma ser só
"obrigado / ok / positivo" — não indica prioridade. Então "cliente falou por último" deixou
de somar ponto (constante `CP_BONUS_BOLA` e o uso de `cp786UltimoFoiCliente` saíram da nota).

Nota agora = `min(mensagens,120)×2 + min(diasParado,90)×1`.

## G: 3 → 5

Lead com menos de **5** mensagens é considerado conversa rasa/prospecção e **não entra na
fila "Fazer agora"** (cai em "Aguardando cliente"). Antes o corte era 3. Vira a constante
`CP_MIN_MSGS_PRIORIDADE = 5`.

## Arquivos
- `app.js` — `cpNotaPrioridade` sem o bônus C; constante `CP_MIN_MSGS_PRIORIDADE=5` usada em
  `cp786Categoria`; `CP_BONUS_BOLA` removida.
- `tests/v886-calibragem-prioridade.test.mjs` (novo, trava os pesos) + `v885` atualizado.
- `package.json` — versão 885 → 886.

## Ainda calibrável
Se, vendo a fila real, a ordem não bater com o que o dono atacaria primeiro, é só mudar os
pesos `CP_PESO_ENGAJAMENTO` / `CP_PESO_ABANDONO` (ex.: abandono ×2) e subir uma versão.
