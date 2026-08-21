import fs from "node:fs";
import assert from "node:assert/strict";

// v1341 — O NOME QUE O CLIENTE ESCOLHEU NÃO PODE VIRAR HTML.
//
// Item da auditoria: a política de segurança da página (CSP) ainda permite script escrito dentro do
// próprio HTML (`unsafe-inline`), porque o app inteiro é feito de botões com `onclick=` no atributo
// — são 145 deles entre o index.html e o app.js. Tirar isso agora seria reescrever a interface
// inteira de uma vez, e o risco de quebrar botão em produção é grande demais pra valer a pena.
//
// O que dá pra fazer, e é o que importa de verdade: garantir que texto que vem DE FORA não chegue
// ao HTML sem passar por escape. E vindo de fora não é força de expressão — o nome do contato é
// escolhido pelo próprio cliente no WhatsApp dele.
//
// O furo real encontrado na varredura: as INICIAIS do avatar. Elas entram direto no HTML, sem
// escape, e eram "o primeiro caractere de cada palavra do nome". Nome começando com "<" punha um
// "<" solto no meio da página — começo de etiqueta HTML onde deveria haver letra.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// ── 1. As iniciais só podem ser letra ou número ──────────────────────────────────────────────
const cpInitials = eval(`
  ${app.match(/function cpInitials\(name\)\{[\s\S]*?\n\}/)[0]}
  cpInitials;
`);

assert.equal(cpInitials("Vanessa Ribeiro"), "VR", "o caso normal continua igual");
assert.equal(cpInitials("João"), "J");
assert.equal(cpInitials("3M Corp"), "3C", "número é inicial legítima de nome de empresa");
assert.equal(cpInitials(""), "C", "sem nome, o avatar continua sendo 'C' de cliente");
assert.equal(cpInitials("   "), "C");

for (const nomeMalicioso of [
  "<img src=x onerror=alert(1)>",
  "<script>alert(1)</script>",
  '"><b>oi</b>',
  "?!"
]) {
  const iniciais = cpInitials(nomeMalicioso);
  assert.ok(!/[<>&"'/]/.test(iniciais),
    `as iniciais de ${JSON.stringify(nomeMalicioso)} não podem conter caractere de HTML — vieram "${iniciais}"`);
}

// ── 2. Onde as iniciais são usadas, continua sendo dentro de um <span>, não num atributo ─────
// (num atributo, mesmo só letra e número, ainda daria pra fechar aspas — por isso a checagem.)
for (const linha of app.split("\n")) {
  if (!linha.includes("cpInitials(")) continue;
  assert.ok(!/=["'][^"']*\$\{cpInitials\(/.test(linha),
    `cpInitials não pode ser interpolado dentro de um atributo HTML: ${linha.trim().slice(0, 120)}`);
}

// ── 3. A cor do avatar sai de uma paleta fixa, nunca do nome ─────────────────────────────────
// Ela vai pra dentro de style="...", que é o outro lugar por onde um nome poderia escapar.
const avatarStyle = app.match(/function cpAvatarStyle\(name\)\{[\s\S]*?\n\}/)[0];
assert.match(avatarStyle, /palette\[h%palette\.length\]/,
  "a cor do avatar precisa vir da paleta, escolhida por um número — nunca do texto do nome");
assert.ok(!/\$\{\s*name\s*\}/.test(avatarStyle),
  "o nome não pode aparecer dentro do style do avatar");

console.log("v1341-nome-de-cliente-nao-vira-html: ok");
