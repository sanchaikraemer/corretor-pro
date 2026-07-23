import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v926 (original) — a dose do "Fazer agora" na Home precisava enxergar a FILA RANQUEADA completa
// (cpFilaFazerAgora), não só o balde categorizado estreito ("acao-hoje"/"retomar-cuidado"), que
// podia vir vazio com gente disponível.
// v942 — o dono mandou tirar de vez o card "Nenhum lead prioritário" e SEMPRE mostrar os leads do
// dia empilhados, puxando direto da fila ranqueada completa. Este teste roda o trecho REAL de
// decisão da Home (extraído do app.js) e confirma: a dose vem da fila ranqueada, "Atender mais um"
// puxa além da meta, e nunca aparece um card dizendo que não há trabalho quando há fila.

const ini = app.indexOf('let filaRanqueada = typeof cpFilaFazerAgora');
const fim = app.indexOf('// Botão "Pular próximo"');
assert.ok(ini !== -1 && fim !== -1 && fim > ini, 'trecho de decisão da Home não encontrado em app.js');
const trecho = app.slice(ini, fim);

function rodar({ fila, meta, extra }){
  const state = { fazerAgoraExtra: extra, pulados: null };
  const cpFilaFazerAgora = () => fila;
  const cpFazerAgoraDose = () => meta;
  const CP_DOSE_DIA = 10;
  const cpFimDeSemana = () => false;
  const cpHomeLeadRow = (l) => `<row id="${l.id}">`;
  return eval(`(function(){ const items=[]; ${trecho} return { dose, disponiveisParaPuxar, top3Html }; })();`);
}

const fila = [{id:'a'},{id:'b'},{id:'c'},{id:'d'},{id:'e'}];

// Dose = topo da fila ranqueada, cortado na meta do dia.
const r1 = rodar({ fila, meta: 3, extra: 0 });
assert.deepEqual(r1.dose.map(l=>l.id), ['a','b','c'], 'a dose vem da fila ranqueada completa, cortada na meta');
assert.equal(r1.disponiveisParaPuxar.length, 2, 'o resto da fila fica disponível pra puxar');
assert.match(r1.top3Html, /cp-hoje-list/, 'renderiza a lista compacta dos leads do dia');
assert.doesNotMatch(r1.top3Html, /Nenhum lead prioritário|Meta de hoje batida/, 'nunca mais o card amarelo que o dono mandou tirar');

// "Atender mais um" (extra=1) puxa o próximo da fila além da meta.
const r2 = rodar({ fila, meta: 3, extra: 1 });
assert.deepEqual(r2.dose.map(l=>l.id), ['a','b','c','d'], 'o extra puxa o próximo da fila ranqueada');
assert.match(r2.top3Html, /cp-atender-mais[\s\S]*cpAtenderMaisUmHoje\(\)/, 'mostra o botão "Atender mais um" quando ainda há fila');

// Meta já batida (0), mas ainda há gente elegível → convite discreto, sem card grande.
const r3 = rodar({ fila, meta: 0, extra: 0 });
assert.equal(r3.dose.length, 0, 'meta 0 = dose vazia');
assert.match(r3.top3Html, /cp-hoje-done[\s\S]*cpAtenderMaisUmHoje/, 'meta batida mostra convite discreto, não card amarelo');

// Fila realmente vazia → linha neutra, sem box amarelo.
const r4 = rodar({ fila: [], meta: 5, extra: 0 });
assert.match(r4.top3Html, /cp-hoje-vazio/, 'fila vazia = linha neutra');
assert.doesNotMatch(r4.top3Html, /Nenhum lead prioritário/, 'sem o card que o dono odiava');

console.log('v926-continuar-usa-fila-completa: ok');
