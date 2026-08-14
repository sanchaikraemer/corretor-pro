import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1280 — print do dono (14/08/2026), lead Dona Venivia (conversa de junho/24 até agosto/26: ela
// pediu informação de vários empreendimentos e recusou todos; o último foi "querido, não muito luxo
// e grande obgd").
//
// As três sugestões saíram fazendo o balanço das recusas, cada uma do seu jeito:
//   1. "Das opções que você já recebeu, nenhuma encaixou no que procura."
//   2. "Notei que as últimas sugestões não agradaram, talvez porque o perfil delas era diferente
//       do que busca."
//   3. "Para avançar e te mostrar só o que vale a pena..."
// Ou seja: a primeira linha — a única que aparece na notificação do WhatsApp — é um resumo de
// fracasso, e ainda convida a cliente a concordar que nada serve.
//
// O histórico de recusa é dado INTERNO (mesma lógica do tempo parado, v1255): serve pra escolher o
// que oferecer, não pra ser dito de volta. O que volta pra ela é o CRITÉRIO que a recusa revelou,
// com as palavras dela ("algo mais prático, sem tanto luxo").

const src = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

const ini = src.indexOf('O HISTÓRICO DE RECUSA NÃO VOLTA PRA CLIENTE');
assert.ok(ini > -1, 'a regra do histórico de recusa precisa existir no pedido enviado à IA');
const bloco = src.slice(ini, ini + 2200).replace(/\s+/g, ' ');

// ── 1. As frases exatas do print estão nomeadas como proibidas ───────────────────────────────
for (const frase of [
  'nenhuma das opções encaixou no que você procura',
  'as últimas sugestões não agradaram',
  'o perfil delas era diferente do que você busca'
]) {
  assert.ok(bloco.includes(`"${frase}"`), `o balanço de recusa "${frase}" precisa estar proibido`);
}

// ── 2. A frase que se coloca acima do cliente cai junto ──────────────────────────────────────
assert.ok(bloco.includes('pra te mostrar só o que vale a pena'),
  '"só o que vale a pena" diz nas entrelinhas que até aqui foi perda de tempo — precisa estar citada');

// ── 3. A regra diz o que ENTRA no lugar, não só o que sai ────────────────────────────────────
assert.ok(bloco.includes('dado INTERNO'),
  'o histórico de recusa precisa estar classificado como dado interno, igual ao tempo parado');
assert.ok(bloco.includes('CRITÉRIO que a recusa revelou'),
  'a recusa precisa virar critério positivo, senão a IA só perde a informação');
assert.ok(bloco.includes('com as palavras dele'),
  'o critério volta com as palavras do próprio cliente');

// ── 4. Vale pra todo corretor, não só pro modo prévia (erro da v1240) ────────────────────────
const fimCerebro = src.indexOf('=== FIM DO CÉREBRO COMERCIAL ===');
assert.ok(fimCerebro > -1 && ini > fimCerebro,
  'a regra precisa estar no trecho comum do pedido, fora do bloco de modo prévia');

// ── 5. Sem cirurgia no texto pronto (v1247) ──────────────────────────────────────────────────
assert.ok(!/limparFrasesProibidas|melhorLimpa/.test(src),
  'o corte determinístico de frase proibida foi removido na v1247 e não pode voltar');

console.log('v1280-recusa-antiga-nao-volta-pro-cliente: ok');
