import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v933 (original) — separava "meta batida" de "dose pendente" pra não mostrar "Meta batida" com a
// meta ainda por bater. v942 — o dono mandou remover de vez esses cards ("aquela merda amarela
// dizendo que não temos trabalho") e SEMPRE mostrar os leads do dia empilhados. Este teste vira um
// guarda de regressão: os cards não podem voltar, e a Home renderiza a lista compacta.

const iniRBH = app.indexOf('function renderBotoesHome(){');
const fimRBH = app.indexOf('\nfunction ', iniRBH + 1);
assert.ok(iniRBH !== -1 && fimRBH !== -1, 'renderBotoesHome não encontrada em app.js');
const rbh = app.slice(iniRBH, fimRBH);

// Os cards que o dono mandou tirar NÃO podem existir na Home.
assert.doesNotMatch(rbh, /Meta de hoje batida/, 'card "Meta de hoje batida" removido');
assert.doesNotMatch(rbh, /Nenhum lead prioritário/, 'card "Nenhum lead prioritário" removido');
assert.doesNotMatch(rbh, /Vamos atender mais um\?/, 'texto do card antigo removido');

// A Home renderiza a lista compacta dos leads do dia (cp-hoje-list) puxando da fila ranqueada.
assert.match(rbh, /cp-hoje-list/, 'a Home renderiza a lista compacta dos leads do dia');
assert.match(rbh, /dose\.map\(\(l, ?i\) ?=> ?cpHomeLeadRow\(l, ?i\+1, ?maxMsgsDose\)\)/, 'a lista é montada com cpHomeLeadRow');

console.log('v933-meta-batida-vs-dose-pendente: ok');
