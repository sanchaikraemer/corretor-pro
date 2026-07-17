import fs from 'node:fs';
import assert from 'node:assert/strict';

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v865: as 3 sugestões de mensagem vinham "muito parecidas" (a mesma ideia reescrita 3x),
// porque o prompt só pedia recomendada/maisSuave/maisDireta sem dizer que precisam ser
// ESTRATÉGIAS diferentes. Este guard trava a instrução de diferenciação no prompt.

assert.match(pipeline, /TRÊS CAMINHOS DIFERENTES/, 'o prompt precisa exigir três caminhos diferentes');
assert.match(pipeline, /NÃO a mesma ideia reescrita/, 'o prompt precisa proibir reescrever a mesma ideia');
// Cada variante precisa ter um papel distinto descrito no prompt.
assert.match(pipeline, /"recomendada":\s*a melhor jogada/, 'papel da "recomendada" precisa estar descrito');
assert.match(pipeline, /"maisSuave":\s*ângulo consultivo/, 'papel da "maisSuave" (consultiva) precisa estar descrito');
assert.match(pipeline, /"maisDireta":\s*objetiva/, 'papel da "maisDireta" precisa estar descrito');
assert.match(pipeline, /abrir uma porta DIFERENTE da recomendada/, 'a suave precisa abrir uma porta diferente da recomendada');
assert.match(pipeline, /propondo a MESMA ação[\s\S]*reescreva/, 'precisa mandar reescrever se as três propuserem a mesma ação');

console.log('v865-mensagens-distintas: ok');
