# v982 — barra de urgência nas Oportunidades Esquecidas

## Contexto

O dono pediu pra ver opções de visual pra tela Hoje ("ta feia essa tela"). Depois de comparar
alternativas, escolheu manter a identidade atual (fundo petróleo, coral, mesma fonte) e adicionar
uma barra colorida mostrando o quanto cada oportunidade parada está atrasada — em vez de só o
número em texto.

## O que mudou

Cada linha da lista "⏳ Oportunidades esquecidas" (Home) ganhou:

- Uma barrinha fina embaixo do nome/produto, cujo **comprimento** cresce com os dias parado (até
  um ano; a partir daí fica no máximo).
- A **cor** da barra e do número de dias passa a refletir a urgência real, usando as cores
  semânticas que o app já tem — nenhuma cor nova:
  - **180+ dias parado** → `--risco` (vermelho): precisa de atenção real.
  - **60 a 179 dias** → `--morno` (cinza claro, como o resto do app desde a v942).
  - **Menos de 60 dias** → `--soft` (neutro).

Antes, o número de dias parado usava sempre a mesma cor neutra, então uma oportunidade parada há
600 dias e uma parada há 8 dias apareciam visualmente idênticas — só o texto (que exige ler, não
só olhar) distinguia.

## Fix

- `app.js`: nova função `radarSeveridade(parado)` — pura, calcula cor e largura da barra a partir
  dos dias parado. `radarRowHTML` passa a usá-la tanto na barra nova (`.radar-bar`) quanto na cor
  do número de dias (antes fixa em `var(--soft)`).
- `styles.css`: `.radar-bar` (trilho) e `.radar-bar i` (preenchimento) — mesmo padrão visual
  (trilho translúcido + preenchimento colorido) já usado em outras barras de progresso do app.
- Escopo intencionalmente restrito à lista de Oportunidades Esquecidas — os cartões de estatística
  do topo (`Fazer agora`/`Total de leads`/`Agenda`/`Aguardando cliente`, classe `.ui-kpi`) não
  foram tocados porque são compartilhados com outras telas (Condução, filtros de pipeline);
  mudar o visual deles ali gerava efeito colateral fora do que foi pedido ("essa tela").

## Verificação

- `npm test`: suíte inteira verde (157 checks), incluindo o novo `v982-radar-barra-urgencia`
  (cobre os 3 níveis de severidade, o teto de 100% da barra, o piso mínimo visível pra quem está
  pouco parado, e que `radarRowHTML` realmente usa a nova função em vez da cor fixa antiga).
- Conferido visualmente rodando `radarRowHTML` de verdade (extraída de `app.js`) com dados
  sintéticos e o `styles.css` real, via captura de tela local — sem depender de acesso à produção.
- `npm run build`: build limpo, versão 982.

## Arquivos

- `app.js` (`radarSeveridade` novo, `radarRowHTML` atualizado), `styles.css` (`.radar-bar`),
  `tests/v982-radar-barra-urgencia.test.mjs` (novo), `package.json`/`package-lock.json`,
  `NOTAS-v982.md`, versão **981 → 982**.
