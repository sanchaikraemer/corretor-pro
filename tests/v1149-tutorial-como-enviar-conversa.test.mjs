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
// v1272 — a lista virou DUAS (Android e iPhone), porque o caminho do iPhone é outro. Este teste
// continua guardando a do Android; a do iPhone tem teste próprio em v1272-*.
const ini = app.indexOf("const CP1149_PASSOS_ANDROID = [");
assert.ok(ini > -1, "os passos existem");
const passos = app.slice(ini, app.indexOf("const CP1149_PASSOS_IOS = ["));
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
assert.equal((passos.match(/desenho: cp1149Telinha\(/g) || []).length, 6, "os seis passos têm ilustração");

// ── 1b. O passo do "e se não aparecer o ícone?" (v1152) ────────────────────────────────────────
// Pergunta do dono no primeiro teste com conta nova. Acontece de verdade: o Android só oferece na
// lista de compartilhar quem está INSTALADO — e o jeito 2 precisa funcionar mesmo sem instalar.
assert.ok(passos.includes("Não apareceu o Corretor Pro na lista?"), "existe o passo do ícone que não aparece");
// v1153 — o texto desse passo é montado NA HORA (depende do aparelho de quem lê), então mora numa
// função. Mandar procurar um botão que pode não existir era beco sem saída ("mas não apareceu onde
// baixar pra mim").
assert.match(passos, /texto: cp1149TextoInstalar,/, "o texto do passo depende do aparelho");
const inst = app.slice(app.indexOf("function cp1149TextoInstalar(){"));
const blocoInst = inst.slice(0, inst.indexOf("\n}"));
assert.match(blocoInst, /cpAppJaInstalado/, "sabe se o app já está instalado");
assert.match(blocoInst, /cpTemConviteInstalar/, "sabe se dá pra instalar agora");
assert.match(blocoInst, /id="cp1149Instalar"/, "quando dá, oferece o botão que instala na hora");
assert.match(blocoInst, /cpDicaInstalarTexto/, "quando não dá, mostra o caminho manual do aparelho");
assert.match(blocoInst, /Você já está com o app <b>instalado<\/b>/, "quem já instalou não é mandado instalar de novo");
assert.match(blocoInst, /“Escolher o arquivo da conversa”/, "e sempre sobra a saída que funciona sem instalar");
assert.match(app, /card\.querySelector\("#cp1149Instalar"\)\?\.addEventListener\("click", async \(\) => \{/,
  "o botão de instalar está ligado de verdade");
const pwa = fs.readFileSync(new URL("../js/pwa-install.js", import.meta.url), "utf8");
for (const nome of ["cpInstalarApp", "cpDicaInstalarTexto", "cpTemConviteInstalar", "cpAppJaInstalado"]) {
  assert.ok(pwa.includes(`window.${nome}`), `pwa-install.js precisa expor ${nome} pro tutorial`);
}
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
assert.match(blocoPrimeira, /localStorage\.getItem\(cp1149VistoKey\(\)\)/, "não repete pra quem já viu");
assert.match(blocoPrimeira, /if\(temLead\)\{ localStorage\.setItem\(cp1149VistoKey\(\), "1"\); return false; \}/,
  "quem já usa o app não é interrompido");

// ── 5. A marca de "já vi" é POR CONTA, não por aparelho (v1150) ────────────────────────────────
// O dono vai criar contas de teste NO MESMO CELULAR. Se a marca fosse do aparelho, o segundo
// corretor nunca veria o passo a passo — justamente o que o teste precisa validar.
assert.match(app, /function cp1149VistoKey\(\)\{[\s\S]*?corretor_pro_tutorial_envio_visto:\$\{conta\}/,
  "a chave inclui a conta logada");
assert.match(app, /window\.__cpContaId = String\(data\.session\.user\.id \|\| ""\)/,
  "o app guarda quem está logado pra montar essa chave");

console.log("v1149-tutorial-como-enviar-conversa: ok");
