import fs from 'node:fs';
import assert from 'node:assert/strict';

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const storage = fs.readFileSync(new URL('../api/processar-storage.js', import.meta.url), 'utf8');
const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

// v827-4 (ZIP grande) — extrai SOMENTE os áudios que serão transcritos na janela.
assert.match(pipeline, /const nomesNecessarios = new Set\(audiosParaTranscrever\.map\(normalizeName\)\)/);
assert.match(pipeline, /if \(!nomesNecessarios\.has\(base\)\) continue/);
assert.doesNotMatch(pipeline, /for \(const fullName of audioFiles\) \{\s*const entry = zip\.files\[fullName\]/);

// Upload dos áudios em lotes paralelos (não trava a função com muitos áudios).
assert.match(storage, /const CONCORRENCIA_UPLOAD = 4/);
assert.match(storage, /Promise\.all\(Array\.from/);

// Só reaproveita a extração anterior se a JANELA de áudio for a mesma.
assert.match(storage, /String\(existente\?\.audioWindowDays \|\| "90"\) === janelaSolicitada/);

// A função de storage tem tempo suficiente configurado.
assert.equal(vercel.functions['api/processar-storage.js'].maxDuration, 60);

console.log('v827-4 large ZIP: ok');
