import fs from 'node:fs';
import assert from 'node:assert/strict';

// v960 — revisão de api/criar-upload-url.js. sanitizeFileName() tinha o MESMO regex frágil de
// remoção de acento já corrigido em api/_persistence.js (v950) e api/_pipeline.js (v951): o
// código-fonte trazia os caracteres Unicode combinantes LITERAIS (faixa U+0300–U+036F) dentro
// do regex, em vez do escape \u0300-\u036f — funciona igual até o arquivo passar por alguma
// ferramenta/editor que normalize Unicode na gravação, aí o regex corrompe silenciosamente sem
// erro de sintaxe. Guarda de regressão: nenhum dos arquivos já corrigidos pode voltar a ter o
// caractere combinante literal no código-fonte.
//
// v965 — app.js tinha o mesmo padrão em exatamente 3 pontos (normalizarEtapa, semAcento,
// _normpc) — corrigido e incluído aqui.
const ARQUIVOS_JA_CORRIGIDOS = [
  '../api/_persistence.js',
  '../api/_pipeline.js',
  '../api/criar-upload-url.js',
  '../app.js'
];

// Mesma faixa de caracteres combinantes construída via \u (não literal) — detecta o mesmo bug
// sem o próprio arquivo de teste precisar carregar o byte frágil no código-fonte.
const COMBINING_MARK = new RegExp('[\u0300-\u036f]');

for (const rel of ARQUIVOS_JA_CORRIGIDOS) {
  const src = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
  assert.doesNotMatch(src, COMBINING_MARK, `${rel} não pode conter caractere Unicode combinante literal no código-fonte (use o escape \\u0300-\\u036f)`);
}

console.log('v960-sem-acento-unicode-literal: ok');
