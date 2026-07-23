# v949 — cor do motivo do ranking: coral (identidade do app), não azul-ciano

## O pedido do dono

Depois do deploy da v948 (destaque visual no motivo do ranking), o dono viu em produção e
apontou: "não gostei da cor, tá fora da paleta e identidade visual" — a v948 tinha usado
`var(--cyan)` (azul), uma cor reservada no código pra "dados/análise" mas que na prática nunca
apareceu de forma proeminente no app — o app inteiro é dark teal + **coral** (`--accent`/`--lime`,
`#FF6258`), presente em praticamente todo destaque visual (números da barra de mensagens, "Fazer
agora", botão "Atender mais um", dots de prioridade).

## O que mudou

Trocado `var(--cyan)` por `var(--accent)` nos dois lugares:
- **Home** (`.cp-hoje-row .chr-exp`): texto do motivo em coral, negrito — mesma cor dos números
  de mensagens e do card "Fazer agora".
- **Card "Fazer agora" do detalhe** (`.cp704-motivo`): o "chip" de fundo passou a usar a mesma
  fórmula rgba coral já usada em `.cp-atender-mais` (`rgba(255,98,88,...)` pra fundo/borda,
  `var(--accent)` pro texto) — em vez de inventar uma paleta nova, reaproveita exatamente o padrão
  visual que já existe no app pra esse tipo de destaque.

## Verificação

- `tests/v946-ranking-explicavel.test.mjs` (atualizado): as duas asserções que travavam
  `color:var(--cyan)` passaram a exigir `color:var(--accent)`.
- Verificação visual real em Chromium headless (mesmo método das versões anteriores): confirma
  coral em negrito nos dois lugares, visualmente consistente com o resto do app (mesma cor dos
  números da barra de mensagens ao lado).
- Suíte inteira verde (`npm test`); `node build.js` OK, versão 949.

## Arquivos
- `app.js` (`.chr-exp` e `.cp704-motivo` — cor trocada de `--cyan` pra `--accent`),
  `tests/v946-ranking-explicavel.test.mjs` (atualizado),
  `package.json`/`package-lock.json`, `NOTAS-v949.md`, versão **948 → 949**.
