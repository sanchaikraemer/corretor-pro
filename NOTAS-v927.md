# v927 — Desempenho: o gráfico "Prioridade de atendimento" fecha com a carteira inteira

## O pedido

O dono não entendeu a tela Desempenho: "Clientes ativos" mostrava 241, mas o gráfico de rosca
"Prioridade de atendimento" ("Distribuição real da carteira") somava só 98 — Fazer agora (0%) +
Agenda (12%) + Aguardando cliente (88%). Os outros 143 não apareciam em lugar nenhum, sem
nenhuma explicação na tela. Pedi 4 opções pra ele escolher; a escolhida foi **manter o gráfico de
rosca, completando com a fatia que faltava**.

## Causa

O gráfico só contava 4 categorias de `cp786Categoria` (`agora`, `respondeu` — sempre 0, morta —,
`programados`, `aguardando`) e usava a SOMA DELAS como "total" pra calcular as porcentagens. Quem
cai em `sem-acao` (conversa ainda rasa: menos de 5 mensagens do cliente) simplesmente não entrava
na conta — nem no total, nem em nenhuma fatia. Resultado: o "total" do gráfico não tinha relação
nenhuma com o "Clientes ativos" mostrado duas linhas acima, na mesma tela.

## O que mudou

- Nova fatia **"Prospecção"** (cor `--cp-muted`, neutra) conta quem está em `sem-acao`.
- O total usado pra calcular todas as porcentagens (e mostrado no centro da rosca) passa a ser
  `items.length` — a carteira inteira — em vez da soma das 3 categorias antigas. Agora o número
  no meio do gráfico bate exatamente com "Clientes ativos".
- Rótulo embaixo do número trocado de "atendimentos" pra "clientes ativos" (mesma nomenclatura
  do card logo acima, pra reforçar que é a mesma contagem).

## Verificação

- `tests/v927-desempenho-bate-com-carteira.test.mjs` (novo): confirma que o total do gráfico é
  `items.length`, que `sem-acao` é contado em `counts.semAcao`, que a legenda tem a 4ª linha
  "Prospecção", que o `conic-gradient` fecha os 5 stops em 100%, e que o rótulo HTML deixou de
  dizer "atendimentos" e passou a dizer "clientes ativos".
- Suíte inteira verde (`npm test`); `node --check app.js` e `node build.js` OK.

## Arquivos
- `app.js` (`renderCorretorProDashboard`: `counts.semAcao`, total = `items.length`, legenda e
  `conic-gradient` com a 4ª fatia), `index.html` (rótulo do donut), 
  `tests/v927-desempenho-bate-com-carteira.test.mjs` (novo), `package.json`/`package-lock.json`,
  `NOTAS-v927.md`, versão **926 → 927**.
