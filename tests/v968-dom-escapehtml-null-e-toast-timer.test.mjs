import fs from 'node:fs';
import assert from 'node:assert/strict';
import { escapeHtml } from '../js/dom.js';

// v968 — revisão de js/dom.js.
//
// 1) escapeHtml(t="") só cobre o caso `undefined` (parâmetro default nunca dispara pra
// `null`). Campo nulo vindo do banco (coluna sem valor no Postgres vira JSON null, não
// some do objeto) caía em String(null) === "null" e mostrava o texto literal "null" na
// tela em vez de nada. escapeHtml é pura (não toca o DOM), então dá pra testar de verdade
// chamando a função, sem precisar simular navegador.
assert.equal(escapeHtml(null), '', 'escapeHtml(null) deve virar string vazia, não o texto "null"');
assert.equal(escapeHtml(undefined), '', 'escapeHtml(undefined) continua string vazia');
assert.equal(escapeHtml(), '', 'escapeHtml() sem argumento continua string vazia');
assert.equal(escapeHtml('<b>oi</b>'), '&lt;b&gt;oi&lt;/b&gt;', 'escapamento normal continua funcionando');
assert.equal(escapeHtml(0), '0', 'valor falsy legítimo (0) não pode virar string vazia');

// 2) toast() reusava um único setTimeout sem cancelar o anterior: dois toasts em menos de
// 2.6s faziam o PRIMEIRO timer esconder o SEGUNDO toast antes da hora (o timer do primeiro
// dispara enquanto o segundo ainda devia estar visível). toast() toca o DOM (precisa de
// #toast) — verificado por leitura de código, no mesmo padrão já usado nos outros testes
// deste projeto pra funções que dependem do navegador.
const domSrc = fs.readFileSync(new URL('../js/dom.js', import.meta.url), 'utf8');
const toastFn = domSrc.match(/export function toast\([^)]*\)\s*\{[\s\S]*?\n\}/)?.[0];
assert.ok(toastFn, 'achei a função toast em js/dom.js');
assert.match(toastFn, /clearTimeout\(/, 'toast() precisa cancelar o timer anterior antes de agendar um novo');

console.log('v968-dom-escapehtml-null-e-toast-timer: ok');
