// v875 — Identidade Visual v2.0 (Etapa 2: componentes / boot theme-aware)
// Garante que os gradientes decorativos que o documento manda remover não voltem
// (coral+azul e coral+verde em botões, "mancha" de seleção, banner, brilho ambiente)
// e que o boot no-flash pinta o fundo oficial antes de qualquer coisa aparecer.
// v1268 — o tema claro saiu do sistema: o boot deixou de escolher paleta (e as variáveis
// --boot-* deixaram de existir, já que só serviam pra essa troca). Fica a cor oficial, direta.

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (f) => readFileSync(join(raiz, f), "utf8");

const styles = ler("styles.css");
const app = ler("app.js");
const index = ler("index.html");

// 1. Boot no-flash com o fundo oficial (Identidade v2.0, seção 33).
assert.ok(/html,body\{[^}]*background:#052B36/.test(index), "html/body do boot não pinta o petróleo oficial #052B36");
assert.ok(index.includes('id="bootPaint"'), "a tela de boot (que evita o branco ao abrir) sumiu");
assert.ok(!index.includes("--boot-bg"), "v1268: a variável de boot não volta — o tema é um só");
assert.ok(!/#F3F6F7/.test(index), "v1268: o branco-gelo do tema claro não pode voltar ao boot");

// 2. Botões não podem ter gradiente coral+azul nem coral+verde (seções 5, 10, 12).
assert.ok(!/linear-gradient\([^)]*var\(--lime\)[^)]*var\(--cyan\)/.test(app), "Sobrou gradiente coral+azul em botão (app.js)");
assert.ok(!/linear-gradient\([^)]*var\(--lime\)[^)]*var\(--acao\)/.test(app), "Sobrou gradiente coral+verde em botão (app.js)");
assert.ok(!/linear-gradient\([^)]*var\(--accent\)[^)]*var\(--cyan\)/.test(app), "Sobrou gradiente coral+azul (accent) em botão (app.js)");

// 3. Sem brilho ambiente decorativo no body (seção 2/9: clareza antes de ornamentação).
assert.ok(!/body\{[\s\S]{0,120}radial-gradient/.test(styles), "Body ainda tem gradiente ambiente decorativo");

// 4. Banner de instalação chapado (sem gradiente) e menos proeminente (seção 23).
assert.ok(!/cp-install-banner\{[^}]*linear-gradient/.test(styles), "Banner de instalação ainda usa gradiente");

// 5. Nenhum quarto tom de coral perdido em sombra (255,82,72 era um coral solto).
assert.ok(!/255\s*,\s*82\s*,\s*72/.test(styles), "Coral solto 255,82,72 reapareceu em styles.css");

// 6. Seleção sem "mancha": KPI/sidebar ativos não usam gradiente coral.
assert.ok(!/sb-item\.active\{background:linear-gradient/.test(styles), "Item de sidebar ativo ainda usa gradiente (mancha)");
assert.ok(!/ui-kpi\.active\{background:linear-gradient/.test(styles), "KPI ativo ainda usa gradiente (mancha)");

console.log("v875-componentes-sem-gradiente: OK");
