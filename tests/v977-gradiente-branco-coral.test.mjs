import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v977 — o dono pediu pra comparar 3 cores pro gradiente da barra (foram enviadas como imagem):
// a coral→coral-claro que já estava no ar (v973), azul-claro→coral, e branco→coral. Escolheu
// branco→coral ("b"). Branco é fixo (#F7FAFB, mesmo tom do texto do app) — não varia por nível,
// diferente do "corClara" da v973 (removido). Os limiares/cores de nível (cor) continuam os
// mesmos de sempre, travados pelos testes v942/v943.

const barFn = app.match(/function cpBarraMensagensMini\(l, ?maxMsgs\)\{[\s\S]*?\n\}/);
assert.ok(barFn, 'cpBarraMensagensMini não encontrada');
const barSrc = barFn[0];

// 1. Limiares/cores de nível continuam intocados.
assert.match(barSrc, /n >= 15 \? '#ff6258' : n >= 5 \? '#ff8f88' : '#8a99a0'/, 'limiares de cor de nível continuam intocados (trava v942/v943)');
assert.match(barSrc, /n \/ teto \* 100/, 'proporção da barra continua intocada');

// 2. corClara (tom mais claro por nível, v973) foi removido — o início do gradiente agora é um
// branco FIXO, não varia por nível.
assert.doesNotMatch(barSrc, /const corClara/, 'a variável corClara (fórmula antiga, tom mais claro por nível) foi removida');
assert.match(barSrc, /background:linear-gradient\(90deg,\$\{BRANCO_GRADIENTE\},\$\{cor\}\)/, 'gradiente vai de um branco fixo até a cor do nível');
assert.match(barSrc, /BRANCO_GRADIENTE\s*=\s*'#F7FAFB'/, 'o branco usado é o mesmo tom do texto do app (--text/#F7FAFB), não um branco puro inventado');

// 3. Comportamento real: os 3 níveis usam o MESMO branco no início e a cor de sempre no fim.
const cpBarraMensagensMini = eval(`
  const mensagensDoCliente = (l) => Number(l.__msgs||0);
  ${barSrc}
  cpBarraMensagensMini;
`);
const alta = cpBarraMensagensMini({ __msgs: 20 }, 20);
assert.match(alta, /linear-gradient\(90deg,#F7FAFB,#ff6258\)/, 'nível alto (>=15 msgs): branco → coral cheio');
assert.match(alta, /width:100%/, 'largura continua 100% pro maior da lista (trava v943)');

const media = cpBarraMensagensMini({ __msgs: 8 }, 20);
assert.match(media, /linear-gradient\(90deg,#F7FAFB,#ff8f88\)/, 'nível médio (5-14 msgs): branco → coral médio');

const baixa = cpBarraMensagensMini({ __msgs: 2 }, 20);
assert.match(baixa, /linear-gradient\(90deg,#F7FAFB,#8a99a0\)/, 'nível baixo (<5 msgs): branco → cinza');

console.log('v977-gradiente-branco-coral: ok');
