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

for (const fn of ["mostrarOpcoesInstalar", "esconderOpcoesInstalar", "dispararInstalacao", "fecharOnboarding", "abrirOnboarding"]) {
  assert.match(pwaInstall, new RegExp("function " + fn + "\\("), `js/pwa-install.js precisa definir ${fn}`);
}
// Só abrirOnboarding é chamada via onclick inline do HTML (index.html) — as outras 4
// funções não têm nenhum chamador fora deste módulo, então não precisam de window.X.
assert.match(pwaInstall, /window\.abrirOnboarding = abrirOnboarding;/, "abrirOnboarding precisa ficar em window (onclick inline do HTML depende disso)");

assert.match(pwaInstall, /import \{ qs, toast \} from '\.\/dom\.js\?v=__VERSION__';/, "js/pwa-install.js precisa importar os helpers de dom.js");
assert.match(pwaInstall, /import \{ state \} from '\.\/state\.js\?v=__VERSION__';/, "js/pwa-install.js precisa importar o state compartilhado");
assert.match(pwaInstall, /window\.show\("home"\)/, "abrirOnboarding precisa chamar window.show, não show direto — a função show continua em app.js");

console.log("js-pwa-install-module: ok");
