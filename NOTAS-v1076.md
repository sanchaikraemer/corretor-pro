# NOTAS v1076 — listas da Home no modelo escolhido pelo dono (tabela "com próximo passo")

## Contexto

Depois de 3 rodadas de modelos visuais, o dono anexou o print do modelo que quis aplicar
("ta ruim ainda, mas vamos adiante, aplique esse modelo em anexo"): a **tabela com próximo
passo** — nº, cliente (com o interesse embaixo), a recomendação da IA e os dias parado.
Nas rodadas ele também tinha vetado: **ícone de WhatsApp na lista** e **excesso de cor/etiquetas**.

## O que mudou

Todas as listas abertas pelos cards da Home — **Fazer agora, Aguardando cliente, Total de
leads (Carteira ativa), Sem atender 30d+, Propostas feitas** e as demais renderizadas por
`abrirGrupoHome` — trocaram a grade antiga de cartões pela tabela do modelo:

- Colunas: **nº · Cliente** (nome forte, interesse embaixo) **· Próximo passo** (o
  `cp786ResumoAcao` real de cada lead, o mesmo texto usado no restante do app) **· Parado há**
  (número em destaque; "atendido hoje" discreto quando for o caso; "—" sem dado) **· seta**.
- A **linha inteira abre o atendimento** do cliente (não há mais botão de WhatsApp nem
  etiquetas coloridas na listagem — o WhatsApp continua dentro do atendimento).
- **No celular**, o cabeçalho de colunas e a coluna "Próximo passo" se recolhem — sobra
  nº, cliente, dias e a seta.
- Zebra e divisórias discretas; tema claro coberto.
- Os expansores continuam: "Ver mais N" (ação-hoje) e "Fila de retomada — ver mais N"
  (backlog do Fazer agora), agora com a numeração contínua da tabela.
- O rótulo coral "Ataca agora — top 12" saiu (contra a direção "menos colorido").

CSS: bloco novo `.lgt*` no lugar de `.lista-leads-grid` (que ficou sem nenhum uso e saiu).

## Testes

- Novo: `tests/v1076-listas-home-modelo-tabela.test.mjs` — trava o modelo (colunas, próximo
  passo vindo da recomendação real, linha abre o lead, sem WhatsApp/etiquetas nas linhas,
  recolhimento no celular, grade antiga banida).
- Atualizado: `tests/v942-home-lista-densa-barra-cinza-e-perf.test.mjs` (o "1 cliente por
  linha" agora é garantido pela própria tabela).

## Verificação

- Suíte inteira (`npm test`) verde.
- `npm run build` limpo.

## Arquivos

`app.js` (abrirGrupoHome), `styles.css` (bloco .lgt, remoção da grade antiga),
`tests/v1076-*.test.mjs` (novo), `tests/v942-*.test.mjs` (atualizado),
`package.json`/`package-lock.json` (versão **1075 → 1076**), `NOTAS-v1076.md` (este arquivo).
