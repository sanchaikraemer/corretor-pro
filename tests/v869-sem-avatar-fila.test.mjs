import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

// v869: o dono não quer os "cards" com iniciais (avatares) nas linhas de "Próximos
// atendimentos". Os dois renderizadores de fila (filaRowHTML e a lista de grupo) não
// desenham mais o avatar.

assert.doesNotMatch(app, /\$\{avatarLead\(l, ""\)\}/, 'a fila não pode mais desenhar avatarLead');
assert.doesNotMatch(app, /\$\{avatarInicial\(l\.name, ""\)\}/, 'a lista de grupo não pode mais desenhar avatarInicial');

// A linha da fila continua existindo (rank + info), só sem o avatar.
assert.match(app, /class="fila-row[^`]*fila-rank[^`]*fila-info/, 'a linha da fila (rank + info) precisa continuar');

console.log('v869-sem-avatar-fila: ok');
