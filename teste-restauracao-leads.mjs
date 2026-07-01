import fs from 'fs';
import assert from 'node:assert/strict';

// Garante que a restauração automática dos leads antigos (Ponto #660) continua
// inteira: lê as tabelas legadas, grava na atual e marca a origem (idempotência).
const read = (f) => fs.readFileSync(new URL('./' + f, import.meta.url), 'utf8');

const restore = read('api/restaurar-leads.js');
const app = read('app.js');

// Handler HTTP exportado.
assert.ok(/export default async function handler/.test(restore), 'restaurar-leads.js sem handler exportado');

// Lê as duas tabelas legadas.
assert.ok(restore.includes('direciona_leads'), 'restaurar-leads.js não lê a tabela legada direciona_leads');
assert.ok(restore.includes('"leads"'), 'restaurar-leads.js não lê a tabela legada leads');

// Grava na estrutura atual.
assert.ok(restore.includes('whatsapp_processamentos'), 'restaurar-leads.js não grava em whatsapp_processamentos');

// Marca de origem — é o que evita reprocessar/duplicar o mesmo lead (idempotência).
assert.ok(restore.includes('restauradoDaBaseAnterior'), 'restaurar-leads.js sem a marca restauradoDaBaseAnterior');

// O app guarda a chave da conferência legada (não repete a restauração à toa).
assert.ok(app.includes('corretor_pro_restauracao_legado_v'), 'app.js sem a chave de restauração legada');

console.log('Teste restauração de leads: OK — handler, tabelas legadas, destino e marca de origem validados.');
