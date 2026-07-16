import fs from "node:fs";
import assert from "node:assert/strict";

// §v827-17: quando as 3 mensagens vêm do fallback determinístico (v827-12), o motivo
// ORIGINAL de a IA não ter passado na validação do Cérebro precisa ficar visível — sem
// isso, uma vez que o fallback "resolve" a análise, não dava pra diagnosticar por que
// ele disparou (foi exatamente o que aconteceu em produção: o corretor via o texto
// genérico de novo e ninguém conseguia saber o motivo real sem acesso ao banco).

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
assert.match(pipeline, /motivoFallbackMensagens = \[\.\.\.\(validacaoMensagens\.motivos/, "guarda o motivo original antes do fallback sobrescrever a validação");
assert.match(pipeline, /motivoFallbackMensagens,\s*\n\s*tentativasCorrecaoMensagens/, "o motivo entra no objeto de análise retornado");

const appJs = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
assert.match(appJs, /a\.mensagensGeradasPorFallback/, "a tela do lead precisa checar se a mensagem veio do fallback");
assert.match(appJs, /a\.motivoFallbackMensagens/, "a tela do lead precisa exibir o motivo do fallback");

console.log("v827-17-motivo-fallback-visivel: ok");
