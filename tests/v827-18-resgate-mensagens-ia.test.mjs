import fs from "node:fs";
import assert from "node:assert/strict";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const inicio = pipeline.indexOf("export async function analyzeWithBrain");
const fim = pipeline.indexOf("export async function compararEvolucao", inicio);
const bloco = pipeline.slice(inicio, fim);
// v946: chamarGPT4Json passou a rodar com retry de TRANSPORTE (erro transitório de rede/API tipo
// 429/5xx/timeout). Isso é diferente do padrão que este teste protege (reprompt pedindo pra IA se
// "autocorrigir" quando o CONTEÚDO da resposta vem errado).
// v1140: o retry de transporte virou um fallback explícito — se a 1ª chamada falha POR INTEIRO
// (timeout/429/5xx), UMA segunda roda com o MESMO prompt no modelo rápido, dentro do orçamento de
// tempo (ver v947/v1140). Continua não existindo reprompt de conteúdo: nenhuma das duas chamadas
// reinterpreta ou "corrige" resposta — são no máximo 2 tentativas de conseguir UMA análise.
assert.equal((bloco.match(/chamarGPT4Json\(/g) || []).length, 2,
  "exatamente 2 pontos de chamada: a principal e o fallback de transporte — nunca um laço de correção");
assert.equal((bloco.match(/systemPrompt: systemPromptAnalise,[\s\S]{0,40}prompt,/g) || []).length, 2,
  "as duas tentativas usam o MESMO prompt (fallback de transporte, não reprompt de conteúdo)");
assert.match(bloco, /if \(!r\) \{/, "o fallback só roda quando a 1ª tentativa falhou por inteiro");
assert.doesNotMatch(bloco, /while\s*\(!validacaoMensagens/);
assert.doesNotMatch(bloco, /promptRetry|modeloAnaliseRapida|correção automática/i);
assert.match(bloco, /Antes de entregar o resultado, revise silenciosamente/);

console.log("v827-18-resgate-mensagens-ia: ok");
