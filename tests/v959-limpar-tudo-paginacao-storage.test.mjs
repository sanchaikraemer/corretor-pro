import assert from 'node:assert/strict';
import { emptyBucket } from '../api/limpar-tudo.js';

// v959 — revisão de api/limpar-tudo.js. list() do Supabase Storage nunca pagina sozinho: cada
// chamada devolve no máximo `limit` itens. O código original chamava list() UMA vez por pasta
// com limit:1000 e nunca olhava se sobrou mais — uma pasta com mais de 1000 arquivos (ex.:
// transcription-cache/, compartilhada entre todos os leads, depois de meses de uso) fazia
// "limpar tudo" apagar só o primeiro lote e reportar ok:true como se tivesse esvaziado tudo.

function makeFakeSupabase(totalArquivos) {
  const files = Array.from({ length: totalArquivos }, (_, i) => ({ name: `arquivo-${i}.bin`, id: `id-${i}` }));
  const listCalls = [];
  const removeBatches = [];
  return {
    storage: {
      from() {
        return {
          list(prefix, opts) {
            listCalls.push({ prefix, ...opts });
            const page = files.slice(opts.offset || 0, (opts.offset || 0) + opts.limit);
            return Promise.resolve({ data: page, error: null });
          },
          remove(paths) {
            removeBatches.push([...paths]);
            return Promise.resolve({ data: paths.map(p => ({ name: p })), error: null });
          }
        };
      }
    },
    _listCalls: listCalls,
    _removeBatches: removeBatches
  };
}

// 1. Pasta com mais de 1 página (2500 arquivos, páginas de 1000) — tem que listar E apagar os
// 2500, não só os primeiros 1000.
{
  const supabase = makeFakeSupabase(2500);
  const result = await emptyBucket(supabase, 'whatsapp-zips');
  assert.equal(result.ok, true);
  assert.equal(result.deleted, 2500, `esperava apagar os 2500 arquivos, apagou ${result.deleted}`);
  assert.ok(supabase._listCalls.length >= 3, 'list() precisa ser chamado em mais de uma página (offset 0, 1000, 2000)');
  const totalRemovido = supabase._removeBatches.reduce((acc, b) => acc + b.length, 0);
  assert.equal(totalRemovido, 2500);
  for (const batch of supabase._removeBatches) assert.ok(batch.length <= 1000, 'remove() em lotes de no máximo 1000');
}

// 2. Caso comum (menos de 1 página) continua funcionando igual — sem regressão pro caminho feliz.
{
  const supabase = makeFakeSupabase(3);
  const result = await emptyBucket(supabase, 'whatsapp-zips');
  assert.equal(result.ok, true);
  assert.equal(result.deleted, 3);
}

// 3. Bucket vazio não quebra e não chama remove().
{
  const supabase = makeFakeSupabase(0);
  const result = await emptyBucket(supabase, 'whatsapp-zips');
  assert.deepEqual(result, { ok: true, deleted: 0 });
  assert.equal(supabase._removeBatches.length, 0);
}

console.log('v959-limpar-tudo-paginacao-storage: ok');
