// v874 — Identidade Visual v2.0: tokens globais (Etapa 1 — Base)
// Trava a paleta oficial aprovada (doc pág. 4 e 15) e impede a regressão do
// coral antigo (#FF6B5C) e dos petróleos inconsistentes (#001E2B) que conviviam
// antes da unificação. Também garante que os tokens de escala do design system
// (espaçamento, raio, altura de controle, tipografia, status) existem.

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (f) => readFileSync(join(raiz, f), "utf8");

const styles = ler("styles.css");
const index = ler("index.html");
const app = ler("app.js");
const sw = ler("service-worker.js");

// 1. O coral antigo e os petróleos antigos NÃO podem existir em nenhum arquivo publicado.
//    Inclui as três variantes de coral que conviviam (#FF6B5C do :root legado e #FF5B50/#FF704F
//    da "camada final #657") e os petróleos inconsistentes (#001E2B do boot, #001A25 da cp).
const antigos = /#ff6b5c|#ff6257|#ff5b50|#ff704f|255\s*,\s*107\s*,\s*92|255\s*,\s*91\s*,\s*80|#001e2b|#001a25/i;
for (const [nome, txt] of [["styles.css", styles], ["index.html", index], ["app.js", app], ["service-worker.js", sw]]) {
  assert.ok(!antigos.test(txt), `Identidade antiga (coral #FF6B5C/#FF5B50 ou petróleo #001E2B/#001A25) reapareceu em ${nome}`);
}

// 2. Coral oficial presente.
assert.ok(/#FF6258/i.test(styles), "Coral oficial #FF6258 ausente em styles.css");

// 2b. A camada que REALMENTE renderiza (cp #657 dark + #751 light) precisa carregar a paleta oficial.
assert.ok(styles.includes("--cp-bg:#052B36"), "Camada cp dark não usa o fundo oficial #052B36");
assert.ok(styles.includes("--cp-panel:#0D3946"), "Camada cp dark não usa a superfície oficial #0D3946");
assert.ok(styles.includes("--cp-coral:#FF6258"), "Camada cp não usa o coral oficial #FF6258");
assert.ok(styles.includes("--cp-bg:#F3F6F7"), "Camada cp light não usa o fundo oficial #F3F6F7");
assert.ok(styles.includes("--cp-text:#102A34"), "Camada cp light não usa o texto oficial #102A34");

// 3. Paleta DARK PREMIUM oficial nos tokens de tema.
assert.ok(/html\[data-theme="dark"\]\{[\s\S]*?--bg:\s*#052B36/i.test(styles), "Fundo dark oficial #052B36 ausente");
assert.ok(/html\[data-theme="dark"\]\{[\s\S]*?--panel:\s*#0D3946/i.test(styles), "Superfície dark oficial #0D3946 ausente");
assert.ok(/html\[data-theme="dark"\]\{[\s\S]*?--text:\s*#F7FAFB/i.test(styles), "Texto dark oficial #F7FAFB ausente");

// 4. Paleta LIGHT PREMIUM oficial nos tokens de tema.
assert.ok(/html\[data-theme="light"\]\{[\s\S]*?--bg:\s*#F3F6F7/i.test(styles), "Fundo light oficial #F3F6F7 ausente");
assert.ok(/html\[data-theme="light"\]\{[\s\S]*?--text:\s*#102A34/i.test(styles), "Texto light oficial #102A34 ausente");
assert.ok(/html\[data-theme="light"\]\{[\s\S]*?--accent-soft:\s*#FFF0EE/i.test(styles), "Coral suave light oficial #FFF0EE ausente");

// 5. Tokens de escala do design system.
for (const tok of ["--space-4:16px", "--radius-lg:16px", "--control-height-md:44px", "--font-size-base:15px", "--brand-primary:#FF6258", "--status-success:#28B875"]) {
  assert.ok(styles.includes(tok), `Token de design system ausente: ${tok}`);
}

// 6. theme-color por tema alinhado aos fundos oficiais.
assert.ok(app.includes("#052B36") && app.includes("#F3F6F7"), "theme-color por tema não aponta para os fundos oficiais");

console.log("v874-identidade-tokens: OK");
