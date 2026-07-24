import fs from 'node:fs';
import assert from 'node:assert/strict';

// v961 — revisão de api/diagnostico.js. modoOpenAI() (mode=openai) roda 2 testes quando a chave
// está configurada: "models.list" (só prova que a CHAVE é válida) e "análise e mensagens" (chama
// EXATAMENTE como o pipeline real, com o analysisModel — o próprio comentário do código já
// explica que esse teste existe pra não esconder "o erro de verdade"). O bug: `analiseFunciona`
// (e o status HTTP 200/500 da resposta) vinha de `testes.some(t => t.ok)` — "algum teste
// passou". Se só o models.list passasse (chave válida, mas o modelo de análise específico sem
// acesso/quota), o diagnóstico dizia analiseFunciona:true e devolvia 200, escondendo que a
// análise de verdade estava quebrada — o EXATO problema que o comentário do código diz ter sido
// corrigido antes, só que reintroduzido de outro jeito.

const src = fs.readFileSync(new URL('../api/diagnostico.js', import.meta.url), 'utf8');
const modoOpenAISrc = src.match(/async function modoOpenAI\(res\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(modoOpenAISrc, 'achei a função modoOpenAI em api/diagnostico.js');

// 1. analiseFunciona não pode mais vir de "algum teste passou" (.some / algumaIaOk).
assert.doesNotMatch(modoOpenAISrc, /algumaIaOk/, 'variável algumaIaOk não deve mais existir — era a raiz do bug');
assert.doesNotMatch(
  modoOpenAISrc.match(/analiseFunciona\s*[:=][^,\n]*/)?.[0] || '',
  /\.some\(/,
  'analiseFunciona não pode ser derivado de testes.some(...) — precisa ser o teste específico de análise'
);

// 2. analiseFunciona precisa vir do resultado do teste de análise (não de um agregado "algum
// passou"): mesma variável usada no cálculo de analiseFunciona e no status HTTP.
const linhaAnalise = modoOpenAISrc.split('\n').find(l => /const analiseFunciona\s*=/.test(l));
assert.ok(linhaAnalise, 'achei a linha que define analiseFunciona');
assert.match(linhaAnalise, /testeAnalise\.ok/, 'analiseFunciona deve vir de testeAnalise.ok (o teste que chama igual ao pipeline real)');

const linhaStatus = modoOpenAISrc.split('\n').find(l => /return json\(res,/.test(l));
assert.ok(linhaStatus, 'achei a linha do status HTTP da resposta');
assert.match(linhaStatus, /analiseFunciona \? 200 : 500/, 'o status HTTP também deve seguir analiseFunciona, não um agregado "algum teste passou"');

console.log('v961-diagnostico-analise-funciona: ok');
