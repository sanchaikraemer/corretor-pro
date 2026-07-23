import fs from "node:fs";
import assert from "node:assert/strict";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const inicio = pipeline.indexOf("export async function analyzeWithBrain");
const fim = pipeline.indexOf("export async function compararEvolucao", inicio);
const bloco = pipeline.slice(inicio, fim);
// v946: chamarGPT4Json passou a rodar dentro de withRetries (retry de TRANSPORTE — erro
// transitório de rede/API tipo 429/5xx/timeout, reusando o mesmo helper já usado na transcrição).
// Isso é diferente do padrão que este teste protege (reprompt pedindo pra IA se "autocorrigir"
// quando o CONTEÚDO da resposta vem errado) — continua havendo só 1 chamada real à IA por análise.
assert.equal((bloco.match(/chamarGPT4Json\(/g) || []).length, 1, "analyzeWithBrain deve chamar a IA (chamarGPT4Json) uma única vez");
assert.match(bloco, /await withRetries\(\(\) => chamarGPT4Json\(/, "a única chamada usa withRetries (retry de transporte, não correção de prompt)");
assert.doesNotMatch(bloco, /while\s*\(!validacaoMensagens/);
assert.doesNotMatch(bloco, /promptRetry|modeloAnaliseRapida|correção automática/i);
assert.match(bloco, /Antes de entregar o resultado, revise silenciosamente/);

console.log("v827-18-resgate-mensagens-ia: ok");
