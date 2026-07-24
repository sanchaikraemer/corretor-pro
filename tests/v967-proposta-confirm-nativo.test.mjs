import fs from 'node:fs';
import assert from 'node:assert/strict';

// v967 — revisão de js/proposta.js. Mesmo padrão já corrigido em app.js na v964 (confirm()
// nativo — a "tela feia" com a URL do app aparecendo — no lugar do modal em-app cp903Confirm):
// propClear() e excluirPropostaTimeline() usavam confirm() nativo puro. A varredura da v964
// olhou só app.js e não pegou este arquivo. Convertidos pro mesmo padrão:
// `(typeof cp903Confirm === "function") ? await cp903Confirm({...}) : confirm(msg)`.

const src = fs.readFileSync(new URL('../js/proposta.js', import.meta.url), 'utf8');

const FUNCOES_COM_CONFIRM = ['propClear', 'excluirPropostaTimeline'];

for (const nome of FUNCOES_COM_CONFIRM) {
  const re = new RegExp(`(?:async )?function ${nome}\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`);
  const corpo = src.match(re)?.[0];
  assert.ok(corpo, `achei a função ${nome} em js/proposta.js`);
  assert.match(corpo, /cp903Confirm/, `${nome} deve usar cp903Confirm em vez de confirm() nativo puro`);
}

// propClear precisou virar async pra poder usar await cp903Confirm — confirma que o wrapper
// window.propClear continua exportado (chamado direto via onclick="propClear()" no index.html).
assert.match(src, /window\.propClear\s*=\s*propClear/, 'propClear precisa continuar exportado em window');

console.log('v967-proposta-confirm-nativo: ok');
