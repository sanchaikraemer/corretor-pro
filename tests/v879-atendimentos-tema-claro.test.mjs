// v879 — Tema claro: superfícies e textos da tela Atendimentos.
// Doc seção 26: não deixar overlay/loading destruir o contraste.
// A tela de Atendimentos usa as classes cp788-*, que tinham fundo petróleo translúcido
// (rgba(7,52,64,.58)) sem override no tema claro — isso virava um véu cinza sobre o fundo branco.
//
// v1186 — REESCRITO. A v908 refez esta tela: ela deixou de listar cards (`cp788-att-list`,
// `cp788-att-row`, `cp788-att-copy`, `cp788-att-time`, `cp788-att-more`, `cp788-meta-card`) e
// virou o painel por dia (prédio + nomes do dia). O CSS dos elementos antigos ficou no arquivo,
// sem ninguém desenhar, e este teste seguiu exigindo override de tema claro pra eles — cobrindo
// superfícies que não existem mais. A auditoria de 09/08/2026 removeu esse CSS morto.
//
// A regra do dono não mudou: no tema claro, NENHUMA superfície desta tela pode ficar com o fundo
// petróleo translúcido. O que muda é onde ela é conferida — agora nos elementos que a tela
// realmente desenha.

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const styles = readFileSync(join(raiz, "styles.css"), "utf8");
const app = readFileSync(join(raiz, "app.js"), "utf8");

// ── 1. As superfícies que a tela desenha hoje têm override no tema claro ─────────────────────
const desenhadas = ['cp788-att-page', 'cp788-att-head', 'cp788-day', 'cp788-att-empty', 'cp788-att-loading'];
for (const classe of desenhadas) {
  assert.ok(app.includes(classe), `sanidade: a tela precisa desenhar .${classe}`);
}
assert.ok(
  /html\[data-theme="light"\] \.cp788-day\b/.test(styles),
  "Falta override de tema claro para o cartão do dia (.cp788-day) — sem ele fica o véu cinza do petróleo"
);
assert.ok(/html\[data-theme="light"\] \.cp788-att-empty/.test(styles), "Falta override light para .cp788-att-empty");

// ── 2. Nenhuma regra de tema claro desta tela pode manter fundo petróleo translúcido ─────────
const regrasClaras = (styles.match(/html\[data-theme="light"\][^{]*\.cp788-[^{]*\{[^}]*\}/g) || []);
assert.ok(regrasClaras.length >= 2, "sanidade: a tela precisa ter overrides de tema claro");
for (const regra of regrasClaras) {
  assert.ok(!/background:\s*rgba\(7,\s*52,\s*64/i.test(regra),
    `no tema claro nenhuma superfície desta tela pode ficar petróleo: ${regra.slice(0, 90)}`);
}

// ── 3. O CSS dos cards antigos não pode voltar sem tela que o use ────────────────────────────
for (const morta of ['cp788-att-list', 'cp788-att-copy', 'cp788-att-time', 'cp788-att-more', 'cp788-meta-card']) {
  assert.ok(!styles.includes(morta),
    `${morta} saiu na v908/v1186 — se a tela voltar a listar cards, o override de tema claro volta junto`);
}

console.log("v879-atendimentos-tema-claro: OK");
