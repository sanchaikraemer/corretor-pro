import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// v966 — a guarda de build.js contra "arquivo de api/ duplicado na raiz" (protege contra o
// front atualizar enquanto a função serverless real fica antiga) usava uma lista de nomes
// CRAVADA no código: só cobria 5 dos 12 arquivos reais em api/ (os outros 7 — analisar.js,
// cerebro-config.js, criar-upload-url.js, diagnostico.js, leads-recentes.js, limpar-tudo.js,
// restaurar-leads.js — foram adicionados em versões posteriores sem atualizar essa lista, e
// ficavam sem nenhuma proteção). Corrigido pra ler o diretório api/ de verdade em vez de uma
// lista fixa.

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const buildSrc = fs.readFileSync(path.join(root, 'build.js'), 'utf8');

// A lista precisa vir de fs.readdirSync(api/), não de um array de nomes escrito à mão.
assert.match(buildSrc, /readdirSync\(apiDir\)/, 'build.js deve ler api/ dinamicamente, não usar lista fixa de nomes');

// Todo arquivo .js que existe hoje em api/ precisa estar coberto pela guarda — prova que a
// lista dinâmica realmente inclui o /api real, não só uma amostra.
const apiDirReal = path.join(root, 'api');
const apiFilesReais = fs.readdirSync(apiDirReal).filter(f => f.endsWith('.js'));
assert.ok(apiFilesReais.length >= 10, 'sanity check: api/ deveria ter pelo menos 10 arquivos .js nesta base');

// Exercita a guarda de verdade: duplica um arquivo de api/ que NÃO estava na lista antiga
// (restaurar-leads.js) na raiz do projeto e roda build.js como processo filho — precisa
// falhar cedo (antes de qualquer outra etapa do build) com a mensagem certa.
const nomeDuplicado = 'restaurar-leads.js';
assert.ok(apiFilesReais.includes(nomeDuplicado), `sanity check: api/${nomeDuplicado} deveria existir`);
const caminhoDuplicado = path.join(root, nomeDuplicado);
assert.equal(fs.existsSync(caminhoDuplicado), false, `${nomeDuplicado} não deveria existir na raiz antes do teste`);

fs.writeFileSync(caminhoDuplicado, '// arquivo de teste v966 — duplicata proposital pra exercitar a guarda de build.js\n');
try {
  const resultado = spawnSync(process.execPath, ['build.js'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(resultado.status, 0, 'build.js deveria falhar com o arquivo duplicado na raiz');
  assert.match(resultado.stderr + (resultado.stdout || ''), new RegExp(nomeDuplicado.replace('.', '\\.')), 'a mensagem de erro deve citar o arquivo duplicado');
} finally {
  fs.rmSync(caminhoDuplicado, { force: true });
}

console.log('v966-build-guarda-api-raiz-dinamica: ok');
