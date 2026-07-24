import fs from 'node:fs';
import assert from 'node:assert/strict';

// v971 — dono reportou que "Análises feitas" no Desempenho fica muito abaixo do real. Causa
// confirmada: cpRegistrarAtividade("analise") só era chamada no botão de reanalisar 1 lead por
// vez (ui670Reanalisar) — o fluxo "Reanalisar todos" (executarReanaliseTudo → tentar, que
// processa TODOS os leads ativos em paralelo) nunca contava nada, mesmo cada lead reanalisado
// com sucesso ali sendo uma análise de verdade, processada pela IA, igual à individual.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// A função "tentar" (dentro de executarReanaliseTudo) precisa registrar atividade só no
// caminho de SUCESSO (data?.ok), não nos de erro/retry.
const tentarSrc = app.match(/async function tentar\(l\)\{[\s\S]*?\n    \}catch\(_\)\{ return \{ ok: false, motivo: "Falha de conexão" \}; \}\n  \}/);
assert.ok(tentarSrc, 'não achei a função tentar() dentro de executarReanaliseTudo');

const corpo = tentarSrc[0];
assert.match(corpo, /if\(data\?\.ok\)\{[\s\S]*?cpRegistrarAtividade\("analise"\)[\s\S]*?return \{ ok: true \};/,
  'tentar() precisa chamar cpRegistrarAtividade("analise") no caminho de sucesso, antes de devolver ok:true');

// Não pode contar em caminho de erro (senão infla o número com falhas).
const trechoErro = corpo.slice(corpo.indexOf('const motivo ='));
assert.doesNotMatch(trechoErro, /cpRegistrarAtividade/, 'não pode registrar atividade no caminho de erro/falha');

console.log('v971-reanalisar-tudo-conta-analise: ok');
