import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v861: a fila do "Hoje" passou a MISTURAR chance de venda + urgência (pedido do dono).
// Antes a urgência mandava sozinha (degraus de 1000 entre níveis) e a chance de venda era
// só um tempero limitado a ±24 — irrelevante. Este teste trava a regressão.

const ini = app.indexOf('function scoreRankingHoje(l){');
assert.ok(ini > 0, 'scoreRankingHoje precisa existir');
const bloco = app.slice(ini, ini + 900);

// O tempero antigo de ±24 não pode voltar.
assert.doesNotMatch(bloco, /Math\.max\(-18, Math\.min\(24, conversao \* 0\.12\)\)/, 'o tempero de ±24 não pode voltar');

// A mistura precisa existir com pesos ajustáveis e usar a chance de venda de verdade.
assert.match(app, /const RANKING_PESO_VENDA = (\d+)/, 'peso da venda deve ser uma constante ajustável');
assert.match(app, /const RANKING_BANDA_URGENCIA = (\d+)/, 'banda de urgência deve ser uma constante ajustável');
assert.match(bloco, /scoreConversaoHoje\(l\)/, 'o ranking deve consultar a chance de venda');
assert.match(bloco, /RANKING_PESO_VENDA/, 'o ranking deve aplicar o peso da venda');
assert.match(bloco, /scorePrioridadeAtendimento\(l\)/, 'o ranking deve continuar considerando a urgência');

// A chance de venda precisa ter PESO REAL e a urgência precisa estar COMPRIMIDA
// (não mais o degrau de 1000), senão a mistura vira só tempero de novo.
const peso = Number(app.match(/const RANKING_PESO_VENDA = (\d+)/)[1]);
const banda = Number(app.match(/const RANKING_BANDA_URGENCIA = (\d+)/)[1]);
assert.ok(peso >= 8, 'a chance de venda precisa de peso real (>= 8)');
assert.ok(banda <= 300, 'a urgência precisa estar comprimida (banda <= 300, era 1000)');

console.log('v861-fila-mistura-venda: ok');
