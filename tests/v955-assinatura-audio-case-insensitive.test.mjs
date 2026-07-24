import fs from 'node:fs';
import assert from 'node:assert/strict';

// v955 — revisão completa em api/_pipeline.js (linhas 950-3233). A assinatura usada pra
// detectar "mensagem nova" numa reimportação (assinaturaTimelineIncremental) comparava áudio
// só pelo nome do arquivo via normalizeName(), que NÃO baixa a caixa (só tira o caminho) —
// diferente da assinatura irmã em api/_persistence.js (_assinaturaTimelineV681), que já
// normaliza pra minúsculo. Alinhado: o mesmo áudio com nome em caixa diferente entre uma
// reimportação e outra agora bate igual nos dois lugares.

const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const persistence = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');

assert.match(pipeline, /if \(m\.mediaFile\) return "audio\|" \+ normalizeName\(m\.mediaFile\)\.toLowerCase\(\);/,
  'assinaturaTimelineIncremental normaliza o nome do áudio pra minúsculo');
const assinaturaPersistence = persistence.match(/function _assinaturaTimelineV681\(m\)\{[\s\S]*?\n\}/)?.[0]
  || persistence.slice(persistence.indexOf('function _assinaturaTimelineV681'), persistence.indexOf('function _assinaturaTimelineV681') + 400);
assert.match(assinaturaPersistence, /\.toLowerCase\(\)\.trim\(\)/,
  'a assinatura irmã em _persistence.js já normalizava pra minúsculo (referência)');

console.log('v955-assinatura-audio-case-insensitive: ok');
