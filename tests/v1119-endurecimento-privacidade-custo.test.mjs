// v1119 — lote de endurecimento vindo da auditoria (minha + parecer externo):
//   1) Privacidade: o telefone do cliente NÃO vai mais pra OpenAI (contradizia a política).
//   2) Fuso: o teto DIÁRIO de análises vira à meia-noite de Brasília (antes usava UTC → virava 21h).
//   3) Custo: transcrição de importação com concorrência limitada e teto diário (antes: ilimitada).
// Teste estático (lê o texto-fonte) — protege contra o retorno silencioso de qualquer um deles.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ler = (f) => readFileSync(path.join(raiz, f), "utf8");
const pipeline = ler("api/_pipeline.js");
const storage = ler("api/processar-storage.js");

// ── 1. Privacidade: telefone fora do prompt ────────────────────────────────────────────────
// O objeto do lead que vai pro modelo (leadIA) não pode mais conter telefone.
const leadIABloco = pipeline.match(/const leadIA = \{[\s\S]*?\};/);
assert.ok(leadIABloco, "leadIA precisa existir");
assert.doesNotMatch(leadIABloco[0], /telefone|phone/, "o telefone NÃO pode ir no objeto enviado à IA");
assert.match(leadIABloco[0], /nomeContato/, "leadIA ainda leva o nome do contato");

// ── 2. Fuso do teto diário ─────────────────────────────────────────────────────────────────
assert.match(pipeline, /function diaCalendarioSP\(\)\s*\{[\s\S]*?America\/Sao_Paulo/, "precisa do helper de data de Brasília");
// os dois contadores de limite usam a data de Brasília, não mais toISOString (UTC)
const ocorrenciasDia = (pipeline.match(/const hojeStr = diaCalendarioSP\(\);/g) || []).length;
assert.ok(ocorrenciasDia >= 2, "os dois contadores de limite precisam usar diaCalendarioSP");
assert.doesNotMatch(pipeline, /const hojeStr = new Date\(\)\.toISOString\(\)\.slice\(0, 10\);/,
  "nenhum contador de limite pode mais usar a data UTC");

// ── 3a. Transcrição com concorrência limitada ──────────────────────────────────────────────
assert.match(pipeline, /function mapComLimiteConcorrencia/, "precisa do pool de concorrência");
assert.match(pipeline, /transcricaoConcorrencia\(\)/, "a transcrição precisa usar o limite de concorrência");
assert.doesNotMatch(pipeline, /await Promise\.all\(entradas\.map\(async item =>/,
  "a transcrição não pode mais abrir todos os áudios de uma vez (Promise.all sem teto)");

// ── 3b. Teto diário de transcrição de importação ───────────────────────────────────────────
assert.match(pipeline, /export async function verificarLimiteTranscricaoImport/, "precisa da checagem de teto de transcrição");
assert.match(pipeline, /export async function registrarConsumoTranscricaoImport/, "precisa registrar o consumo de transcrição");
assert.match(pipeline, /LIMITE_TRANSCRICAO_IMPORT_DIA_TESTE_PADRAO = 80/, "teste grátis tem teto menor de transcrição");
assert.match(pipeline, /LIMITE_TRANSCRICAO_IMPORT_DIA_PADRAO = 600/, "conta paga tem teto generoso de transcrição");
assert.match(pipeline, /CORRETOR_PRO_LIMITE_TRANSCRICAO_IMPORT_DIA/, "teto de transcrição ajustável por ambiente");
// conta original fica de fora do teto (usa o fusível geral)
assert.match(pipeline, /verificarLimiteTranscricaoImport[\s\S]*?EMPRESA_PRINCIPAL_ID[\s\S]*?return aberto/, "conta original fica fora do teto de transcrição");

// ── 3c. A rota de transcrição está ligada no teto ──────────────────────────────────────────
assert.match(storage, /verificarLimiteTranscricaoImport,\s*\n\s*registrarConsumoTranscricaoImport/, "a rota importa as duas funções");
assert.match(storage, /arquivos\.length = Math\.max\(0, limiteTranscricao\.restante\)/, "a rota corta o excedente do dia antes de gastar Whisper");
assert.match(storage, /filter\(t => t\?\.status === "transcrito"\)\.length/, "a rota conta só o que foi transcrito de verdade");
assert.match(storage, /registrarConsumoTranscricaoImport\(organizationId, transcritosAgora\)/, "a rota registra o consumo real");

// ── 4. Política de privacidade alinhada ao código ──────────────────────────────────────────
const privacidade = ler("privacidade.html");
// v1164 — esta linha exigia a frase "não recebe o telefone do lead". A auditoria de 07/08/2026
// mostrou que ela é falsa como promessa geral: o campo de telefone da FICHA do lead realmente sai
// (v1119, e o teste disso está logo abaixo, no código), mas o TEXTO da conversa vai inteiro pra
// IA — telefone escrito numa mensagem vai junto. A promessa virou a descrição honesta, guardada
// agora em tests/v1164-politica-de-privacidade-fiel.test.mjs. O que continua sendo exigido aqui é
// que a política descreva a ficha sem telefone, sem prometer nada além disso.
assert.match(privacidade, /ficha do lead[\s\S]{0,120}?sem o campo de telefone/i,
  "a política precisa dizer que a ficha do lead é enviada sem o campo de telefone");
assert.match(privacidade, /Vercel/, "a política precisa citar a Vercel como fornecedor de infraestrutura");
assert.match(privacidade, /Imagens, vídeos e documentos[\s\S]*?não são analisados/, "a política precisa dizer que imagem/vídeo não são analisados");
assert.doesNotMatch(privacidade, /não fica resquício/, "a política não pode mais prometer 'sem resquício' (remoção de arquivos é best-effort)");

// ── 5. Painel mostra aviso de exclusão parcial ─────────────────────────────────────────────
const admin = ler("admin-plataforma.html");
assert.match(admin, /r\.aviso \? `\\n\\n⚠️ \$\{r\.aviso\}`/, "o painel precisa mostrar o aviso de exclusão parcial");

console.log("v1119-endurecimento-privacidade-custo: ok");
