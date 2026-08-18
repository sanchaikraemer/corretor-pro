import fs from "node:fs";
import assert from "node:assert/strict";

// v849: terceira fatia da modularização de app.js — extrai js/pwa-install.js. O bloco
// original ("===== Instalar app (PWA) =====") também continha as duas funções de
// onboarding (fecharOnboarding/abrirOnboarding), fisicamente coladas ali; foram junto
// pro mesmo módulo novo em vez de forçar uma separação que o código original não tinha
// (ver NOTAS-v849.md).

const appJs = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const pwaInstall = fs.readFileSync(new URL("../js/pwa-install.js", import.meta.url), "utf8");

assert.doesNotMatch(appJs, /function mostrarOpcoesInstalar\(/, "mostrarOpcoesInstalar não pode mais existir em app.js");
assert.doesNotMatch(appJs, /function abrirOnboarding\(/, "abrirOnboarding não pode mais existir em app.js");
assert.match(appJs, /import '\.\/js\/pwa-install\.js\?v=__VERSION__';/, "app.js precisa importar o módulo novo");

for (const fn of ["mostrarOpcoesInstalar", "esconderOpcoesInstalar", "dispararInstalacao"]) {
  assert.match(pwaInstall, new RegExp("function " + fn + "\\("), `js/pwa-install.js precisa definir ${fn}`);
}

// v1293 — O CONVITE DE BOAS-VINDAS ANTIGO SAIU, E ESTE TESTE ESTAVA DESATUALIZADO.
//
// Ele afirmava, desde a v849, que "abrirOnboarding é chamada via onclick inline do HTML
// (index.html)". Na revisão do dia 18/08/2026 isso foi conferido: o nome `abrirOnboarding` NÃO
// aparecia uma única vez no index.html — o botão do Menu que a chamava tinha sumido em alguma
// faxina anterior, e ninguém percebeu porque o teste conferia só o texto do MÓDULO, nunca se
// alguém chamava. Do outro lado, o `<div id="bannerOnboarding">` do index.html estava VAZIO: o
// app calculava direitinho quando mostrá-lo e mostrava uma caixa sem nada dentro.
//
// As duas pontas foram removidas. O tutorial que ensina a mandar a conversa é o da v1149
// (cp1149AbrirSePrimeiraVez), esse sim ligado e conferido em v1149-tutorial-como-enviar-conversa.
for (const morta of ["fecharOnboarding", "abrirOnboarding"]) {
  assert.doesNotMatch(pwaInstall, new RegExp("function " + morta + "\\("), `${morta} foi removida na v1293 — o convite antigo era uma caixa vazia sem porta de entrada`);
}
assert.doesNotMatch(fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"), /bannerOnboarding/,
  "a caixa vazia do convite antigo não pode voltar ao index.html");

assert.match(pwaInstall, /import \{ qs, toast(?:, escapeHtml)? \} from '\.\/dom\.js\?v=__VERSION__';/, "js/pwa-install.js precisa importar os helpers de dom.js");
assert.match(pwaInstall, /import \{ state \} from '\.\/state\.js\?v=__VERSION__';/, "js/pwa-install.js precisa importar o state compartilhado");

console.log("js-pwa-install-module: ok");
