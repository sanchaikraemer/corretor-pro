import fs from "node:fs";
import assert from "node:assert/strict";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const inicio = pipeline.indexOf("export async function analyzeWithBrain");
const fim = pipeline.indexOf("export async function compararEvolucao", inicio);
const bloco = pipeline.slice(inicio, fim);
assert.equal((bloco.match(/await chamarGPT4Json\(/g) || []).length, 1, "analyzeWithBrain deve chamar a IA uma única vez");
assert.doesNotMatch(bloco, /while\s*\(!validacaoMensagens/);
assert.doesNotMatch(bloco, /promptRetry|modeloAnaliseRapida|correção automática/i);
assert.match(bloco, /Antes de entregar o resultado, revise silenciosamente/);

console.log("v827-18-resgate-mensagens-ia: ok");
