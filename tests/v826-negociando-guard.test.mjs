import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain } from "../api/_pipeline.js";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
assert.doesNotMatch(pipeline, /function\s+ajustarEtapaNegociacao|function\s+temEvidenciaNegociacao/);

let chamadas = 0;
const openai = {
  chat: {
    completions: {
      create: async () => {
        chamadas++;
        return {
          model: "teste",
          choices: [{ message: { content: JSON.stringify({
            summary: "Resumo",
            diagnostico: { etapaFunil: "Negociação" },
            mensagens: { recomendada: "Mensagem 1", maisSuave: "Mensagem 2", maisDireta: "Mensagem 3" },
            etapaSugerida: "Negociação"
          }) } }]
        };
      }
    }
  }
};

const resultado = await analyzeWithBrain({
  lead: { name: "Cliente" },
  timeline: [{ author: "Cliente", text: "Quero mais informações", date: "16/07/2026", time: "10:00" }],
  openai,
  cerebroConfig: { metodo: "Responda conforme minhas regras." }
});

// v1332 — a análise passou a ser feita em duas etapas (entender, depois escrever as três), então
// são duas chamadas. O que este teste guarda continua igual: a etapa comercial que a IA devolveu
// chega inteira ao resultado, sem o código reinterpretar.
assert.equal(chamadas, 2);
assert.equal(resultado.etapaSugerida, "Negociação");
assert.equal(resultado.diagnostico.etapaFunil, "Negociação");
console.log("v826-negociando-guard: ok");
