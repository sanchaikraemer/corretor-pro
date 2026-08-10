import fs from 'node:fs';
import assert from 'node:assert/strict';

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v865: as 3 sugestões de mensagem vinham "muito parecidas" (a mesma ideia reescrita 3x),
// porque o prompt só pedia recomendada/maisSuave/maisDireta sem dizer que precisam ser
// ESTRATÉGIAS diferentes. Este guard trava a instrução de diferenciação no prompt.
//
// v1205 ajustou a REDAÇÃO (não a intenção): a exigência deixou de ser "três próximos passos
// diferentes SEMPRE" — que brigava com a regra do Cérebro Comercial de que as três podem
// convergir quando só existe um passo adequado — e passou a ser "três ângulos comerciais
// diferentes", com a convergência liberada só nessa exceção. Continuar proibindo a mesma ideia
// reescrita 3x segue sendo o objetivo deste teste; ver v1205-tres-mensagens-podem-convergir.

assert.match(pipeline, /ÂNGULOS COMERCIAIS DIFERENTES/, 'o prompt precisa exigir três ângulos comerciais diferentes');
assert.match(pipeline, /NÃO a mesma ideia reescrita/, 'o prompt precisa proibir reescrever a mesma ideia');
// Cada variante precisa ter um papel distinto descrito no prompt.
assert.match(pipeline, /"recomendada":\s*a melhor jogada/, 'papel da "recomendada" precisa estar descrito');
assert.match(pipeline, /"maisSuave":\s*ângulo consultivo/, 'papel da "maisSuave" (consultiva) precisa estar descrito');
assert.match(pipeline, /"maisDireta":\s*a mais objetiva das três/, 'papel da "maisDireta" precisa estar descrito');
assert.match(pipeline, /Em vez de empurrar o mesmo passo/, 'a suave precisa abrir um caminho diferente da recomendada');
assert.match(pipeline, /O padrão é que os próximos passos também sejam diferentes/, 'próximos passos diferentes continuam sendo o padrão');
assert.match(pipeline, /se as três repetirem a MESMA[\s\S]*reescreva/, 'precisa mandar reescrever se as três repetirem a mesma pergunta de sempre');

console.log('v865-mensagens-distintas: ok');
