// v1196 — SUBSTITUTO VAZIO DO "STORAGE" DO SUPABASE (arquivos) NO NAVEGADOR.
//
// Quem envia e lê arquivo no Corretor Pro é o SERVIDOR (`api/_zipUpload.js`, `api/_persistence.js`),
// que usa a biblioteca do lado de lá — essa continua completa e intocada. O navegador nunca chama
// `.storage.` (varredura da v1196; a guarda `tests/v1196-supabase-enxuto.test.mjs` cobra isso).
//
// O ZIP da conversa vai pro servidor pela rota `/api/processar-storage`, não direto pelo Storage.

const AVISO = 'O envio de arquivos do Corretor Pro passa pelo servidor (/api), não pelo Storage no ' +
  'navegador. Se isso mudar, remova a troca do módulo em build.js (vendor-enxuto/sem-storage.js).';

export class StorageApiError extends Error {
  constructor(mensagem, status) { super(mensagem || AVISO); this.name = 'StorageApiError'; this.status = status; }
}
export class StorageClient {
  constructor(url, headers, fetchImpl) { this.url = url; this.headers = headers; this.fetch = fetchImpl; }
  from() { throw new Error(AVISO); }
  listBuckets() { throw new Error(AVISO); }
  getBucket() { throw new Error(AVISO); }
  createBucket() { throw new Error(AVISO); }
  updateBucket() { throw new Error(AVISO); }
  deleteBucket() { throw new Error(AVISO); }
  emptyBucket() { throw new Error(AVISO); }
}
