# v1012 — meta de atendimentos por dia agora é de cada corretor (campo no Cérebro)

## Contexto

Num sábado o sino avisou: "34 atendimentos esperam por você na segunda". O dono corrigiu na
hora: "não pode ser 34, tem que ser os mesmos 10 previstos no dia" — o aviso estava mostrando
o BACKLOG inteiro da categoria "agora", mas na segunda a tela só entrega a dose do dia (10).
E emendou a segunda parte: a meta de 10 era escolha DELE — outro corretor do SaaS pode querer
5, 15, o que achar. Então a meta virou um campo do Cérebro Comercial, por corretor.

## O que mudou

### O aviso do sino nunca promete mais que a dose (app.js, `openNotifyPanel`)

- Fim de semana: "X atendimentos esperam por você na segunda" agora usa `min(meta, fila)` —
  a mesma conta do card "Fazer agora" — em vez do backlog cru (`d.agora`).
- Durante a semana o "X pedem ação" recebeu o mesmo teto, pra nunca prometer mais do que a
  Condução mostra ao clicar.

### Meta configurável (novo campo "Atendimentos por dia")

- **index.html**: campo numérico `cerebroAtendimentosDia` (1 a 50, padrão 10) na tela do
  Cérebro Comercial, ao lado do período dos áudios.
- **app.js**: novo helper `cpMetaAtendimentosDia()` — lê a meta da MESMA fonte da análise
  (`obterCerebroConfigParaAnalise`, ou seja localStorage/form; `state.cerebroCfg` nunca é
  preenchido em runtime, então não dá pra depender dele). Fora de 1–50 cai no padrão
  histórico `CP_DOSE_DIA` (10). Usado em:
  - `cpFazerAgoraDose` (dose = meta − atendidos hoje);
  - o corte da fila "Fazer agora" na Condução (`slice(0, meta)`);
  - fallbacks da Home e da tela de Condução que antes cravavam `CP_DOSE_DIA`.
  - `sanitizeCerebroConfigV762`, `carregarCerebro`, `salvarCerebro` e `zerarCerebroTudo`
    passaram a carregar/salvar/preservar `atendimentosPorDia` (zerar mantém — é preferência
    de trabalho, não aprendizado).
- **api/cerebro-config.js**: `atendimentosPorDia` entrou nos `DEFAULTS`, no
  `sanitizeCerebroConfig` (novo `clampAtendimentosDia`, 1–50 → fora disso 10) e no save
  padrão — cada corretor guarda a sua meta no próprio Cérebro (tabela `direciona_config`,
  já separada por conta desde a v1002).

## Testes

Novo `tests/v1012-meta-atendimentos-por-corretor.test.mjs` (clamp do servidor com defaults,
campo no formulário, helper sem `state.cerebroCfg`, dose e Condução usando a meta, sino com
`min(meta, fila)` e sem o backlog cru). Ajustes: `v914` (assinatura nova da dose) e `v924`
(stub da meta no sandbox — o teste é sobre a matemática da dose).

`npm test`: suíte inteira verde.

## Arquivos

`app.js`, `index.html`, `api/cerebro-config.js`, `package.json`, `package-lock.json`,
`tests/v1012-meta-atendimentos-por-corretor.test.mjs` (novo), `tests/v914-*.test.mjs`,
`tests/v924-*.test.mjs`, `NOTAS-v1012.md`.
