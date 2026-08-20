import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

// v1327 — O PORTEIRO DO PROMPT.
//
// Auditoria de 20/08/2026: "toda mudança no coração da análise deveria exigir um score mínimo da
// bateria comercial antes de produção". E o CLAUDE.md já mandava a mesma coisa em palavras
// ("alteração de prompt entra com antes e depois na mesma conversa real") — só que palavra não
// segura ninguém às 23h de um dia ruim. Agosto de 2026 inteiro foi isso: mexer no prompt, publicar,
// piorar, desfazer.
//
// Como funciona: o miolo do prompt (o piso comercial e as instruções da análise, entre os
// marcadores INÍCIO/FIM DO MIOLO DO PROMPT em api/_pipeline.js) tem uma assinatura registrada em
// evals/assinatura-do-prompt.json, junto com o resultado da última vez que a bateria de conversas
// foi rodada. Mexeu no miolo sem registrar a medição → suíte vermelha → e, desde a v1325, a
// publicação também para (a Vercel publica com `npm test && node build.js`).
//
// Isto NÃO impede mudar o prompt. Impede mudar sem medir.

const raiz = new URL("../", import.meta.url);

export function assinaturaDoMiolo(fonte) {
  const partes = [...String(fonte).matchAll(
    /=====\s*INÍCIO DO MIOLO DO PROMPT[^\n]*=====\n([\s\S]*?)\n\s*\/\/ =====\s*FIM DO MIOLO DO PROMPT/g
  )].map(m => m[1]);
  const texto = partes.join("\n").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  return { partes: partes.length, chars: texto.length, hash: crypto.createHash("sha256").update(texto).digest("hex").slice(0, 32) };
}

const fonte = fs.readFileSync(new URL("api/_pipeline.js", raiz), "utf8");
const atual = assinaturaDoMiolo(fonte);

// ── 1. Os marcadores continuam no lugar ──────────────────────────────────────────────────────
assert.equal(atual.partes, 2,
  "o miolo do prompt precisa continuar cercado por dois pares de marcadores (piso comercial e instruções da análise). Se alguém apagou um marcador, o porteiro para de conferir justo o que importa.");
assert.ok(atual.chars > 15000,
  `o miolo do prompt encolheu demais (${atual.chars} caracteres) — confira se um marcador não foi movido pra dentro do bloco`);

// ── 2. A assinatura registrada bate com o que está no código ─────────────────────────────────
const arquivo = new URL("evals/assinatura-do-prompt.json", raiz);
assert.ok(fs.existsSync(arquivo), "evals/assinatura-do-prompt.json precisa existir — é o registro da última medição");
const registro = JSON.parse(fs.readFileSync(arquivo, "utf8"));

for (const campo of ["assinatura", "medidoEm", "versao", "casos", "resultado"]) {
  assert.ok(registro[campo], `evals/assinatura-do-prompt.json precisa do campo "${campo}"`);
}
assert.match(String(registro.medidoEm), /^\d{2}\/\d{2}\/\d{4}$/, "medidoEm no formato dd/mm/aaaa");
assert.ok(String(registro.resultado).length >= 30,
  "o campo resultado precisa dizer o que a bateria mostrou — uma linha em português, não um 'ok'");

assert.equal(atual.hash, registro.assinatura, [
  "",
  "O MIOLO DO PROMPT MUDOU E A BATERIA NÃO FOI MEDIDA.",
  "",
  "Isto não é um erro de código: é o porteiro da v1327. Antes de publicar mudança no coração da",
  "análise, o caminho é:",
  "",
  "  1. node evals/executar.mjs --salvar=antes      (ANTES de mexer, com a chave da OpenAI)",
  "  2. ... a mudança é feita ...",
  "  3. node evals/executar.mjs --comparar=antes    (depois, e leia o que melhorou e o que piorou)",
  `  4. atualize evals/assinatura-do-prompt.json com a assinatura nova (${atual.hash}),`,
  "     a data, a versão e uma linha dizendo o que a bateria mostrou.",
  "",
  "Atualizar a assinatura sem rodar a bateria é mentir para o próprio projeto — e foi exatamente",
  "assim que agosto virou um vaivém de publicar e desfazer.",
  ""
].join("\n"));

// ── 3. A bateria precisa continuar grande o bastante pra medir alguma coisa ──────────────────
const conversas = fs.readdirSync(new URL("evals/conversas/", raiz)).filter(f => f.endsWith(".json"));
assert.ok(conversas.length >= 30,
  `a auditoria pediu de 30 a 50 conversas canônicas na bateria; hoje há ${conversas.length}`);
assert.equal(Number(registro.casos), conversas.length,
  `o registro diz ${registro.casos} conversas e a pasta tem ${conversas.length} — conversa nova entra na próxima medição`);

console.log(`v1327-porteiro-do-prompt: ok (miolo com ${atual.chars} caracteres, ${conversas.length} conversas na bateria)`);
