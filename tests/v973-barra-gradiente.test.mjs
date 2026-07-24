import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v973 — pedido do dono: a barra de mensagens (cpBarraMensagensMini) deixa de ser cor chapada e
// vira gradiente. Os 3 limiares/cores de nível (n>=15/n>=5/senão) são decisão travada pelos
// testes v942/v943 e continuam EXATAMENTE os mesmos.
// A FÓRMULA do gradiente em si (cor→corClara, tom mais claro do mesmo nível) foi SUPERADA na
// v977: o dono comparou 3 opções de cor e escolheu branco→cor — ver
// tests/v977-gradiente-branco-coral.test.mjs pra fórmula atual. Os itens 2/3 abaixo, que
// checavam a fórmula antiga, foram atualizados/removidos.

const barFn = app.match(/function cpBarraMensagensMini\(l, ?maxMsgs\)\{[\s\S]*?\n\}/);
assert.ok(barFn, 'cpBarraMensagensMini não encontrada');
const barSrc = barFn[0];

// 1. Limiares/cores de nível continuam intocados (trava v942/v943 — não pode regredir).
assert.match(barSrc, /n >= 15 \? '#ff6258' : n >= 5 \? '#ff8f88' : '#8a99a0'/, 'limiares de cor de nível continuam intocados');
assert.match(barSrc, /n \/ teto \* 100/, 'proporção da barra continua intocada');

// 2. A barra pinta com linear-gradient (não mais cor chapada única) — a fórmula exata mudou na
// v977 (ver aquele teste); aqui só confirma que a largura/proporção continuam corretas.
assert.match(barSrc, /background:linear-gradient\(90deg,/, 'a barra usa gradiente, não cor chapada');

const cpBarraMensagensMini = eval(`
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  ${barSrc}
  cpBarraMensagensMini;
`);
const alta = cpBarraMensagensMini({ __msgs: 20 }, 20);
assert.match(alta, /width:100%/, 'largura continua 100% pro maior da lista (trava v943)');

console.log('v973-barra-gradiente: ok');
