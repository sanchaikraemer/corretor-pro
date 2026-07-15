import assert from 'node:assert/strict';
import { validarMensagensCerebro } from '../api/_pipeline.js';

// §v827-14: a validação do Cérebro comparava valor numérico por SUBSTRING literal
// contra a conversa. Isso rejeitava qualquer mensagem da IA que reformatasse um valor
// real já dito (ex.: conversa tem "R$ 1.080.000,00" e a IA escreve "R$ 1,08 milhão" —
// mesmo valor, formatação diferente), derrubando quase toda mensagem boa e fazendo o
// fallback genérico virar a regra em vez da exceção.

const tl = [
  { author: 'Rudi', date: '10/07/2026', time: '10:00', text: 'Qual o valor do apartamento de 3 quartos?' },
  { author: 'Corretor', date: '10/07/2026', time: '10:05', text: 'Esse fica R$ 1.080.000,00, Rudi.' },
  { author: 'Rudi', date: '10/07/2026', time: '10:10', text: 'Ok, obrigado.' }
];
const trio = extra => ({
  a: extra,
  b: 'Boa noite, Rudi, posso te apresentar outras opções nessa faixa?',
  c: 'Boa noite, Rudi, prefere seguir com esse valor ou ver outra opção?'
});

// Reformatação do MESMO valor (milhão) não pode ser tratada como dado inventado.
const reformatado = validarMensagensCerebro(
  trio('Boa noite, Rudi, essa faixa de R$ 1,08 milhão fica dentro do que você buscava?'),
  null, tl, {}, new Date('2026-07-15T21:00:00Z')
);
assert.ok(!reformatado.motivos.some(m => /introduz dado num/.test(m)), `reformatação do mesmo valor não pode ser bloqueada: ${JSON.stringify(reformatado.motivos)}`);

// Reformatação sem "R$", com "mil" em vez de milhão por extenso — mesmo valor.
const semRS = validarMensagensCerebro(
  trio('Boa noite, Rudi, 1080 mil fica dentro do que você buscava?'),
  null, tl, {}, new Date('2026-07-15T21:00:00Z')
);
assert.ok(!semRS.motivos.some(m => /introduz dado num/.test(m)), `variação sem R$ do mesmo valor não pode ser bloqueada: ${JSON.stringify(semRS.motivos)}`);

// Um valor DE FATO diferente (não presente na conversa) continua bloqueado.
const inventado = validarMensagensCerebro(
  trio('Boa noite, Rudi, consigo por R$ 450.000, fechamos assim?'),
  null, tl, {}, new Date('2026-07-15T21:00:00Z')
);
assert.ok(inventado.motivos.some(m => /introduz dado num/.test(m)), 'valor realmente diferente do dito na conversa continua bloqueado');

// Percentual com pequena variação de arredondamento (ex.: conversa fala "5%", mensagem "5,0%").
const tlPct = [
  { author: 'Corretor', date: '10/07/2026', time: '10:00', text: 'O desconto à vista é de 5%.' },
  { author: 'Rudi', date: '10/07/2026', time: '10:05', text: 'Entendi.' }
];
const pctOk = validarMensagensCerebro(
  { a: 'Boa noite, Rudi, o desconto de 5,0% à vista ainda te interessa?', b: 'Boa noite, Rudi, quer que eu detalhe outra condição?', c: 'Boa noite, Rudi, seguimos com essa condição?' },
  null, tlPct, {}, new Date('2026-07-15T21:00:00Z')
);
assert.ok(!pctOk.motivos.some(m => /introduz dado num/.test(m)), `percentual arredondado não pode ser bloqueado: ${JSON.stringify(pctOk.motivos)}`);

console.log('v827-14-valor-tolerante: ok');
