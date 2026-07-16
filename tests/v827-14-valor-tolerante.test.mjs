import assert from "node:assert/strict";
import { validarFormatoMensagens } from "../api/_pipeline.js";

const resultado = validarFormatoMensagens({
  a: "Mensagem com R$ 450.000.",
  b: "Mensagem com 5%.",
  c: "Mensagem com 120 m² e data 15/07/2026."
});
assert.equal(resultado.ok, true, "números, valores e datas não devem ser validados por regra cravada no código");
assert.deepEqual(resultado.motivos, []);

console.log("v827-14-valor-tolerante: ok");
