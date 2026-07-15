import assert from "node:assert/strict";
import fs from "node:fs";
import { obterAnaliseValidadaDaImportacao } from "../api/lead-update.js";

const valid = {
  mode: "openai",
  sugestoesPendentes: false,
  messages: {
    a: "Boa tarde, posso confirmar uma informação com você?",
    b: "Boa tarde, qual é o melhor próximo passo para você?",
    c: "Boa tarde, podemos avançar com esta opção hoje?"
  }
};
assert.equal(obterAnaliseValidadaDaImportacao({ analysis: valid }), valid);
assert.throws(() => obterAnaliseValidadaDaImportacao({ analysis: { sugestoesPendentes: true, messages: valid.messages } }));
assert.throws(() => obterAnaliseValidadaDaImportacao({ analysis: { sugestoesPendentes: false, messages: { a: "x", b: "y", c: "z" } } }));

const api = fs.readFileSync(new URL("../api/lead-update.js", import.meta.url), "utf8");
const inicio = api.indexOf("async function acaoAtualizarComEvolucao");
const fim = api.indexOf("function assinaturaMsg", inicio);
const bloco = api.slice(inicio, fim);
assert.ok(!bloco.includes("analyzeWithBrain("), "Atualizar não pode reanalisar pela IA");
assert.ok(!bloco.includes("compararEvolucao("), "Atualizar não pode chamar IA para comparar evolução");
assert.ok(bloco.includes("obterAnaliseValidadaDaImportacao(result)"));
assert.ok(api.includes("forceNew: false"), "Servidor deve impedir duplicata");

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
assert.ok(!app.includes("Criar um novo cliente"), "Mesmo nome não pode oferecer criação duplicada");
assert.ok(app.includes("sem criar duplicata"));
console.log("v827-10 update-existing: ok");
