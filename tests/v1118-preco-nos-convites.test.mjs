// v1118 — o preço da assinatura passa a aparecer no convite quando o corretor bate no limite
// (api/_pipeline.js) e na tela de "teste acabou" (entrar.html), com botão pro WhatsApp comercial.
// Preço definido no servidor com override por env; a tela de login usa os mesmos valores. Teste
// estático (lê o texto-fonte) — protege contra sumiço do preço/botão.
// v1199 — preço recalibrado: Pro R$ 49,90 e Pro Master R$ 99,90 (era R$ 67/R$ 97 desde 03/08).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ler = (f) => readFileSync(path.join(raiz, f), "utf8");

const pipeline = ler("api/_pipeline.js");
const entrar = ler("entrar.html");

// --- servidor: preço definido, com override por env, e helper de formatação ---
assert.match(pipeline, /const PRECOS_PLANOS = \{ "pro": 49\.9, "pro-master": 99\.9 \}/, "preços Pro/Pro Master definidos");
assert.match(pipeline, /CORRETOR_PRO_PRECO_PROMASTER/, "preço do Pro Master ajustável por env");
assert.match(pipeline, /CORRETOR_PRO_PRECO_PRO\b/, "preço do Pro ajustável por env");
assert.match(pipeline, /export function precoPlanoBR/, "helper precoPlanoBR precisa existir");
// o preço entra no convite do teste e no convite do Pro→Pro Master
assert.match(pipeline, /Pro por \$\{precoPlanoBR\("pro"\)\}\/mês ou Pro Master por \$\{precoPlanoBR\("pro-master"\)\}\/mês/,
  "convite do teste precisa mostrar os dois preços");
assert.match(pipeline, /O Pro Master tem o dobro por \$\{precoPlanoBR\("pro-master"\)\}\/mês/,
  "convite do Pro precisa mostrar o preço do Pro Master");

// --- tela de teste vencido (entrar.html): preço + botão de WhatsApp ---
assert.match(entrar, /R\$ 49,90\/mês/, "tela de teste acabado precisa mostrar o preço do Pro");
assert.match(entrar, /R\$ 99,90\/mês/, "tela de teste acabado precisa mostrar o preço do Pro Master");
assert.match(entrar, /https:\/\/wa\.me\/\$\{zap\}\?text=\$\{textoZap\}/, "precisa do botão de WhatsApp com mensagem pronta");
assert.match(entrar, /botao-zap-teste/, "o botão precisa da classe de estilo");
// o nome (vem do banco) tem que ser escapado antes de ir pro innerHTML
assert.match(entrar, /nomeSeguro = String\(minhaEmpresa\.nome[\s\S]*?replace\(\/\[&<>"']\/g/, "o nome precisa ser escapado antes do innerHTML");

console.log("v1118-preco-nos-convites: ok");
