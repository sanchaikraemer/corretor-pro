// v879 — Identidade Visual v2.0: Atendimentos legível no tema claro (print do #878)
// Doc seção 26: não deixar overlay/loading destruir o contraste.
// A tela de Atendimentos usa as classes cp788-att-*, que tinham fundo petróleo
// translúcido (rgba(7,52,64,.58)) sem override no tema claro — isso virava um véu
// cinza sobre o fundo branco. Este teste garante o override claro dessas superfícies.

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const styles = readFileSync(join(raiz, "styles.css"), "utf8");

// 1. Existe override de tema claro para a lista/cards de Atendimentos (cp788).
assert.ok(
  /html\[data-theme="light"\] \.cp788-att-list,[\s\S]*?background:#FFFFFF!important/.test(styles),
  "Falta override de tema claro para .cp788-att-list (senão fica o véu cinza do petróleo translúcido)"
);
assert.ok(/html\[data-theme="light"\] \.cp788-att-empty/.test(styles), "Falta override light para .cp788-att-empty");
assert.ok(/html\[data-theme="light"\] \.cp788-meta-card/.test(styles), "Falta override light para .cp788-meta-card");

// 2. Texto legível no claro: nome em petróleo escuro, secundário em cinza-azulado.
assert.ok(/html\[data-theme="light"\] \.cp788-att-copy strong\{color:#102A34!important\}/.test(styles), "Nome do atendimento não recebe o texto escuro no claro");
assert.ok(/html\[data-theme="light"\] \.cp788-att-copy small,[\s\S]*?color:#596A72!important/.test(styles), "Texto secundário do atendimento não recebe o cinza legível no claro");

// 3. O chip de tempo e o botão "mostrar mais" ficam sobre superfície clara.
assert.ok(/html\[data-theme="light"\] \.cp788-att-time\{background:#EEF3F5!important/.test(styles), "Chip de tempo não recebe superfície clara");
assert.ok(/html\[data-theme="light"\] \.cp788-att-more\{background:#F3F6F7!important/.test(styles), "Botão 'mostrar mais' não recebe superfície clara");

console.log("v879-atendimentos-tema-claro: OK");
