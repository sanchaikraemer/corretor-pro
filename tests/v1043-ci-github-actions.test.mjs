import fs from 'node:fs';
import assert from 'node:assert/strict';

// v1043 — auditoria item 9 ("Testes: implantar execução automática no GitHub antes do deploy").
// Não havia nenhum workflow do GitHub Actions — os testes só rodavam manualmente, então uma
// alteração podia ir parar no main sem ninguém ter rodado `npm test`. Este teste confirma
// (estaticamente, sem depender de biblioteca de YAML) que o workflow existe e está configurado
// pra rodar em toda alteração relevante.

const caminho = new URL('../.github/workflows/ci.yml', import.meta.url);
assert.ok(fs.existsSync(caminho), '.github/workflows/ci.yml precisa existir');
const yml = fs.readFileSync(caminho, 'utf8');

// Roda em push E em pull_request pra main — senão um PR podia ficar vermelho sem ninguém notar
// até já estar mesclado.
// v1324 — passou a rodar em push de QUALQUER branch (`branches: ['**']`), não só do main: o
// objetivo é ver o vermelho enquanto ainda se está trabalhando, antes até de abrir o PR. O que
// este teste guarda continua sendo o mesmo: a suíte roda sozinha em push e em PR.
assert.match(yml, /on:\s*\n\s*push:\s*\n\s*branches:\s*(\[main\]|\['\*\*'\])/, 'precisa rodar em push (main ou todas as branches)');
assert.match(yml, /pull_request:\s*\n\s*branches:\s*\[main\]/, 'precisa rodar em pull_request pra main');

// Instala as dependências de verdade (npm ci, não npm install — reproduzível, trava no
// package-lock.json) e roda a suíte completa do projeto, não um subconjunto.
assert.match(yml, /run:\s*npm ci/, 'precisa instalar dependências com npm ci (reproduzível)');
assert.match(yml, /run:\s*npm test/, 'precisa rodar npm test (a suíte inteira já configurada no package.json)');

console.log('v1043-ci-github-actions: ok');
