import fs from "node:fs";
import assert from "node:assert/strict";
import { sanitizeCerebroConfig } from "../api/cerebro-config.js";

const literal = 'Não use "X"; então diga "Y".';
const cfg = sanitizeCerebroConfig({ metodo: literal, tom: "Meu tom", evitar: "Minha regra" });
assert.equal(cfg.metodo, literal, "o texto editável do Cérebro deve ser preservado literalmente");
assert.equal(cfg.tom, "Meu tom");
assert.equal(cfg.evitar, "Minha regra");
assert.equal(sanitizeCerebroConfig({}).metodo, "", "não pode existir método comercial padrão cravado");

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const configApi = fs.readFileSync(new URL("../api/cerebro-config.js", import.meta.url), "utf8");

for (const nome of [
  "compilarRegrasObjetivasCerebro",
  "aplicarCorrecoesDeterministicasCerebro",
  "validarMensagensCerebro",
  "sanitizarMensagemDeterministica",
  "construirMensagensDeterministicasCerebro"
]) {
  assert.doesNotMatch(pipeline, new RegExp(nome), `${nome} deve ter sido removida`);
}
assert.match(pipeline, /Respeite integralmente todas as regras do Cérebro Comercial/);
assert.match(pipeline, /validarFormatoMensagens/);
assert.doesNotMatch(app + configApi, /CEREBRO_PROMPT_MINIMO/);
assert.doesNotMatch(app + configApi, /cerebroTextoEhLegado|isLegacyCerebroText/);

console.log("v825-cerebro-obrigatorio: ok");
