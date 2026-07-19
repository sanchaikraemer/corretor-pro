// v878 — Identidade Visual v2.0: Agenda mobile (a partir dos prints do #876)
// Doc seção 25: no mobile as ações não podem ficar numa coluna lateral estreita —
// o conteúdo usa a largura total e as ações entram ABAIXO, com a principal em destaque.

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const styles = readFileSync(join(raiz, "styles.css"), "utf8");
const app = readFileSync(join(raiz, "app.js"), "utf8");

// 1. O wrapper das ações virou uma classe (não mais coluna inline fixa).
assert.ok(app.includes('<div class="agenda-acoes">'), "As ações da agenda deveriam usar a classe .agenda-acoes");
assert.ok(
  !/<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">\s*<button type="button" onclick='abrirLead/.test(app),
  "As ações da agenda ainda usam a coluna lateral inline antiga"
);

// 2. Desktop mantém a coluna à direita.
assert.ok(/\.agenda-acoes\{display:flex;flex-direction:column;align-items:flex-end/.test(styles), "Desktop deveria manter as ações em coluna à direita");

// 3. Mobile: item empilha e as ações vão para uma linha abaixo, largura total.
assert.ok(/@media\(max-width:760px\)\{[\s\S]*?\.agenda-item\{flex-direction:column;align-items:stretch\}/.test(styles), "No mobile o card da agenda deveria empilhar (texto em largura total)");
assert.ok(/\.agenda-acoes\{flex-direction:row;flex-wrap:wrap;align-items:stretch;gap:8px;margin-top:12px\}/.test(styles), "No mobile as ações deveriam virar uma linha abaixo do conteúdo");
assert.ok(/\.agenda-acoes>button:first-child,\.agenda-acoes>a:first-child\{flex-basis:100%\}/.test(styles), "A ação principal (Ver análise) deveria ocupar a linha no mobile");
assert.ok(/min-height:44px/.test(styles.match(/@media\(max-width:760px\)\{[\s\S]*?\.agenda-acoes>button[^}]*\}/)?.[0]||""), "Botões da agenda no mobile precisam de área de toque de 44px");

console.log("v878-agenda-mobile: OK");
