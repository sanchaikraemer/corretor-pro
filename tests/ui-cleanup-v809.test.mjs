import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const persistence = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');

assert.doesNotMatch(app, /O que merece sua atenção/i, 'bloco redundante deve ser removido de todos os renderizadores');
assert.doesNotMatch(app, /LEITURA DO DIA/i, 'rótulo redundante deve ser removido');
assert.doesNotMatch(app, /function badgeConfianca/, 'badge de confiança deve ser removido do sistema');
assert.doesNotMatch(app, /function probabilidadeRefinada/, 'função de probabilidade comercial deve ser removida do sistema');
assert.doesNotMatch(fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8'), /confianca:\s*\d+/, 'pipeline não deve gerar confiança numérica');
for (const campo of ['probabilityPercent','probabilidadeVenda','scoreAjuste','indiceComercial','confiancaAnalise']) {
  assert.match(persistence, new RegExp(`"${campo}"`), `persistência deve remover ${campo}`);
}

console.log('ui-cleanup-v809: ok');
