import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1044 — auditoria item 10 ("Documentação e governança operacional"): mais de 190 notas de
// versão acumuladas, sem um único documento de estado atual pra orientar a operação (achado
// concreto do relatório: duas notas chegaram a se contradizer sobre se uma migração já tinha
// sido aplicada). ESTADO-ATUAL.md passa a ser essa referência única.
//
// Guarda de regressão: toda rota real de api/ (arquivo com handler default) precisa estar citada
// em ESTADO-ATUAL.md pelo nome do arquivo — sem isso, a doc fica desatualizada silenciosamente
// na próxima vez que uma rota for criada, removida ou consolidada (exatamente o tipo de deriva
// que a auditoria criticou).

const apiDir = new URL('../api/', import.meta.url);
const arquivosApi = fs.readdirSync(apiDir).filter(f => f.endsWith('.js'));
const rotasReais = arquivosApi.filter(nome => {
  const src = fs.readFileSync(new URL(nome, apiDir), 'utf8');
  return /export default async function handler\s*\(/.test(src);
});
assert.ok(rotasReais.length >= 10, `sanity check: esperava pelo menos 10 rotas reais, achei ${rotasReais.length}`);

const doc = fs.readFileSync(new URL('../ESTADO-ATUAL.md', import.meta.url), 'utf8');

const faltando = rotasReais.filter(nome => !doc.includes(nome));
assert.deepEqual(faltando, [], `ESTADO-ATUAL.md precisa citar toda rota real de api/ — faltando: ${faltando.join(', ')}`);

// O documento também precisa citar a última migração existente (senão a lista de migrações fica
// desatualizada do mesmo jeito).
const migrationsDir = new URL('../supabase/migrations/', import.meta.url);
const migracoes = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
const ultimaMigracao = migracoes[migracoes.length - 1];
assert.ok(doc.includes(ultimaMigracao), `ESTADO-ATUAL.md precisa citar a migração mais recente (${ultimaMigracao})`);

console.log('v1044-estado-atual-documentacao: ok');
