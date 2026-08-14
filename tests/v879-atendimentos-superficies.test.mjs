// v879 — superfícies da tela Atendimentos.
//
// Nasceu como "tema claro: superfícies e textos da tela Atendimentos" (doc seção 26: não deixar
// overlay/loading destruir o contraste). A tela usa as classes cp788-*, que tinham fundo petróleo
// translúcido sem override no tema claro — virava um véu cinza sobre o fundo branco.
//
// v1186 — reescrito depois que a v908 refez a tela (deixou de listar cards e virou o painel por
// dia): o CSS dos elementos antigos tinha ficado no arquivo sem ninguém desenhar.
//
// v1268 — O TEMA CLARO SAIU DO SISTEMA (ordem do dono). As checagens de override não têm mais o que
// verificar e saíram. O que sobrevive é a parte que continua valendo e que já pegou lixo antes: a
// tela precisa desenhar as classes que diz desenhar, e CSS de tela morta não pode voltar a se
// acumular no arquivo.

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const styles = readFileSync(join(raiz, "styles.css"), "utf8");
const app = readFileSync(join(raiz, "app.js"), "utf8");

// ── 1. As superfícies que a tela desenha hoje existem de verdade ──────────────────────────────
for (const classe of ['cp788-att-page', 'cp788-att-head', 'cp788-day', 'cp788-att-empty', 'cp788-att-loading']) {
  assert.ok(app.includes(classe), `a tela precisa desenhar .${classe}`);
}

// ── 2. O CSS dos cards antigos não pode voltar sem tela que o use ─────────────────────────────
for (const morta of ['cp788-att-list', 'cp788-att-copy', 'cp788-att-time', 'cp788-att-more', 'cp788-meta-card']) {
  assert.ok(!styles.includes(morta), `${morta} saiu na v908/v1186 — CSS sem tela que o desenhe não volta`);
}

// ── 3. E o tema claro não volta por esta porta ────────────────────────────────────────────────
assert.ok(!/data-theme="light"/.test(styles), "o tema claro não pode voltar ao CSS (v1268)");

console.log("v879-atendimentos-superficies: OK");
