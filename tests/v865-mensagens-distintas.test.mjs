import fs from 'node:fs';
import assert from 'node:assert/strict';

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

// v865: as 3 sugestões de mensagem vinham "muito parecidas" (a mesma ideia reescrita 3x),
// porque o prompt só pedia recomendada/maisSuave/maisDireta sem dizer que precisam ser
// ESTRATÉGIAS diferentes. Este guard trava a instrução de diferenciação no prompt.
//
// v1206 ajustou a REDAÇÃO (não a intenção): a exigência deixou de ser "três próximos passos
// diferentes SEMPRE" — que brigava com a regra do Cérebro Comercial de que as três podem
// convergir quando só existe um passo adequado — e passou a ser "três ângulos comerciais
// diferentes", com a convergência liberada só nessa exceção. Continuar proibindo a mesma ideia
// reescrita 3x segue sendo o objetivo deste teste; ver v1206-tres-mensagens-podem-convergir.

// v1291 — o dono reescreveu o pedido. A exigência dos três ângulos virou uma lista curta com o
// papel de cada mensagem, e a proibição de repetir a mesma ideia virou "sem inventar diferenças
// artificiais". O objetivo do teste continua o mesmo: as três não podem ser a mesma mensagem
// reescrita, e cada uma tem um papel escrito.
assert.match(pipeline, /podendo ter ângulos diferentes sem\s*\n?inventar diferenças artificiais/, 'o prompt precisa exigir três ângulos comerciais diferentes');
assert.match(pipeline, /As três nascem da mesma verdade factual e da mesma leitura comercial/, 'o prompt precisa proibir reescrever a mesma ideia');
// Cada variante precisa ter um papel distinto descrito no prompt.
assert.match(pipeline, /RECOMENDADA é a que você enviaria se só pudesse enviar uma/, 'papel da "recomendada" precisa estar descrito');
assert.match(pipeline, /MAIS SUAVE explora\/resolve o ponto mais importante com menor pressão/, 'papel da "maisSuave" (consultiva) precisa estar descrito');
assert.match(pipeline, /MAIS DIRETA é objetiva/, 'papel da "maisDireta" precisa estar descrito');
// v1297 — a descrição ganhou o rabicho "com um passo concreto dentro dela": suave não pode virar
// sinônimo de mensagem que não faz nada (print do dono de 18/08/2026, 17h18).
assert.match(pipeline, /"maisSuave":"abordagem consultiva coerente com o mesmo diagnóstico/, 'a suave precisa abrir um caminho diferente da recomendada');
// v1291 — a ordem de "reescrever quando as três repetirem a mesma pergunta" saiu na reescrita do
// dono. No lugar dela ficaram duas linhas: não repetir pergunta já respondida e não transformar
// falta de dado em interrogatório, que é o defeito que aquela ordem tentava impedir.
assert.match(pipeline, /Não repita pergunta já respondida nem transforme falta de dado em interrogatório/, 'próximos passos diferentes continuam sendo o padrão');
assert.match(pipeline, /Não repita automaticamente uma tentativa ignorada/, 'precisa mandar reescrever se as três repetirem a mesma pergunta de sempre');

console.log('v865-mensagens-distintas: ok');
