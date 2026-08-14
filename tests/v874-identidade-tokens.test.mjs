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
// v1046: a lógica de tema saiu de app.js para js/tema.js.
// v1268: o tema claro foi removido do sistema por ordem do dono — js/tema.js deixou de existir e
// o app tem UM tema só (escuro), fixo no <html>. As verificações do tema claro saíram junto.

// 1. O coral antigo e os petróleos antigos NÃO podem existir em nenhum arquivo publicado.
//    Inclui as três variantes de coral que conviviam (#FF6B5C do :root legado e #FF5B50/#FF704F
//    da "camada final #657") e os petróleos inconsistentes (#001E2B do boot, #001A25 da cp).
const antigos = /#ff6b5c|#ff6257|#ff5b50|#ff704f|255\s*,\s*107\s*,\s*92|255\s*,\s*91\s*,\s*80|#001e2b|#001a25/i;
for (const [nome, txt] of [["styles.css", styles], ["index.html", index], ["app.js", app], ["service-worker.js", sw]]) {
  assert.ok(!antigos.test(txt), `Identidade antiga (coral #FF6B5C/#FF5B50 ou petróleo #001E2B/#001A25) reapareceu em ${nome}`);
}

// 2. Coral oficial presente.
assert.ok(/#FF6258/i.test(styles), "Coral oficial #FF6258 ausente em styles.css");

// 2b. A camada que REALMENTE renderiza (cp #657) precisa carregar a paleta oficial.
assert.ok(styles.includes("--cp-bg:#052B36"), "Camada cp dark não usa o fundo oficial #052B36");
assert.ok(styles.includes("--cp-panel:#0D3946"), "Camada cp dark não usa a superfície oficial #0D3946");
assert.ok(styles.includes("--cp-coral:#FF6258"), "Camada cp não usa o coral oficial #FF6258");

// 3. Paleta DARK PREMIUM oficial nos tokens de tema.
assert.ok(/html\[data-theme="dark"\]\{[\s\S]*?--bg:\s*#052B36/i.test(styles), "Fundo dark oficial #052B36 ausente");
assert.ok(/html\[data-theme="dark"\]\{[\s\S]*?--panel:\s*#0D3946/i.test(styles), "Superfície dark oficial #0D3946 ausente");
assert.ok(/html\[data-theme="dark"\]\{[\s\S]*?--text:\s*#F7FAFB/i.test(styles), "Texto dark oficial #F7FAFB ausente");

// 4. v1268 — o tema claro saiu do sistema: não pode voltar nem no CSS, nem na tela, nem em módulo.
assert.ok(!/data-theme="light"/.test(styles), "o tema claro não pode voltar ao CSS");
assert.ok(!/data-theme-choice|theme-option|direciona_tema/.test(index), "o seletor de tema não pode voltar à tela");
// (o comentário do service-worker cita o arquivo removido de propósito — a varredura olha código)
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
assert.ok(!/tema\.js/.test(semComentarios(app) + semComentarios(sw)), "js/tema.js foi removido — nada pode voltar a importá-lo");

// 5. Tokens de escala do design system.
// v1216 — --status-success deixou de ser o verde #28B875 e passou a apontar pro token de
// confirmação (--acao, o ciano da identidade); o token continua existindo, só mudou de cor.
for (const tok of ["--space-4:16px", "--radius-lg:16px", "--control-height-md:44px", "--font-size-base:15px", "--brand-primary:#FF6258", "--status-success:var(--acao)"]) {
  assert.ok(styles.includes(tok), `Token de design system ausente: ${tok}`);
}

// 6. O theme-color da barra do navegador é fixo no fundo oficial do tema único.
assert.ok(/<meta name="theme-color" content="#052B36">/.test(index), "theme-color precisa ser o fundo oficial #052B36");
assert.ok(/<html lang="pt-BR" data-theme="dark"/.test(index), "o tema escuro é fixo no <html> (não depende mais de script)");

console.log("v874-identidade-tokens: OK");
