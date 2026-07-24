import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// v963 — revisão de api/analisar.js. Era a ÚNICA rota do projeto sem requireApiKey() — rodava o
// pipeline completo da OpenAI (transcrição + análise, o trabalho mais caro do app) pra qualquer
// POST não autenticado. Já tinha sido flagado como achado em NOTAS-v860.md ("rota pública que
// gasta crédito") e adiado a pedido do dono na época; nesta revisão o mesmo problema apareceu de
// novo (segunda vez, independente) — corrigido agora com o mesmo requireApiKey() que toda outra
// rota já usa.
//
// Guarda de regressão: em vez de travar só nesse arquivo, varre TODO handler de rota em api/ e
// garante que cada um chama requireApiKey — pra um endpoint novo nunca nascer sem essa checagem
// de novo, em qualquer arquivo.

const apiDir = new URL('../api/', import.meta.url);
const arquivos = fs.readdirSync(apiDir).filter(f => f.endsWith('.js'));

const rotasSemHandler = []; // arquivos utilitários (sem "export default async function handler") — não são rota HTTP.
const rotasVerificadas = [];
const rotasSemApiKey = [];

for (const nome of arquivos) {
  const src = fs.readFileSync(new URL(nome, apiDir), 'utf8');
  const ehRota = /export default async function handler\s*\(/.test(src);
  if (!ehRota) { rotasSemHandler.push(nome); continue; }
  rotasVerificadas.push(nome);
  if (!/requireApiKey\s*\(/.test(src)) rotasSemApiKey.push(nome);
}

assert.ok(rotasVerificadas.includes('analisar.js'), 'api/analisar.js precisa ser reconhecida como rota (tem handler default)');
assert.ok(rotasVerificadas.length >= 8, `esperava achar pelo menos 8 rotas com handler, achei ${rotasVerificadas.length}: ${rotasVerificadas.join(', ')}`);
assert.deepEqual(rotasSemApiKey, [], `toda rota (handler default) precisa chamar requireApiKey — faltando em: ${rotasSemApiKey.join(', ')}`);

console.log(`v963-todas-rotas-exigem-api-key: ok (${rotasVerificadas.length} rotas verificadas, ${rotasSemHandler.length} arquivo(s) utilitário(s) ignorado(s): ${rotasSemHandler.join(', ')})`);
