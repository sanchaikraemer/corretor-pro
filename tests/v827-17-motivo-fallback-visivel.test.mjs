import fs from "node:fs";
import assert from "node:assert/strict";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
assert.doesNotMatch(pipeline, /mensagensGeradasPorFallback|motivoFallbackMensagens|tentativasCorrecaoMensagens/);
assert.doesNotMatch(app, /mensagensGeradasPorFallback|motivoFallbackMensagens/);
assert.doesNotMatch(app, /Sugestão gerada automaticamente \(a IA não passou nas regras do Cérebro/);

console.log("v827-17-motivo-fallback-visivel: ok");
