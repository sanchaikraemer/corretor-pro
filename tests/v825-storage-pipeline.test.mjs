import assert from 'node:assert/strict';
import fs from 'node:fs';

const storage = fs.readFileSync(new URL('../api/processar-storage.js', import.meta.url), 'utf8');
const transcreverInicio = storage.indexOf('if (action === "transcrever")');
const analisarInicio = storage.indexOf('if (action === "analisar")');
assert.ok(transcreverInicio > 0 && analisarInicio > transcreverInicio);
const blocoTranscrever = storage.slice(transcreverInicio, analisarInicio);
assert.doesNotMatch(blocoTranscrever, /baixarBuffer\(storage,\s*storagePath\)/, 'transcrição não pode baixar o ZIP integral');
assert.match(blocoTranscrever, /manifest\.audioStorage\[nome\]/, 'lote usa áudio já extraído');
assert.match(storage, /reusedPreparation/);
assert.match(storage, /audioHashes/);
assert.match(storage, /transcription-cache/);
assert.match(storage, /manifest\.transcriptions = existentes/);
assert.match(storage, /if \(action === "finalizar"\)/);
assert.match(storage, /sourceZipPath/);
assert.match(storage, /status = \"analysis-ready\"/);
assert.match(storage, /status = \"completed\"/);
assert.match(storage, /status = \"recoverable-failure\"/);
assert.match(storage, /activeImportId/);
assert.match(storage, /manifest\?\.updatedAt \|\| manifest\?\.createdAt/);

const upload = fs.readFileSync(new URL('../api/criar-upload-url.js', import.meta.url), 'utf8');
assert.match(upload, /Identificador da importação não informado/);
assert.match(upload, /\$\{importId\}\/\$\{fileName\}/, 'retry usa caminho idempotente');

const sw = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
assert.match(sw, /if \(!debug\.idbSaved\)/, 'cache só é usado se IndexedDB falhar');
const fallbackStart = sw.indexOf('if (!debug.idbSaved)');
const fallback = sw.slice(fallbackStart, sw.indexOf("debug.step =", fallbackStart));
assert.equal((fallback.match(/cache\.put/g) || []).length, 1, 'fallback mantém apenas uma cópia no cache');

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
assert.match(app, /action:"finalizar"/);
assert.match(app, /limparSharesLocaisAntigos/);
assert.match(app, /limparImportacoesRemotasAntigas/);
assert.match(app, /X-Shared-At/);
assert.match(app, /Falha recuperável/);
assert.match(app, /cachedTranscriptions/);
assert.doesNotMatch(app.slice(app.indexOf('async function processarStorageEmEtapas'), app.indexOf('// ============ RENDERIZAÇÃO')), /existingLeadId/);

console.log('v825-storage-pipeline: ok');
