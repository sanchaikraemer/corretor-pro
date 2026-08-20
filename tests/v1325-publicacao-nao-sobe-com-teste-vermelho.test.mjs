import fs from "node:fs";
import assert from "node:assert/strict";

// v1325 — TESTE VERMELHO NÃO VAI PRO AR.
//
// Auditoria de 20/08/2026: "o CI executa, mas NÃO bloqueia o merge; push em main faz a Vercel
// publicar automaticamente. Ou seja: teste vermelho ≠ produção bloqueada."
//
// O bloqueio foi posto no ponto que ninguém contorna sem querer: a própria publicação. A Vercel
// passa a publicar com `npm test && node build.js` — suíte vermelha derruba o build e a versão
// anterior continua no ar. (O clique que falta, marcar o check como obrigatório no GitHub, é do
// dono e está escrito em ESTADO-ATUAL.md, seção 5-C.)
//
// Esta guarda existe porque a linha do vercel.json é fácil de "simplificar" sem perceber o que ela
// está segurando.

const raiz = new URL("../", import.meta.url);
const vercel = JSON.parse(fs.readFileSync(new URL("vercel.json", raiz), "utf8"));

assert.match(vercel.buildCommand, /npm test\s*&&/,
  "a publicação precisa rodar a suíte ANTES de construir: sem isso, código com teste vermelho vai pro ar");
assert.match(vercel.buildCommand, /node build\.js/, "e precisa continuar construindo o app depois");
assert.match(vercel.installCommand, /--include=dev/,
  "sem as dependências de desenvolvimento (acorn), as guardas de código morto quebram na publicação");

const ci = fs.readFileSync(new URL(".github/workflows/ci.yml", raiz), "utf8");
assert.match(ci, /name:\s*testes/, "o job precisa se chamar 'testes' — é esse nome que o GitHub marca como obrigatório");
assert.match(ci, /pull_request/, "a suíte precisa rodar no PR");
assert.match(ci, /npm test/, "e precisa rodar a suíte de verdade");

const doc = fs.readFileSync(new URL("ESTADO-ATUAL.md", raiz), "utf8");
assert.match(doc, /suíte vermelha não vai pro ar/i, "o processo de publicação precisa estar documentado");
assert.match(doc, /Require status checks to pass before merging/,
  "e o passo que depende do dono precisa estar escrito, com o caminho dos cliques");

console.log("v1325-publicacao-nao-sobe-com-teste-vermelho: ok");
