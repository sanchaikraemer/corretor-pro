import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import {
  BASE_V661_GZIP_BASE64,
  BASE_V661_TOTAL,
  BASE_V661_EXCLUIDOS_PERDIDOS,
  BASE_V661_MESCLADOS_DUPLICADOS
} from './api/_base-leads-v661.js';
import { importarBaseConsolidada } from './api/importar-base-leads.js';

const source = JSON.parse(gunzipSync(Buffer.from(BASE_V661_GZIP_BASE64, 'base64')).toString('utf8'));
assert.equal(source.length, 198);
assert.equal(BASE_V661_TOTAL, 198);
assert.equal(BASE_V661_EXCLUIDOS_PERDIDOS, 199);
assert.equal(BASE_V661_MESCLADOS_DUPLICADOS, 2);
assert.equal(new Set(source.map(x => x.id)).size, source.length);
assert.equal(new Set(source.map(x => x.dedupeName)).size, source.length);
assert.equal(source.some(x => /perdid|descart/i.test(x.payload?.etapa || '')), false);
assert.ok(source.every(x => Array.isArray(x.payload?.timeline_json)));
assert.ok(source.reduce((sum, x) => sum + x.payload.timeline_json.length, 0) > 5000);

class Query {
  constructor(db, table){ this.db = db; this.table = table; }
  select(){ return this; }
  limit(){
    if(this.table !== 'whatsapp_processamentos') return Promise.resolve({ data: [], error: null });
    return Promise.resolve({ data: this.db.current.map(x => structuredClone(x)), error: null });
  }
  upsert(rows){
    for(const row of rows){
      const i = this.db.current.findIndex(x => String(x.id) === String(row.id));
      if(i >= 0) this.db.current[i] = structuredClone(row);
      else this.db.current.push(structuredClone(row));
    }
    this.db.upserted.push(...rows.map(x => structuredClone(x)));
    return Promise.resolve({ data: rows, error: null });
  }
}
class MockSupabase {
  constructor(current = []){ this.current = current; this.upserted = []; }
  from(table){ return new Query(this, table); }
}

const first = structuredClone(source[0].payload);
first.resultado_analise = { ...first.resultado_analise, importadoDaBaseV661: false, observacaoAtual: 'preservar' };
const db = new MockSupabase([first]);
const result = await importarBaseConsolidada(db);
assert.equal(result.ok, true);
assert.equal(result.sourceTotal, 198);
assert.equal(result.inserted, 197);
assert.equal(result.updated, 1);
assert.equal(result.lostExcluded, 199);
assert.equal(result.duplicatesMergedBeforeImport, 2);
assert.equal(db.current.length, 198);
assert.equal(db.current.some(x => /perdid/i.test(x.etapa || '')), false);
assert.equal(db.current.find(x => x.id === first.id)?.resultado_analise?.observacaoAtual, 'preservar');

const second = await importarBaseConsolidada(db);
assert.equal(second.inserted, 0);
assert.equal(second.updated, 0);
assert.equal(second.alreadyPresent, 198);
assert.equal(db.current.length, 198);

console.log('Teste importação V661: OK — 198 ativos únicos, 199 perdidos excluídos, 2 duplicados mesclados e importação idempotente.');
