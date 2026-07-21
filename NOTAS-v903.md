# v903 — arquivar: confirmação em-app, some da busca e volta pra home

## Bug (prints do dono)
Ao arquivar um lead:
1. Abria uma "tela feia" — o `confirm()` nativo do navegador ("corretor-pro-zeta.vercel.app diz:
   Arquivar este lead?…").
2. Depois do OK não avisava nada e REABRIA o lead. O correto: sumir da tela e voltar pra home —
   "arquivou, acabou".
3. O cliente arquivado continuava aparecendo na busca (a lista da busca usava o cache
   `state.todosLeads`, que ainda trazia o lead como ativo).

## Correção
- **Confirmação em-app** (`cp903Confirm`): modal dentro da identidade do app (Promise<boolean>,
  Enter confirma, Esc/clique fora cancela), no lugar do `confirm()` nativo. CSS em `styles.css`
  (`.cp903-*`). Fallback pro `confirm()` nativo se a função não existir.
- **Volta pra home** (`ui683MoverEtapaComEvento`): estados de saída (Arquivado/Perdido/Vendido)
  agora, depois do OK, removem o lead dos caches na hora (`removerLeadDosCaches`), fecham o lead
  (`state.lead=null`), dão um toast claro ("Lead arquivado.") e voltam pra home — em vez de
  reabrir o lead.
- **Some da busca**: `removerLeadDosCaches` tira o lead de `state.todosLeads`/`state.leads` na
  hora, então ele deixa de aparecer na busca imediatamente. As buscas (`buscaLeadInline`,
  `renderBuscaGlobal`) já excluíam Geladeira/Perdido via `foraDaBusca` — agora o cache também
  reflete isso sem esperar refresh.

## Verificação
- Teste de unidade confirma: `cp903Confirm` existe e está exposta; o CSS do modal está presente;
  o fluxo de saída usa `cp903Confirm`, identifica os 3 estados como `saiDaLista`, remove dos
  caches, fecha o lead, volta pra home e dá `return` ANTES de reabrir o lead; e que as buscas
  seguem excluindo arquivados (`foraDaBusca`).
- O dono confirma no app arquivando um lead: modal bonito → volta pra home → some da busca.

## Arquivos
- `app.js` — `cp903Confirm` (nova), `ui683MoverEtapaComEvento` (volta pra home + limpa caches).
- `styles.css` — `.cp903-*` (modal em-app).
- `tests/v903-arquivar-em-app-volta-home.test.mjs` (novo).
- `package.json` — versão 902 → 903.
