import fs from "node:fs";
import assert from "node:assert/strict";
import { analyzeWithBrain } from "../api/_pipeline.js";

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const leadUpdate = fs.readFileSync(new URL("../api/lead-update.js", import.meta.url), "utf8");
const reanalisar = fs.readFileSync(new URL("../api/reanalisar-lead.js", import.meta.url), "utf8");

// Regressão do erro encontrado na v851: os campos vazios do formulário oculto não
// podem apagar o Método salvo antes de a tela do Cérebro ser carregada.
assert.match(app, /let cerebroFormularioCarregado = false;/);
assert.match(app, /if \(cerebroFormularioCarregado\) \{/);
assert.match(app, /localStorage\.setItem\(CEREBRO_LS_KEY, JSON\.stringify\(config\)\)/);

// O Cérebro persistido no banco precisa ser consultado antes de aceitar um payload
// parcial do navegador.
const loadStart = pipeline.indexOf("async function loadCerebroConfig");
const loadEnd = pipeline.indexOf("// Carrega SÓ o banco", loadStart);
const loadBlock = pipeline.slice(loadStart, loadEnd);
assert.ok(loadBlock.indexOf('eq("chave", "direciona-cerebro")') < loadBlock.indexOf("hasCerebroInstructions(frontendConfig)"));

// Sem instruções do Cérebro, nenhuma chamada à IA pode acontecer e nenhuma mensagem
// genérica pode ser criada.
let chamadas = 0;
const openaiNunca = {
  chat: { completions: { create: async () => {
    chamadas++;
    throw new Error("não deveria chamar a IA");
  } } }
};
const timeline = [{ date: "16/07/2026", time: "10:00", author: "Cliente", text: "Quero informações." }];
const semCerebro = await analyzeWithBrain({
  lead: { clientName: "Cliente" },
  timeline,
  openai: openaiNunca,
  cerebroConfig: { corretorNome: "Sanchai", metodo: "", tom: "", diferenciais: "", evitar: "", regras: [], objecoes: [] }
});
assert.equal(chamadas, 0);
assert.equal(semCerebro.mode, "cerebro_ausente");
assert.equal(semCerebro.sugestoesPendentes, true);
assert.deepEqual([semCerebro.messages.a, semCerebro.messages.b, semCerebro.messages.c], ["", "", ""]);

// Nenhum texto comercial pronto pode permanecer nos fallbacks de criação manual.
assert.doesNotMatch(leadUpdate, /Oi \$\{primeiroNome\}/);
assert.doesNotMatch(leadUpdate, /me passa o que ele procura e a faixa de investimento/i);
assert.match(leadUpdate, /arquiteturaMensagens: ARQUITETURA_MENSAGENS_ATUAL/);
assert.match(leadUpdate, /sugestoesPendentes: true/);

// Uma reanálise incompleta não pode ser salva como sucesso.
assert.match(reanalisar, /novoAnalysis\.mode !== "openai"/);
assert.match(reanalisar, /nenhuma sugestão foi salva/i);

console.log("v852-cerebro-integridade: ok");
