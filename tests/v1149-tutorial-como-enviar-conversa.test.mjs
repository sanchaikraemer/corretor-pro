import fs from "node:fs";
import assert from "node:assert/strict";

// v1149 — pedido do dono pra começar a vender pra corretores de Android: "quando o cliente entrar
// no link do Corretor Pro, ele vai ter que ter uma explicação, alguma forma dele entender, que ele
// abre a conversa, clica nos três pontinhos, vai em mais, daí exportar conversa e seleciona o app".
//
// O caminho já existia em texto corrido na tela de importação — que é justamente o que ninguém lê
// no primeiro uso. Agora são 5 passos ilustrados, um por vez, com o MESMO caminho dos prints dele.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

// ── 1. Os 5 passos existem, na ordem certa e com os nomes REAIS do WhatsApp ────────────────────
const ini = app.indexOf("const CP1149_PASSOS = [");
assert.ok(ini > -1, "os passos existem");
const passos = app.slice(ini, app.indexOf("window.cp1149ComoEnviar"));
for (const [ordem, trecho] of [
  [1, "Abra a conversa do cliente"],
  [2, "Toque nos três pontinhos"],
  [3, "Exportar conversa"],
  [4, "Incluir mídia"],
  [5, "Corretor Pro na lista"]
]) {
  assert.ok(passos.includes(trecho), `o passo ${ordem} precisa citar "${trecho}"`);
}
assert.ok(passos.indexOf("três pontinhos") < passos.indexOf("Exportar conversa"), "a ordem dos passos segue o caminho real");
assert.ok(passos.indexOf("Exportar conversa") < passos.indexOf("Incluir mídia"), "exportar vem antes de incluir mídia");
assert.match(passos, /“Mais”/, "avisa que em alguns celulares a opção está dentro de “Mais”");
assert.match(passos, /áudios/, "explica por que escolher Incluir mídia (os áudios)");

// ── 2. Cada passo tem desenho (não é só texto) ────────────────────────────────────────────────
assert.equal((passos.match(/desenho: cp1149Telinha\(/g) || []).length, 5, "os cinco passos têm ilustração");
assert.match(app, /function cp1149Telinha\(conteudo\)\{/, "o desenho do celular é montado em SVG no próprio app (sem imagem externa)");

// ── 3. Sempre à mão no botão da tela de importação ────────────────────────────────────────────
assert.match(html, /id="btnComoEnviar"[^>]*>▶︎ Como enviar sua conversa \(30 segundos\)</, "o botão existe na tela de importação");
assert.match(app, /qs\("#btnComoEnviar"\)\?\.addEventListener\("click", \(\) => \{ try\{ window\.cp1149ComoEnviar\(0\); \}catch\(_\)\{\} \}\)/,
  "e está ligado ao passo a passo");

// ── 4. Abre sozinho na primeira vez — e só nela ───────────────────────────────────────────────
assert.match(app, /if\(!items\.length\)\{ try\{ window\.cp1149AbrirSePrimeiraVez\?\.\(\); \}catch\(_\)\{\} \}/,
  "abre sozinho pra quem ainda não tem cliente nenhum");
const primeira = app.slice(app.indexOf("window.cp1149AbrirSePrimeiraVez = function(){"));
const blocoPrimeira = primeira.slice(0, primeira.indexOf("\n};"));
assert.match(blocoPrimeira, /localStorage\.getItem\(CP1149_VISTO_KEY\)/, "não repete pra quem já viu");
assert.match(blocoPrimeira, /if\(temLead\)\{ localStorage\.setItem\(CP1149_VISTO_KEY, "1"\); return false; \}/,
  "quem já usa o app não é interrompido");

console.log("v1149-tutorial-como-enviar-conversa: ok");
