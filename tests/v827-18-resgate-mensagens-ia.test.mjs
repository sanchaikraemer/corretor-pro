import fs from "node:fs";
import assert from "node:assert/strict";
import { sanitizarMensagemDeterministica, compilarRegrasObjetivasCerebro } from "../api/_pipeline.js";

// §v827-18: antes desta versão, quando a IA gerava 3 mensagens boas (com conteúdo real
// da conversa) mas só errava a formatação (ex.: pergunta fora do final, ou saudação
// errada), o pipeline jogava esse conteúdo fora inteiro e substituía por um texto 100%
// genérico do fallback determinístico — foi exatamente o caso relatado: a mensagem
// "Como você quer seguir a partir daqui?" no lugar de uma sugestão que referenciasse a
// pergunta real em aberto (pronto x planta). Agora `sanitizarMensagemDeterministica`
// também é usada para CONSERTAR o rascunho real da IA antes de descartá-lo.

const noite = new Date("2026-07-15T21:16:00Z"); // ~18h em America/Sao_Paulo -> Boa noite
const regras = compilarRegrasObjetivasCerebro({}, noite);

// Regressão direta do bug introduzido ao reaproveitar esta função para rascunhos reais
// da IA: antes, só MAIS de uma "?" era cortada — uma única "?" fora do final escapava
// ilesa e ganhava uma segunda "?" ao final, virando duas (reprovando de novo à toa).
const foraDoFinal = sanitizarMensagemDeterministica(
  "Perguntei se prefere pronto ou na planta? Me conta um pouco mais sobre seu momento.",
  regras,
  noite
);
assert.equal((foraDoFinal.match(/\?/g) || []).length, 1, "deve sobrar exatamente uma interrogação");
assert.match(foraDoFinal, /\?$/, "a única interrogação deve ficar no final");

// Um rascunho da IA já pode vir com saudação própria (certa ou não) — não pode duplicar.
const comSaudacaoPropria = sanitizarMensagemDeterministica(
  "Boa noite, Rudi! Voltando ao Renaissance, você já decidiu entre pronto ou na planta",
  regras,
  noite
);
assert.equal((comSaudacaoPropria.match(/boa noite/gi) || []).length, 1, "não pode duplicar a saudação já presente no rascunho da IA");
assert.match(comSaudacaoPropria, /\?$/, "continua terminando com uma única pergunta");

// Conteúdo específico da IA (o nome do cliente, o produto, a pergunta real) precisa
// sobreviver ao reparo — não pode ter sido substituído por texto genérico.
assert.match(comSaudacaoPropria, /Rudi/, "mantém o conteúdo real da IA, não troca por template genérico");
assert.match(comSaudacaoPropria, /Renaissance/, "mantém a referência real ao produto/assunto da conversa");

// A ordem no pipeline importa: só cai no fallback 100% mecânico se o reparo de
// formatação do rascunho real da IA (reparadas/validacaoReparo) não bastar.
const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const idxReparo = pipeline.indexOf("validacaoReparo");
const idxFallbackDet = pipeline.indexOf("construirMensagensDeterministicasCerebro({\n          contextoTemporal, timeline: timelineArr, diagnostico: d, produtoAtual");
assert.ok(idxReparo > -1, "o pipeline precisa tentar reparar o rascunho da IA antes do fallback genérico");
assert.ok(idxFallbackDet > -1, "o fallback genérico precisa continuar existindo como último recurso");
assert.ok(idxReparo < idxFallbackDet, "a tentativa de reparo precisa vir ANTES do fallback 100% genérico");

console.log("v827-18-resgate-mensagens-ia: ok");
