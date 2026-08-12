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
// v1235: passou a existir um TERCEIRO ponto de chamada — a releitura das três mensagens quando a
// conferência local (conferirTrioMensagens) encontra frase proibida ou ação suspeita. Ele NÃO é o
// padrão que este teste nasceu pra proibir, e a diferença é o que os asserts abaixo trancam:
//   • o padrão banido era um LAÇO (corrigirMensagensPelasRegras rodava 2x) atrás de uma regra de
//     FORMATAÇÃO ("exatamente uma pergunta, no fim") que, ao não ser satisfeita, DESCARTAVA o
//     rascunho bom da IA e entregava texto genérico. O prejuízo era duplo: tempo e conteúdo.
//   • a releitura da v1235 roda NO MÁXIMO UMA VEZ, só quando há apontamento, cabe no orçamento de
//     tempo que já existia, e NUNCA descarta nada: se ela falhar, demorar ou voltar pior, valem as
//     mensagens originais. Ela não persegue formatação — persegue as regras de CONTEÚDO que o
//     próprio prompt já declara e que o modelo ignorou (prints do dono em 12/08/2026).
assert.equal((bloco.match(/chamarGPT4Json\(/g) || []).length, 3,
  "3 pontos de chamada: a principal, o fallback de transporte e a releitura única das mensagens");
assert.equal((bloco.match(/systemPrompt: systemPromptAnalise,[\s\S]{0,40}prompt,/g) || []).length, 2,
  "as duas tentativas de ANÁLISE usam o MESMO prompt (fallback de transporte, não reprompt de conteúdo)");
assert.match(bloco, /if \(!r\) \{/, "o fallback só roda quando a 1ª tentativa falhou por inteiro");
assert.doesNotMatch(bloco, /while\s*\(!validacaoMensagens/);
assert.doesNotMatch(bloco, /promptRetry|modeloAnaliseRapida|correção automática/i);
// A releitura continua sendo passagem ÚNICA (nada de laço) e sem poder de descarte.
assert.doesNotMatch(bloco, /while\s*\(!conferencia|for\s*\([^)]*conferirTrioMensagens/,
  "a releitura das mensagens é passagem única — nunca um laço");
assert.match(bloco, /catch \(_\) \{ \/\* a análise continua valendo com as mensagens originais \*\/ \}/,
  "falhar na releitura não pode custar a análise nem as mensagens que já estavam na mão");
assert.match(bloco, /Antes de entregar o resultado, revise silenciosamente/);

console.log("v827-18-resgate-mensagens-ia: ok");
