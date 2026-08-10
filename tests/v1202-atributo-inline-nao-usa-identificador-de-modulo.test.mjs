import fs from "node:fs";
import assert from "node:assert/strict";

// v1202 — o dono clicou em "Confirmar" no reagendamento e nada aconteceu. O console mostrava
// "Uncaught ReferenceError: qs is not defined". Causa: app.js importa `qs` (js/dom.js) como
// binding de MÓDULO (`import { qs, ... } from './js/dom.js'`), mas atributos inline
// (onclick='...'/onchange='...') rodam FORA do escopo do módulo — só enxergam identificadores
// globais (window/document) e o que o próprio app.js pendura explicitamente em `window`. Esse
// bug já estava na v1200 (que introduziu o campo de hora) e sobreviveu à v1201 (que adicionou o
// botão Confirmar reaproveitando o mesmo `qs(...)` quebrado) — os testes anteriores só liam o
// texto do código com regex, nunca EXECUTARAM o conteúdo do atributo inline de verdade.
//
// Este teste executa cada onclick/onchange que reagendarControlHTML gera, num escopo global
// simulado (sem `qs` disponível — exatamente como um atributo inline de verdade), e falha se
// qualquer um lançar erro.

const appSrc = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// 0. `toast` precisa estar em window — é usado dentro de atributo inline (botão Confirmar).
assert.match(appSrc, /window\.toast\s*=\s*toast;/, "toast precisa estar exposto em window pra atributos inline poderem chamá-lo");

const ini = appSrc.indexOf("function reagendarControlHTML(idRaw){");
assert.ok(ini > -1, "reagendarControlHTML precisa existir");
const fim = appSrc.indexOf("\nwindow.reagendarControlHTML", ini);
assert.ok(fim > ini, "não achei o fim de reagendarControlHTML");
const fnSrc = appSrc.slice(ini, fim);

const reagendarControlHTML = new Function(`${fnSrc}; return reagendarControlHTML;`)();
const html = reagendarControlHTML("lead-teste-123");

const atributosInline = [...html.matchAll(/on(?:click|change)='([^']*)'/g)].map(m => m[1]);
assert.ok(atributosInline.length >= 7, "esperava vários atributos inline no painel de reagendar (chips + campos + confirmar)");

for (const codigo of atributosInline) {
  const documentFalso = { querySelector() { return { value: "2026-08-11" }; } };
  const semOperacao = () => {};
  // Escopo deliberadamente SEM `qs` — só o que existe de verdade num atributo inline: os
  // parâmetros passados aqui (equivalentes ao que app.js pendura em window) e `document`.
  const executar = new Function(
    "document", "reagendarDias", "reagendarLembrete", "toggleReagendar", "toast", "event",
    codigo
  );
  assert.doesNotThrow(
    () => executar(documentFalso, semOperacao, semOperacao, semOperacao, semOperacao, {}),
    `atributo inline não pode usar identificador que só existe no módulo (ex.: "qs"): ${codigo}`
  );
}

console.log("v1202-atributo-inline-nao-usa-identificador-de-modulo: ok");
