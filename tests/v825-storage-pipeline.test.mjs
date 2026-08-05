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

// v1039 — a criação da URL de upload foi absorvida por processar-storage.js (mesmo arquivo já
// lido acima como `storage`) pra caber no limite de 12 Serverless Functions do plano Hobby.
assert.match(storage, /Identificador da importação não informado/);
assert.match(storage, /\$\{importId\}\/\$\{fileName\}/, 'retry usa caminho idempotente');

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
// v1141 — o que o navegador NÃO pode mandar é a conversa já salva (o histórico inteiro subindo de
// volta era exatamente o peso que este pipeline em etapas nasceu pra evitar; o servidor lê isso do
// banco). Já o ID do cliente pode: ele não é um palpite do app, é a identificação que o PRÓPRIO
// servidor devolveu na etapa "preparar" — e é ela que permite reaproveitar a análise salva quando a
// reimportação não trouxe nada novo, em vez de pagar a análise inteira de novo.
{
  const bloco = app.slice(app.indexOf('async function processarStorageEmEtapas'), app.indexOf('// ============ RENDERIZAÇÃO'));
  assert.doesNotMatch(bloco, /existingTimeline/, 'o app nunca reenvia a conversa já salva');
  assert.match(bloco, /existingLeadId: prep\?\.leadAnterior\?\.id/, 'manda só o id que o servidor identificou na etapa preparar');
}

console.log('v825-storage-pipeline: ok');
