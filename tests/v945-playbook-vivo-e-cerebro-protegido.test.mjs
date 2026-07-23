import fs from "node:fs";
import assert from "node:assert/strict";
import { sanitizeCerebroConfig, readJsonBody } from "../api/cerebro-config.js";
import { analyzeWithBrain } from "../api/_pipeline.js";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const cerebroApi = fs.readFileSync(new URL("../api/cerebro-config.js", import.meta.url), "utf8");

// ---------------------------------------------------------------------------
// 1) INTELIGENCIA_CARTEIRA (o playbook comercial base) estava definida no código
//    mas nunca era injetada em nenhum prompt vivo — só era referenciada dentro de
//    montarOrientacoes, uma função que nenhum caller chama. Agora precisa estar
//    dentro do systemPromptAnalise de verdade, entre as instruções de maior
//    prioridade e o bloco do Cérebro do corretor.
// ---------------------------------------------------------------------------
assert.match(
  pipeline,
  /const systemPromptAnalise = `INSTRUÇÕES DE MAIOR PRIORIDADE:[\s\S]*\$\{INTELIGENCIA_CARTEIRA\}[\s\S]*=== INÍCIO DO CÉREBRO COMERCIAL ===[\s\S]*\$\{instrucoesCerebroTexto\}[\s\S]*=== FIM DO CÉREBRO COMERCIAL ===/,
  "o playbook base precisa estar no prompt vivo, antes do Cérebro do corretor"
);

const chamadas = [];
const respostaBase = {
  summary: "Resumo",
  diagnostico: { produtoPrincipal: "Produto", etapaFunil: "Atendimento" },
  mensagens: { recomendada: "Bom dia?", maisSuave: "Bom dia?", maisDireta: "Bom dia?" },
  produtoInteresse: "Produto",
  produtosInteresse: ["Produto"],
  etapaSugerida: "Atendimento",
  clientProfile: "Perfil",
  nextAction: "Ação"
};
const openaiMock = {
  chat: { completions: { create: async payload => {
    chamadas.push(payload);
    return { model: "mock-gpt", choices: [{ message: { content: JSON.stringify(respostaBase) } }] };
  } } }
};
const timeline = [{ date: "09/05/2026", time: "18:30", author: "Cliente", text: "Quero entender as condições." }];

await analyzeWithBrain({
  lead: { clientName: "Cliente" }, timeline, openai: openaiMock,
  cerebroConfig: { metodo: "método do corretor", tom: "tom normal" }
});
const systemVivo = chamadas.at(-1).messages.find(m => m.role === "system")?.content || "";
assert.match(systemVivo, /QUALIFICAR antes de empurrar produto/, "trecho do playbook precisa chegar no prompt de verdade enviado ao modelo");
assert.match(systemVivo, /Reenquadre: "entrada \+ financiamento/, "argumento de permuta do playbook precisa estar no prompt vivo");

// ---------------------------------------------------------------------------
// 2) Campos livres do Cérebro (método/tom/diferenciais/evitar) nunca tinham teto
//    — só regrasTexto/objecoesTexto tinham (60000). Um corretor colando texto
//    demais podia estourar o contexto do modelo. Precisa haver teto nos dois
//    lugares: no save (api/cerebro-config.js) e no ponto que realmente monta o
//    prompt (api/_pipeline.js, sanitizeCerebroConfig usada por formatCerebroPrompt).
// ---------------------------------------------------------------------------
const metodoGigante = "x".repeat(50000);
await analyzeWithBrain({
  lead: { clientName: "Cliente" }, timeline, openai: openaiMock,
  cerebroConfig: { metodo: metodoGigante }
});
const systemComMetodoGigante = chamadas.at(-1).messages.find(m => m.role === "system")?.content || "";
const maiorSequenciaDeX = (systemComMetodoGigante.match(/x+/g) || [""]).sort((a, b) => b.length - a.length)[0];
assert.equal(maiorSequenciaDeX.length, 20000, "o método gigante precisa chegar truncado em 20000 chars no prompt vivo, não inteiro");

// sanitizeCerebroConfig (api/cerebro-config.js) — mesma proteção, testada direto.
const cfgCapado = sanitizeCerebroConfig({
  metodo: "a".repeat(30000), tom: "b".repeat(30000), diferenciais: "c".repeat(30000), evitar: "d".repeat(30000),
  regrasTexto: "e".repeat(90000), objecoesTexto: "f".repeat(90000)
});
assert.equal(cfgCapado.metodo.length, 20000);
assert.equal(cfgCapado.tom.length, 20000);
assert.equal(cfgCapado.diferenciais.length, 20000);
assert.equal(cfgCapado.evitar.length, 20000);
assert.equal(cfgCapado.regrasTexto.length, 60000, "regrasTexto continua com teto maior (60000), não mudou");
assert.equal(cfgCapado.objecoesTexto.length, 60000, "objecoesTexto continua com teto maior (60000), não mudou");

// Texto curto não pode ser afetado pelo teto nem ter espaços removidos (só bytes nulos).
const textoNormal = "Meu método tem várias palavras e frases inteiras.";
assert.equal(sanitizeCerebroConfig({ metodo: textoNormal }).metodo, textoNormal, "texto curto deve passar intacto, espaços incluídos");

// ---------------------------------------------------------------------------
// 3) diasImportacao: o save já limitava a 1..365, mas a leitura (sanitizeCerebroConfig,
//    usada no GET e por loadCerebroConfig na análise) não tinha teto superior nenhum —
//    um valor legado ou corrompido gigante passava direto. Alinhar as duas.
// ---------------------------------------------------------------------------
assert.equal(sanitizeCerebroConfig({ diasImportacao: 999999 }).diasImportacao, 90, "valor fora do range deve cair pro default 90");
assert.equal(sanitizeCerebroConfig({ diasImportacao: 200 }).diasImportacao, 200, "valor dentro do range deve ser preservado");
assert.equal(sanitizeCerebroConfig({ diasImportacao: 0 }).diasImportacao, 90, "zero deve cair pro default 90");
assert.match(cerebroApi, /clampDiasImportacao/, "deve existir um único helper de clamp reaproveitado no save e na leitura");

// ---------------------------------------------------------------------------
// 4) readJsonBody: body malformado (JSON quebrado) precisa ser distinguível de body
//    genuinamente vazio. Antes os dois caíam em `{}`, e um POST com JSON corrompido
//    virava, silenciosamente, um save que zerava método/tom/diferenciais/evitar pros
//    defaults (porque cada campo do save cai pro default quando body.campo não é
//    string). Agora corpo quebrado deve retornar null e o handler deve recusar com 400
//    em vez de salvar.
// ---------------------------------------------------------------------------
assert.deepEqual(await readJsonBody({ body: { a: 1 } }), { a: 1 }, "body já objeto deve passar direto");
assert.deepEqual(await readJsonBody({ body: '{"a":1}' }), { a: 1 }, "string JSON válida deve ser parseada");
assert.deepEqual(await readJsonBody({ body: "" }), {}, "string vazia deve virar objeto vazio, não erro");
assert.equal(await readJsonBody({ body: "{ isso não é json" }), null, "string JSON malformada deve retornar null, não {}");

function fakeStreamReq(raw) {
  return { on(event, cb) { if (event === "data") cb(raw); if (event === "end") cb(); } };
}
assert.deepEqual(await readJsonBody(fakeStreamReq('{"b":2}')), { b: 2 }, "corpo via stream válido deve ser parseado");
assert.deepEqual(await readJsonBody(fakeStreamReq("")), {}, "stream vazio deve virar objeto vazio");
assert.equal(await readJsonBody(fakeStreamReq("{ quebrado")), null, "stream malformado deve retornar null");

assert.match(cerebroApi, /if \(body === null\)/, "o handler precisa recusar corpo malformado antes de tocar no save");
assert.match(cerebroApi, /400/, "corpo malformado deve responder 400, não seguir salvando");

console.log("v945-playbook-vivo-e-cerebro-protegido: ok");
