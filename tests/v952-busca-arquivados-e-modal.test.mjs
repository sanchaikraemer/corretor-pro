import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// v952 — pedido do dono: busca dentro de Arquivados (achar quem voltou a responder e
// reativar). Achado no caminho: (a) confirm() nativo feio no Reativar/Reabrir — trocado pro
// modal em-app cp903Confirm, igual o resto do app já usa pra arquivar/perder; (b) bug real
// pré-existente — a navegação pra Arquivados chamava um carregarGeladeira() morto (duplicado,
// sem paginação nem suporte a busca) por causa de escopo léxico de módulo.

// 1. Campo de busca existe na tela de Arquivados, ligado à função de busca.
assert.match(html, /id="buscaArquivados"[^>]*oninput="buscaGeladeiraInline\(this\.value\)"/,
  'input de busca dos Arquivados existe e está ligado a buscaGeladeiraInline');

// 2. buscaGeladeiraInline filtra por nome/produto/telefone com semAcento, igual buscaLeadInline.
const buscaFn = app.match(/window\.buscaGeladeiraInline = function\(termo\)\{[\s\S]*?\n  \};/)?.[0];
assert.ok(buscaFn, 'window.buscaGeladeiraInline existe');
assert.match(buscaFn, /semAcento\(l\.name\)\.includes\(t\)/, 'busca por nome');
assert.match(buscaFn, /semAcento\(l\.product\)\.includes\(t\)/, 'busca por produto');
assert.match(buscaFn, /numeros\.length >= 3 && String\(l\.phone/, 'busca por telefone');
assert.match(buscaFn, /state\.geladeiraItemsTodos/, 'filtra a partir da lista completa guardada em state');

// 3. carregarGeladeira guarda a lista completa pra busca poder filtrar sem refazer fetch.
const carregarFn = app.match(/window\.carregarGeladeira = async function\(\)\{[\s\S]*?\n  \};/)?.[0];
assert.ok(carregarFn, 'window.carregarGeladeira existe');
assert.match(carregarFn, /state\.geladeiraItemsTodos = items;/, 'guarda a lista completa em state');

// 4. Só existe UMA função carregarGeladeira agora (a duplicada morta foi removida).
const ocorrencias = app.match(/function carregarGeladeira\(/g) || [];
assert.equal(ocorrencias.length, 0, 'não sobra function carregarGeladeira nomeada (só a de window.*)');
assert.match(app, /window\.carregarGeladeira = async function\(\)/, 'window.carregarGeladeira é a única versão');

// 5. A navegação pra tela usa window.carregarGeladeira (não a referência solta, que
//    resolvia pro escopo do módulo — a função morta, antes de ser removida).
assert.match(app, /await window\.carregarGeladeira\(\);/, 'navegação chama window.carregarGeladeira explicitamente');

// 6. Reativar (Arquivados) e Reabrir (Perdidos) usam o modal em-app, não confirm() nativo
//    como caminho principal.
const reativarFn = app.match(/async function reativarLeadGeladeira\(id, btn\)\{[\s\S]*?\n\}/)?.[0];
const reabrirFn = app.match(/async function reabrirLeadPerdido\(id, btn\)\{[\s\S]*?\n\}/)?.[0];
assert.match(reativarFn, /cp903Confirm\(\{ titulo: "Reativar lead"/, 'Reativar usa cp903Confirm');
assert.match(reabrirFn, /cp903Confirm\(\{ titulo: "Reabrir lead"/, 'Reabrir usa cp903Confirm');
// confirm() nativo só sobra como fallback caso cp903Confirm não exista (defesa, não caminho normal).
assert.match(reativarFn, /: confirm\(msg\);/, 'mantém fallback defensivo pro confirm nativo');

console.log('v952-busca-arquivados-e-modal: ok');
