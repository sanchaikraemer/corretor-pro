import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const pipeline = fs.readFileSync(new URL('../api/_pipeline.js', import.meta.url), 'utf8');
const persistence = fs.readFileSync(new URL('../api/_persistence.js', import.meta.url), 'utf8');

// v936 — dois problemas reportados pelo dono depois da v934/v935 irem ao ar:
//
// 1) "Última análise" (a única metalinha que sobrou no cabeçalho do lead, por pedido dele na
// v934) aparecia como "Sem data registrada" mesmo num lead recém-reanalisado. Causa raiz, em
// cadeia: (a) analyzeWithBrain (api/_pipeline.js) nunca carimbava NENHUMA data de geração —
// só o clique manual em "Reanalisar" adicionava "reanalisadoEm" depois; leads só importados
// (nunca reanalisados manualmente) não tinham NENHUM carimbo. (b) mesmo quando havia carimbo,
// a lista "leve" de leads (compactAnalysisForList, em api/_persistence.js — usada pro
// refresh em background 600ms depois de reanalisar, e reaberta depois) não incluía os campos
// de carimbo no allowlist, então eles se perdiam ao reabrir o lead. (c) o fallback do front
// (cp865UltimaAnaliseISO) usava um nome de campo que nunca existiu (lead.criadoEm — o campo
// real é lead.createdAt), então nem esse último recurso funcionava.
//
// 2) As sugestões de mensagem passaram a listar de volta pro cliente os números específicos
// de lote/quadra que ELE MESMO já tinha dito na conversa — redundante e sem propósito ("isso é
// imbecil da nossa parte", nas palavras do dono). Esses identificadores são dado INTERNO (pra
// "Detalhes comerciais", resolvido na v935); não devem aparecer de volta nas mensagens.

// 1a. analyzeWithBrain carimba "geradoEm" na própria análise (não depende só da reanálise).
assert.match(pipeline, /return \{\n\s*mode: "openai",\n\s*\/\/ v936[\s\S]*?geradoEm: new Date\(\)\.toISOString\(\),\n\s*summary: clean\(raw\.summary\)/,
  'analyzeWithBrain precisa carimbar geradoEm no próprio retorno');

// 1b. compactAnalysisForList (lista leve de leads) preserva os carimbos de data da análise.
const iniCompact = persistence.indexOf('function compactAnalysisForList(analysis = {}) {');
const fimCompact = persistence.indexOf('\n  }', iniCompact);
assert.ok(iniCompact !== -1 && fimCompact !== -1, 'compactAnalysisForList não encontrada em api/_persistence.js');
const compact = persistence.slice(iniCompact, fimCompact);
for (const campo of ['"reanalisadoEm"', '"geradoEm"', '"analisadoEm"', '"iaComercialV2"']) {
  assert.match(compact, new RegExp(campo.replace(/"/g, '\\"')),
    `compactAnalysisForList precisa manter ${campo} (senão "Última análise" some ao reabrir o lead pela lista)`);
}

// 1c. O fallback de "Última análise" usa o nome de campo real do lead (createdAt), não o
// "criadoEm" que nunca existiu.
const iniFn = app.indexOf('function cp865UltimaAnaliseISO(lead, a){');
const fimFn = app.indexOf('\n}', iniFn);
const fn = app.slice(iniFn, fimFn);
assert.doesNotMatch(fn, /lead\?\.criadoEm/, 'campo errado (criadoEm) não pode mais aparecer no fallback');
assert.match(fn, /lead\?\.createdAt/, 'fallback precisa usar o campo real do lead (createdAt)');

// 2. O prompt de análise continua proibindo devolver ao cliente o que ele mesmo já disse.
// v1291 — o dono reescreveu o pedido: a proibição específica de repetir os identificadores
// (lote/quadra/apartamento) virou a regra geral de não repetir o que já foi resolvido e de
// procurar a resposta na conversa antes de perguntar.
assert.match(pipeline, /Não repita pergunta já respondida nem transforme falta de dado em interrogatório/,
  'prompt precisa proibir as mensagens de repetirem os números específicos que o cliente já disse');
assert.match(pipeline, /ANTES DE PERGUNTAR, PROCURE A RESPOSTA NA CONVERSA/,
  'e precisa mandar procurar na conversa antes de perguntar de novo');

console.log('v936-ultima-analise-sobrevive-lista-e-mensagens-nao-repetem: ok');
