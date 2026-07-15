import assert from 'node:assert/strict';
import { _nomesMesmoLead } from '../api/_persistence.js';

// v825: somente igualdade técnica do nome pode localizar um candidato.
// Nomes contidos ou apenas parecidos nunca autorizam fusão automática.
assert.equal(_nomesMesmoLead('neto', 'neto'), true, 'nome idêntico');
assert.equal(_nomesMesmoLead('joao silva', 'joao silva'), true, 'nome completo igual');
assert.equal(_nomesMesmoLead('neto', 'neto boulevard'), false, 'palavra adicional pode indicar outro contato');
assert.equal(_nomesMesmoLead('neto boulevard', 'neto'), false, 'contenção inversa também não autoriza fusão');
assert.equal(_nomesMesmoLead('joao silva', 'joao souza'), false, 'sobrenomes diferentes não casam');
assert.equal(_nomesMesmoLead('maria souza', 'maria clara souza'), false, 'nomes apenas semelhantes não casam');
assert.equal(_nomesMesmoLead('', 'neto'), false, 'nome vazio nunca casa');
assert.equal(_nomesMesmoLead('neto', ''), false, 'nome vazio nunca casa (inverso)');

console.log('dedup-nome: ok');
