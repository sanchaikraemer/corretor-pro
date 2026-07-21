# v902 — "Últimos atendimentos" abre a lista de atendidos (não "Fazer agora")

## Bug (print do dono)
Clicar em "Últimos atendimentos" (link na saudação da home) abria a tela do Condução no filtro
"Fazer agora" — que o dono lia como "atender agora". O link não levava a lugar nenhum parecido
com atendimentos.

## Causa
O link chamava `setPipelineTab("ultimos")`, função do pipeline ANTIGO (abas Oportunidades /
Últimos atendimentos / Todos os contatos). Essas abas hoje estão escondidas
(`styles.css`: `.pipe-tabs{display:none!important}`) e o pipeline atual (Condução, `cp788`) não
consulta `pipelineTabAtiva`. Resultado: `show("pipeline")` renderizava o Condução no filtro
padrão "Fazer agora".

## Correção
Novo `abrirUltimosAtendimentos()`: monta a lista de leads que têm atendimento registrado
(`ultimoAtendimentoTs(l) > 0`), ordena do mais recente pro mais antigo e abre como grupo avulso
(`abrirGrupoHome("__ultimos", …)`) com o título "Últimos atendimentos". O link da home passa a
chamar essa função. Nada mais depende do `setPipelineTab` morto nesse fluxo.

## Verificação
- Teste de unidade extrai `abrirUltimosAtendimentos`, injeta um `state.gruposHome.todos` com
  timestamps variados (e um sem atendimento) e confirma: abre `__ultimos`, título certo, ordem
  do mais recente pro mais antigo e exclui quem não tem atendimento. Também garante que o link
  não usa mais `setPipelineTab("ultimos")`.

## Arquivos
- `app.js` — `abrirUltimosAtendimentos` (nova) + link da saudação repontado.
- `tests/v902-ultimos-atendimentos-abre-lista.test.mjs` (novo).
- `package.json` — versão 901 → 902.
