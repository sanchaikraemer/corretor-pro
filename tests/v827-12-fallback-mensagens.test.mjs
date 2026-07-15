import assert from 'node:assert/strict';
import {
  validarMensagensCerebro,
  construirMensagensDeterministicasCerebro,
  compilarRegrasObjetivasCerebro
} from '../api/_pipeline.js';

const noite = new Date('2026-07-15T21:16:00Z'); // ~18h em America/Sao_Paulo -> Boa noite

const tl = [
  { author: 'Rudi Maciel', date: '10/07/2026', time: '10:00', text: 'Oi, gostaria de saber mais sobre o Renaissance.' },
  { author: 'Corretor', date: '10/07/2026', time: '10:05', text: 'Claro! Vou te passar os detalhes do Renaissance.' },
  { author: 'Rudi Maciel', date: '10/07/2026', time: '10:10', text: 'Prefiro pronto ou na planta, ainda não decidi.' }
];

// §v827-12: mesmo quando as mensagens da IA continuam inválidas após as tentativas de
// correção (aqui simuladas por um trio degenerado), o fallback determinístico precisa
// gerar 3 mensagens que passem na MESMA validação do Cérebro — para a análise nunca ser
// descartada por causa só das sugestões de mensagem.
const cerebro = { regras: [{ texto: 'Não use "oi" ou "olá" — use: bom dia, boa tarde ou boa noite.' }] };
const regras = compilarRegrasObjetivasCerebro(cerebro, noite);

const fallback = construirMensagensDeterministicasCerebro({
  contextoTemporal: { modo: 'continuidade', dias: 1, limiar: 7, ultimaData: '10/07/2026' },
  timeline: tl,
  diagnostico: { proximoPasso: 'confirmar se prefere pronto ou na planta' },
  produtoAtual: 'Renaissance',
  regras,
  agora: noite
});

assert.ok(fallback.a && fallback.b && fallback.c, 'fallback deve gerar as três mensagens');
assert.notEqual(fallback.a, fallback.b);
assert.notEqual(fallback.b, fallback.c);

const validacao = validarMensagensCerebro(fallback, { modo: 'continuidade', dias: 1, limiar: 7 }, tl, cerebro, noite);
assert.equal(validacao.ok, true, `fallback deveria passar na validação do Cérebro: ${JSON.stringify(validacao.motivos)}`);

// Cada mensagem termina com exatamente uma pergunta.
for (const chave of ['a', 'b', 'c']) {
  const msg = fallback[chave];
  assert.equal((msg.match(/\?/g) || []).length, 1, `${chave} deve ter exatamente uma pergunta`);
  assert.match(msg, /\?$/, `${chave} deve terminar com a pergunta`);
  assert.match(msg, /^Boa noite\b/i, `${chave} deve usar a saudação obrigatória do Cérebro`);
  assert.doesNotMatch(msg.toLowerCase(), /^oi\b|^ol[aá]\b/, `${chave} não pode usar saudação proibida`);
}

// Modo retomada: o fallback precisa citar um fato real da conversa (âncora), não algo genérico.
const retomada = construirMensagensDeterministicasCerebro({
  contextoTemporal: { modo: 'retomada', dias: 30, limiar: 7, ultimaData: '10/06/2026' },
  timeline: tl,
  diagnostico: {},
  produtoAtual: 'Não identificado',
  regras: compilarRegrasObjetivasCerebro({}, noite),
  agora: noite
});
const validacaoRetomada = validarMensagensCerebro(retomada, { modo: 'retomada', dias: 30, limiar: 7 }, tl, {}, noite);
assert.equal(validacaoRetomada.ok, true, `fallback de retomada deveria passar: ${JSON.stringify(validacaoRetomada.motivos)}`);

console.log('v827-12-fallback-mensagens: ok');
