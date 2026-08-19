import fs from "node:fs";
import assert from "node:assert/strict";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const inicio = pipeline.indexOf("export async function analyzeWithBrain");
// v1194 — o marcador de fim era compararEvolucao, removida por não ter chamador; o vizinho
// seguinte de analyzeWithBrain agora é getOpenAIRaw.
const fim = pipeline.indexOf("export function getOpenAIRaw", inicio);
const bloco = pipeline.slice(inicio, fim);
// v946: chamarGPT4Json passou a rodar com retry de TRANSPORTE (erro transitório de rede/API tipo
// 429/5xx/timeout). Isso é diferente do padrão que este teste protege (reprompt pedindo pra IA se
// "autocorrigir" quando o CONTEÚDO da resposta vem errado).
// v1140: o retry de transporte virou um fallback explícito — se a 1ª chamada falha POR INTEIRO
// (timeout/429/5xx), UMA segunda roda com o MESMO prompt no modelo rápido, dentro do orçamento de
// tempo (ver v947/v1140). Continua não existindo reprompt de conteúdo: nenhuma das duas chamadas
// reinterpreta ou "corrige" resposta — são no máximo 2 tentativas de conseguir UMA análise.
// v1308: viraram TRÊS pontos de chamada, e nenhum deles é reprompt de conteúdo — que é o que este
// teste sempre protegeu. São, na ordem: (1) a chamada principal; (2) a repetição no MESMO modelo,
// só para erro passageiro da OpenAI; (3) a única troca de modelo que sobrou, para quando o modelo
// configurado NÃO EXISTE nesta conta — e mesmo essa aparece em vermelho na tela.
assert.equal((bloco.match(/chamarGPT4Json\(/g) || []).length, 3,
  "exatamente 3 pontos de chamada: principal, repetição por erro passageiro e o caso de modelo indisponível — nunca um laço de correção");
assert.equal((bloco.match(/systemPrompt: systemPromptAnalise,[\s\S]{0,40}prompt,/g) || []).length, 3,
  "as três tentativas usam o MESMO prompt (transporte/disponibilidade, nunca reprompt de conteúdo)");
assert.match(bloco, /if \(!r\) \{/, "o fallback só roda quando a 1ª tentativa falhou por inteiro");
assert.doesNotMatch(bloco, /while\s*\(!validacaoMensagens/);
assert.doesNotMatch(bloco, /promptRetry|modeloAnaliseRapida|correção automática/i);
// v1291 — a revisão silenciosa continua existindo, com outro título ("REVISÃO FINAL SILENCIOSA",
// no fim do pedido). O que este teste guarda é que ela é revisão da própria IA, não uma segunda
// rodada de chamadas corrigindo a primeira.
assert.match(bloco, /REVISÃO FINAL SILENCIOSA/);

console.log("v827-18-resgate-mensagens-ia: ok");
