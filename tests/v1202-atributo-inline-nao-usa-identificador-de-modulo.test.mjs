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

// v1208 — o painel de reagendar da Agenda virou o painel único (cpAgendarPainelHTML), usado
// também dentro do lead. O teste segue o painel: monta o HTML de verdade e executa cada atributo
// inline que ele gera, num escopo global simulado.
function trecho(nome, fim){
  const ini = appSrc.indexOf(nome);
  assert.ok(ini > -1, `${nome} precisa existir`);
  const f = appSrc.indexOf(fim, ini);
  assert.ok(f > ini, `não achei o fim de ${nome}`);
  return appSrc.slice(ini, f);
}
// Um pedaço só, do começo do painel até o fim do controle da Agenda — é assim que ele roda no app.
const fnSrc = trecho("const CP1208_HORAS_RAPIDAS", "\nwindow.reagendarControlHTML");

// `window` existe só no navegador; aqui basta um alvo qualquer pras linhas de exportação.
const montar = new Function("window", `${fnSrc}; return { cpAgendarPainelHTML, reagendarControlHTML };`)({});
const html = montar.reagendarControlHTML("lead-teste-123", { quando: "2026-08-13T12:00:00.000Z", hora: "09:00" })
  + montar.cpAgendarPainelHTML("lead-teste-123", "ui670Schedule", {});

const atributosInline = [...html.matchAll(/on(?:click|change)='([^']*)'/g)].map(m => m[1]);
assert.ok(atributosInline.length >= 14, "esperava vários atributos inline nos dois painéis (chips de dia e hora + campos + confirmar)");

for (const codigo of atributosInline) {
  const semOperacao = () => {};
  const documentFalso = { querySelector() { return { value: "2026-08-11" }; }, getElementById() { return { value: "2026-08-11", textContent: "", classList: { toggle(){} } }; } };
  // Escopo deliberadamente SEM `qs` — só o que existe de verdade num atributo inline: os
  // parâmetros passados aqui (equivalentes ao que app.js pendura em window) e `document`.
  const executar = new Function(
    "document", "reagendarDias", "reagendarLembrete", "toggleReagendar", "toast", "event",
    "cpAgendarEscolherDia", "cpAgendarEscolherHora", "cpAgendarResumo", "cpAgendarConfirmar",
    codigo
  );
  assert.doesNotThrow(
    () => executar(documentFalso, semOperacao, semOperacao, semOperacao, semOperacao, {}, semOperacao, semOperacao, semOperacao, semOperacao),
    `atributo inline não pode usar identificador que só existe no módulo (ex.: "qs"): ${codigo}`
  );
}

// E cada nome que esses atributos chamam precisa mesmo estar pendurado em window pelo app.js.
for (const nome of ["cpAgendarEscolherDia", "cpAgendarEscolherHora", "cpAgendarResumo", "cpAgendarConfirmar", "toggleReagendar", "reagendarLembrete"]) {
  assert.ok(appSrc.includes(`window.${nome} = ${nome};`), `${nome} precisa estar exposto em window pra atributos inline poderem chamá-lo`);
}

console.log("v1202-atributo-inline-nao-usa-identificador-de-modulo: ok");
