import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v860: o TERMÔMETRO (classificar/mostrar leads como quente/morno/frio) foi removido por
// completo — a pedido do dono. Este teste trava a regressão: nem a leitura "Temperatura"
// nem os rótulos de temperatura das abas de triagem podem voltar a aparecer na interface.

// 1) A leitura "Temperatura" (quente/morno/frio) não pode existir na tela, no Excel nem na lógica.
assert.doesNotMatch(app, /\["Temperatura", lc\.temperatura\]/, 'a linha "Temperatura" do lead não pode voltar');
assert.doesNotMatch(app, /"TEMPERATURA"/, 'a coluna TEMPERATURA do Excel não pode voltar');
assert.doesNotMatch(app, /leituraComercial\?\.temperatura|lc\.temperatura/, 'nenhuma lógica pode consultar a temperatura');
assert.doesNotMatch(app, /\btemperatura\b/i, 'a palavra temperatura não pode reaparecer no app.js');

// 2) As abas/KPIs de triagem não podem exibir rótulos de temperatura.
assert.doesNotMatch(app, /<span>Quentes<\/span>/, 'KPI "Quentes" precisa estar renomeado');
assert.doesNotMatch(app, /<span>Reaquecer<\/span>/, 'KPI "Reaquecer" precisa estar renomeado');
assert.doesNotMatch(app, /['"]quentes['"],\s*['"]Quentes['"]/, 'aba "Quentes" precisa estar renomeada');
assert.doesNotMatch(app, /['"]esfriando['"],\s*['"]Esfriando['"]/, 'aba "Esfriando" precisa estar renomeada');
assert.doesNotMatch(app, /['"]reaquecer['"],\s*['"]Reaquecer['"]/, 'aba "Reaquecer" precisa estar renomeada');
assert.doesNotMatch(app, /⚠ REAQUECER/, 'tag "REAQUECER" precisa estar renomeada');
assert.doesNotMatch(app, /Precisa reaquecer/, 'rótulo "Precisa reaquecer" precisa estar renomeado');

// 3) Os nomes novos escolhidos pelo dono (Agora / Parando / Reativar) precisam estar presentes.
assert.match(app, /['"]quentes['"],\s*['"]Agora['"]/, 'aba renomeada para "Agora"');
assert.match(app, /['"]esfriando['"],\s*['"]Parando['"]/, 'aba renomeada para "Parando"');
assert.match(app, /['"]reaquecer['"],\s*['"]Reativar['"]/, 'aba renomeada para "Reativar"');
assert.match(app, /<span>Agora<\/span>/, 'KPI renomeado para "Agora"');
assert.match(app, /<span>Reativar<\/span>/, 'KPI renomeado para "Reativar"');

console.log('v860-sem-termometro: ok');
