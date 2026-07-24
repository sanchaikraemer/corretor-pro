import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v973 — pedido do dono: a barra de mensagens (cpBarraMensagensMini) deixa de ser cor chapada e
// vira gradiente. Os 3 limiares/cores de nível (n>=15/n>=5/senão) são decisão travada pelos
// testes v942/v943 e continuam EXATAMENTE os mesmos — só ganham uma segunda parada (tom mais
// claro do mesmo nível) pro gradiente.

const barFn = app.match(/function cpBarraMensagensMini\(l, ?maxMsgs\)\{[\s\S]*?\n\}/);
assert.ok(barFn, 'cpBarraMensagensMini não encontrada');
const barSrc = barFn[0];

// 1. Limiares/cores de nível continuam intocados (trava v942/v943 — não pode regredir).
assert.match(barSrc, /n >= 15 \? '#ff6258' : n >= 5 \? '#ff8f88' : '#8a99a0'/, 'limiares de cor de nível continuam intocados');
assert.match(barSrc, /n \/ teto \* 100/, 'proporção da barra continua intocada');

// 2. A barra agora pinta com linear-gradient (não mais cor chapada única).
assert.match(barSrc, /background:linear-gradient\(90deg,\$\{cor\} 40%,\$\{corClara\}\)/, 'a barra usa gradiente, não cor chapada');

// 3. Comportamento real: o HTML final tem um gradiente de 2 cores por nível, e a largura/número
// continuam corretos (mesmo teste de proporção do v943, só confirmando que não quebrou).
const cpBarraMensagensMini = eval(`
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  ${barSrc}
  cpBarraMensagensMini;
`);
const alta = cpBarraMensagensMini({ __msgs: 20 }, 20);
assert.match(alta, /linear-gradient\(90deg,#ff6258 40%,#ffb3ac\)/, 'nível alto (>=15 msgs) usa o gradiente coral cheio → coral claro');
assert.match(alta, /width:100%/, 'largura continua 100% pro maior da lista (trava v943)');

const media = cpBarraMensagensMini({ __msgs: 8 }, 20);
assert.match(media, /linear-gradient\(90deg,#ff8f88 40%,#ffd0cc\)/, 'nível médio (5-14 msgs) usa o gradiente coral médio → tom claro');

const baixa = cpBarraMensagensMini({ __msgs: 2 }, 20);
assert.match(baixa, /linear-gradient\(90deg,#8a99a0 40%,#c7ced2\)/, 'nível baixo (<5 msgs) usa o gradiente cinza → cinza claro');

console.log('v973-barra-gradiente: ok');
