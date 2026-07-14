import assert from 'node:assert/strict';
import { _nomesMesmoLead } from '../api/_persistence.js';

// "Mesmo nome, mesmo lead": o caso Neto e variações precisam ser reconhecidos como o mesmo
// cliente na reimportação, sem fundir pessoas diferentes que só dividem o primeiro nome.

// Mesmo lead:
assert.equal(_nomesMesmoLead('neto', 'neto'), true, 'nome idêntico');
assert.equal(_nomesMesmoLead('neto', 'neto boulevard'), true, 'nome menor contido no maior');
assert.equal(_nomesMesmoLead('neto boulevard', 'neto'), true, 'ordem inversa também casa');
assert.equal(_nomesMesmoLead('joao silva', 'joao silva'), true, 'nome completo igual');

// Leads diferentes:
assert.equal(_nomesMesmoLead('joao silva', 'joao souza'), false, 'sobrenomes diferentes não casam');
assert.equal(_nomesMesmoLead('neto', 'bruno'), false, 'nomes distintos não casam');
assert.equal(_nomesMesmoLead('', 'neto'), false, 'nome vazio nunca casa');
assert.equal(_nomesMesmoLead('neto', ''), false, 'nome vazio nunca casa (inverso)');

console.log('dedup-nome: ok');
