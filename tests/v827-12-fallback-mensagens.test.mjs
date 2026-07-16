import fs from "node:fs";
import assert from "node:assert/strict";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
assert.doesNotMatch(pipeline, /construirMensagensDeterministicasCerebro/);
assert.doesNotMatch(pipeline, /sanitizarMensagemDeterministica/);
assert.doesNotMatch(pipeline, /corrigirMensagensPelasRegras/);
assert.doesNotMatch(pipeline, /Como você quer seguir a partir daqui/);
assert.match(pipeline, /Nenhuma sugestão de mensagem é reinterpretada|Nenhum conteúdo é reinterpretado/);

console.log("v827-12-fallback-mensagens: ok");
