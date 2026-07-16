# v861 — fila do "Hoje" mistura chance de venda + urgência

## Contexto

O dono observou, com razão, que as prioridades da tela "Hoje" estavam **longe da
probabilidade de converter venda**: leads parados há 80–140 dias apareciam no topo só
porque "alguém estava esperando" ou "havia um compromisso vencido", enquanto leads quentes
(perto de fechar) afundavam. Pediu explicitamente para **misturar venda + urgência**.

## Diagnóstico (o porquê)

O app já calculava uma nota de chance de venda boa (`scoreConversaoHoje`: etapa, proposta/
simulação, visita, comprador real, urgência, penalizando curioso/"vou pensar"/lead velho).
Mas a fila era ordenada por `scoreRankingHoje`, que era:

```
scoreRankingHoje = scorePrioridadeAtendimento + clamp(conversao * 0.12, -18, +24)
```

Como `scorePrioridadeAtendimento` separa os níveis de urgência por **degraus de 1000
pontos**, o "tempero" de conversão de no máximo **±24** nunca conseguia cruzar um degrau —
ou seja, a chance de venda era praticamente **decorativa**. A urgência mandava sozinha.

## O que mudou (só `scoreRankingHoje` em `app.js`)

Reescrita da mistura, mantendo tudo o mais intacto (a classificação factual em níveis 1–7
de `filaPorFatos`/`prioridadeAtendimento` **não foi tocada** — os testes que a travam
continuam válidos):

```
urgência = base moderada por nível (faixas de RANKING_BANDA_URGENCIA = 120, não mais 1000)
venda    = chance de venda (limitada a [-140, +200]) * RANKING_PESO_VENDA = 12
ranking  = urgência + venda
```

Efeito: a urgência factual continua contando (nível 1 "cliente esperando" ≈ 1840; nível 7
≈ 1120), mas a **chance de venda passou a ter peso real** (até ±2400) e pode reordenar de
verdade — inclusive promover um comprador forte acima de um lead só um pouco mais urgente
porém frio. Exemplos:
- Cliente esperando + comprador real (nível 1, conversão alta) → topo (como deve ser).
- Comprador quente que você já respondeu (urgência baixa, conversão alta) → sobe bastante.
- Lead frio parado "esperando" (urgência alta, conversão baixa/negativa) → desce.

`scoreRankingHoje` é usado na Home, na Condução/pipeline e na Carteira, então **toda a
priorização do app** ficou consciente da chance de venda — de forma consistente.

## Calibragem

Os dois pesos (`RANKING_PESO_VENDA = 12`, `RANKING_BANDA_URGENCIA = 120`) são a **calibragem
inicial**, deixados como constantes no topo da função justamente para facilitar ajuste
depois de ver o resultado com leads reais. Não foi possível validar a ordenação de ponta a
ponta nesta sessão (sem credenciais Supabase/OpenAI) — a validação foi por `node --check`,
teste-guarda e revisão da conta. **Recomendado o dono olhar a fila real e pedir ajuste dos
pesos se achar a mistura pesada demais para um lado.**

## Verificação

- Novo teste-guarda `v861-fila-mistura-venda` (o tempero de ±24 não pode voltar; pesos
  existem, têm peso real e a urgência está comprimida).
- `npm test`: suíte completa verde. `node build.js`: build limpo, versão 861.

## Não mudou

- `filaPorFatos` e `prioridadeAtendimento` (níveis 1–7) — intactos.
- `scoreConversaoHoje` — intacto (o bloco morto de `tipoRetomada` continua inerte ali; pode
  ser limpo numa próxima fatia, mas não altera comportamento).
