import assert from 'node:assert/strict';
import {
  aplicarCorrecoesDeterministicasCerebro,
  compilarRegrasObjetivasCerebro,
  validarMensagensCerebro
} from '../api/_pipeline.js';

const cerebro = {
  metodo: 'Gere mensagens objetivas, com no máximo 220 caracteres.',
  regras: [
    { texto: 'Não use oi ou olá. Use bom dia, boa tarde ou boa noite conforme o horário brasileiro.' },
    { texto: 'Não use "faz sentido" nas mensagens.' }
  ]
};
const manha = new Date('2026-07-14T12:00:00.000Z'); // 09h em São Paulo
const regras = compilarRegrasObjetivasCerebro(cerebro, manha);
assert.equal(regras.saudacaoObrigatoria, true);
assert.equal(regras.saudacaoEsperada, 'Bom dia');
assert.ok(regras.proibidas.some(x => /faz sentido/i.test(x)));

const corrigidas = aplicarCorrecoesDeterministicasCerebro({
  a: 'Oi Vera, o Renaissance chamou sua atenção por qual ponto?',
  b: 'Olá Vera, você quer comparar as plantas do Renaissance?',
  c: 'Vera, qual detalhe do Renaissance pesa mais na sua decisão?'
}, cerebro, manha);
assert.match(corrigidas.a, /^Bom dia, Vera,/);
assert.match(corrigidas.b, /^Bom dia, Vera,/);
assert.match(corrigidas.c, /^Bom dia, vera,/i);
assert.doesNotMatch(Object.values(corrigidas).join(' '), /\b(?:oi|olá)\b/i);

const timeline = [
  { author:'Construtora Senger', date:'14/07/2026', time:'08:30', text:'Qual faixa de valor você busca?' },
  { author:'Vera', date:'14/07/2026', time:'08:35', text:'Até R$ 700 mil e quero duas suítes.' }
];
const repetida = validarMensagensCerebro({
  a:'Bom dia, Vera, qual faixa de valor você busca?',
  b:'Bom dia, Vera, qual detalhe das duas suítes é mais importante para você?',
  c:'Bom dia, Vera, você prefere comparar plantas ou localização primeiro?'
}, null, timeline, cerebro, manha);
assert.equal(repetida.ok, false);
assert.ok(repetida.motivos.some(x => /já respondida/i.test(x)));

const inventada = validarMensagensCerebro({
  a:'Bom dia, Vera, você conseguiria dar R$ 100 mil de entrada?',
  b:'Bom dia, Vera, qual detalhe das duas suítes é mais importante para você?',
  c:'Bom dia, Vera, você prefere comparar plantas ou localização primeiro?'
}, null, timeline, cerebro, manha);
assert.equal(inventada.ok, false);
assert.ok(inventada.motivos.some(x => /dado numérico ausente/i.test(x)));

const proibida = validarMensagensCerebro({
  a:'Bom dia, Vera, faz sentido comparar as duas plantas agora?',
  b:'Bom dia, Vera, qual detalhe das duas suítes é mais importante para você?',
  c:'Bom dia, Vera, você prefere comparar plantas ou localização primeiro?'
}, null, timeline, cerebro, manha);
assert.equal(proibida.ok, false);
assert.ok(proibida.motivos.some(x => /expressão proibida/i.test(x)));

const incompleta = validarMensagensCerebro({ a:'Bom dia, Vera, qual planta você prefere?', b:'', c:'' }, null, timeline, cerebro, manha);
assert.equal(incompleta.ok, false);
assert.ok(incompleta.motivos.some(x => /exatamente três/i.test(x)));

console.log('v825-cerebro-obrigatorio: ok');
