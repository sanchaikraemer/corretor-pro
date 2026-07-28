import fs from "node:fs";
import assert from "node:assert/strict";

// v1046 — segunda extração real de app.js (depois de proposta.js/pwa-install.js — ver
// NOTAS-v1046.md): bloco "Aparência: tema claro/escuro" pra js/tema.js. Escolhido por ser o
// candidato mais seguro (achado por investigação dedicada): 37 linhas contíguas, zero
// dependência de state, e um único ponto de chamada externo em app.js (configurarEscolhaTema()
// no boot). Confirma que o bloco saiu de app.js, que o módulo novo tem as funções certas com os
// imports certos, e que app.js importa e chama o módulo sem quebrar o comportamento.

const appJs = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const tema = fs.readFileSync(new URL("../js/tema.js", import.meta.url), "utf8");

for (const fn of ["temaDirecionaAtual", "sincronizarControlesTema", "aplicarTemaDireciona", "configurarEscolhaTema"]) {
  assert.doesNotMatch(appJs, new RegExp("function " + fn + "\\("), `${fn} não pode mais existir em app.js — só em js/tema.js`);
}
assert.doesNotMatch(appJs, /DIRECIONA_THEME_KEY/, "a chave de localStorage do tema não pode mais aparecer em app.js — só em js/tema.js");

assert.match(appJs, /import \{ configurarEscolhaTema \} from '\.\/js\/tema\.js\?v=__VERSION__';/, "app.js precisa importar configurarEscolhaTema por nome de js/tema.js");
// Import nomeado (não import de efeito colateral) — a chamada no boot continua NUA, sem
// window., porque o valor já chega resolvido pelo próprio import (mesmo padrão de qs/qsa/toast
// vindos de dom.js).
assert.match(appJs, /(?<!window\.)configurarEscolhaTema\(\);/, "app.js precisa continuar chamando configurarEscolhaTema() nu (import nomeado), não window.configurarEscolhaTema()");

for (const fn of ["temaDirecionaAtual", "sincronizarControlesTema", "aplicarTemaDireciona", "configurarEscolhaTema"]) {
  assert.match(tema, new RegExp("function " + fn + "\\("), `js/tema.js precisa definir ${fn}`);
}
assert.match(tema, /export function aplicarTemaDireciona/, "aplicarTemaDireciona precisa ser exportado (app.js importa por nome)");
assert.match(tema, /export function configurarEscolhaTema/, "configurarEscolhaTema precisa ser exportado (app.js importa por nome)");
assert.match(tema, /window\.aplicarTemaDireciona = aplicarTemaDireciona;/, "aplicarTemaDireciona precisa continuar exposta em window (compatibilidade — nada mais no projeto usa isso hoje, mas é a mesma cautela já usada nos módulos anteriores)");

assert.match(tema, /import \{ qs, qsa, toast \} from '\.\/dom\.js\?v=__VERSION__';/, "js/tema.js precisa importar os helpers de dom.js");
assert.doesNotMatch(tema, /from '\.\/state\.js/, "js/tema.js não depende de state — não deveria importá-lo");

console.log("js-tema-module: ok");
