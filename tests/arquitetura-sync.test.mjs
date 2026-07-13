import fs from 'node:fs';
import assert from 'node:assert/strict';

// Regressão: o rótulo de arquitetura de mensagens do frontend (app.js) precisa ser
// IDÊNTICO ao do backend (api/_pipeline.js). Quando eles divergem, toda análise recém
// gerada pelo backend é marcada como "antiga" pelo frontend e a tela fica pedindo
// "Atualizar análise comercial" em loop, mesmo depois de reanalisar.

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');

function extrairArquitetura(src, arquivo) {
  const m = src.match(/ARQUITETURA_MENSAGENS_ATUAL\s*=\s*["']([^"']+)["']/);
  assert.ok(m, `não encontrei ARQUITETURA_MENSAGENS_ATUAL em ${arquivo}`);
  return m[1];
}

const frontend = extrairArquitetura(app, 'app.js');
const backend = extrairArquitetura(pipeline, 'api/_pipeline.js');

assert.equal(
  frontend,
  backend,
  `Arquitetura de mensagens divergente: frontend="${frontend}" x backend="${backend}". ` +
  `Elas precisam ser iguais para que a análise recém-gerada não seja tratada como antiga.`
);

console.log('arquitetura-sync: ok');
