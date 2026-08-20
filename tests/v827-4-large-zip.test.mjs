import fs from 'node:fs';
import assert from 'node:assert/strict';

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const storage = fs.readFileSync(new URL('../api/processar-storage.js', import.meta.url), 'utf8');
const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

// v827-4 (ZIP grande) — extrai SOMENTE os áudios que serão transcritos na janela.
// v1141 — e nem todos esses: quem já tem transcrição salva deste cliente sai da lista antes da
// extração (não descomprime, não sobe pro Storage, não paga transcrição de novo).
assert.match(pipeline, /const nomesNecessarios = new Set\(audiosParaTranscrever\.map\(normalizeName\)\.filter\(nome => !jaTranscritos\.has\(nome\)\)\)/);
assert.match(pipeline, /const jaTranscritos = new Set\(Object\.keys\(options\.audiosJaTranscritos \|\| \{\}\)\.map\(normalizeName\)\)/);
assert.match(pipeline, /if \(!nomesNecessarios\.has\(base\)\) continue/);
assert.doesNotMatch(pipeline, /for \(const fullName of audioFiles\) \{\s*const entry = zip\.files\[fullName\]/);

// Upload dos áudios em lotes paralelos (não trava a função com muitos áudios).
assert.match(storage, /const CONCORRENCIA_UPLOAD = 4/);
assert.match(storage, /Promise\.all\(Array\.from/);

// Só reaproveita a extração anterior se a JANELA de áudio for a mesma.
assert.match(storage, /String\(existente\?\.audioWindowDays \|\| "90"\) === janelaSolicitada/);

// A função de storage tem tempo suficiente configurado.
// v1321 — o teto subiu pra 300s junto com a leitura completa (a intenção do guarda é a mesma:
// a rota de importação precisa de tempo configurado suficiente, nunca o padrão de 10s).
assert.ok(vercel.functions['api/processar-storage.js'].maxDuration >= 60);

console.log('v827-4 large ZIP: ok');
