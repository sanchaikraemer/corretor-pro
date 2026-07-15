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

// Regressão da tela do "Rudi" (21:16, sem saudação): a regra de saudação por horário
// precisa ser reconhecida também na forma POSITIVA, não só na proibitiva "não use oi/olá".
const noite = new Date('2026-07-15T00:16:00.000Z'); // 21:16 em São Paulo (UTC-3)
for (const cfgPositivo of [
  { metodo: 'Sempre comece a mensagem com bom dia, boa tarde ou boa noite conforme o horário.' },
  { tom: 'Use uma saudação conforme o horário: bom dia, boa tarde ou boa noite.' },
  { regras: [{ texto: 'Iniciar sempre com bom dia, boa tarde ou boa noite.' }] }
]) {
  const r = compilarRegrasObjetivasCerebro(cfgPositivo, noite);
  assert.equal(r.saudacaoObrigatoria, true, 'a forma positiva da regra de saudação deve ser reconhecida');
  assert.equal(r.saudacaoEsperada, 'Boa noite', 'às 21:16 a saudação é Boa noite');
}
// Menção solta a "boa noite" (sem virar regra) não pode disparar a exigência.
assert.equal(compilarRegrasObjetivasCerebro({ diferenciais: 'O cliente disse boa noite ontem.' }, noite).saudacaoObrigatoria, false);
// Com a regra positiva, as mensagens do Rudi recebem a saudação do horário.
const cfgRudi = { metodo: 'Continue a conversa. Sempre comece com bom dia, boa tarde ou boa noite conforme o horário.' };
const rudi = aplicarCorrecoesDeterministicasCerebro({
  a: 'Rudi, conseguiu acessar a apresentação do Renaissance pelo link que enviei?',
  b: 'Rudi, teve a oportunidade de ver algum diferencial que gostaria de entender melhor?',
  c: 'Rudi, existe algum detalhe que gostaria de esclarecer ou prefere agendar uma visita?'
}, cfgRudi, noite);
assert.match(rudi.a, /^Boa noite, Rudi,/);
assert.match(rudi.b, /^Boa noite, Rudi,/);
assert.match(rudi.c, /^Boa noite, Rudi,/);

// Regra do usuário real, tudo numa frase só: 'Não use "oi" ... use: bom dia, boa
// tarde ou boa noite'. O parser NÃO pode marcar as saudações permitidas como
// proibidas — senão o sistema rejeita a própria saudação que acabou de aplicar.
const cfgFraseUnica = { metodo: 'Continue a conversa. Não use "oi" nas sugestões de resposta- use: bom dia, boa tarde ou boa noite, conforme horário da analise.' };
const regrasFraseUnica = compilarRegrasObjetivasCerebro(cfgFraseUnica, noite);
assert.equal(regrasFraseUnica.saudacaoObrigatoria, true);
assert.ok(regrasFraseUnica.proibidas.some(p => /^oi$/i.test(p)), 'oi continua proibido');
assert.ok(!regrasFraseUnica.proibidas.some(p => /boa\s+tarde|boa\s+noite|bom\s+dia/i.test(p)), 'as saudações permitidas nunca podem ser proibidas');
const rudiFraseUnica = aplicarCorrecoesDeterministicasCerebro({
  a: 'Rudi, conseguiu acessar a apresentação do Renaissance pelo link que enviei?',
  b: 'Rudi, teve a oportunidade de ver algum diferencial que gostaria de entender melhor?',
  c: 'Rudi, existe algum detalhe que gostaria de esclarecer ou prefere agendar uma visita?'
}, cfgFraseUnica, noite);
const valFraseUnica = validarMensagensCerebro(rudiFraseUnica, null, [
  { author: 'Construtora Senger', text: 'te enviei a apresentação do Renaissance pelo link' },
  { author: 'Rudi', text: 'obrigado, vou ver' }
], cfgFraseUnica, noite);
assert.equal(valFraseUnica.ok, true, 'a saudação aplicada não pode ser rejeitada como expressão proibida');
// "Oi" ainda é corrigido de verdade.
const corrigeOi = aplicarCorrecoesDeterministicasCerebro({ a: 'Oi Rudi, tudo bem por aí hoje?', b: rudiFraseUnica.b, c: rudiFraseUnica.c }, cfgFraseUnica, noite);
assert.match(corrigeOi.a, /^Boa noite, Rudi,/);

console.log('v825-cerebro-obrigatorio: ok');
