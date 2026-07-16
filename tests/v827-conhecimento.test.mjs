import assert from "node:assert/strict";
import { validarFormatoMensagens } from "../api/_pipeline.js";

const conteudoLivre = validarFormatoMensagens({
  a: "Oi, faz sentido falar de R$ 450.000?",
  b: "Faz 24 dias que conversamos.",
  c: "Qualquer conteúdo retornado pela IA."
});
assert.equal(conteudoLivre.ok, true, "a validação local não deve interpretar conteúdo comercial");

const incompleto = validarFormatoMensagens({ a: "Mensagem", b: "", c: "Mensagem" });
assert.equal(incompleto.ok, false, "a única validação local é técnica: três mensagens preenchidas");

console.log("v827-conhecimento: ok");
