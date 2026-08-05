export const state={
  lead:null, leads:[], active:"home", navKey:"home", processing:false, analysis:null, msgStyle:"direta",
  dataRevision:0, viewRendered:{}, carteiraVisibleCount:80, pipelineVisibleCount:60, performance:{},
  // v1135 — em que revisão dos dados a carteira em memória (state.todosLeads) foi preenchida.
  // -1 = nunca. Enquanto isto bater com dataRevision, a memória está em dia e as telas podem
  // desenhar a partir dela; quando NÃO bate, alguma coisa mudou desde então e a tela precisa
  // revalidar antes de acreditar no que tem em mãos. Ver carregarAgenda em app.js — a auditoria
  // da madrugada mostrou que era exatamente essa distinção que faltava, e foi ela que produziu
  // os bugs da v1125 (arquivar não somava) e da v1133 ("deletei e não saiu daí").
  carteiraRevisao:-1
};
