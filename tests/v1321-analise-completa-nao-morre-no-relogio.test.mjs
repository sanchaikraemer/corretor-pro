import fs from "node:fs";
import assert from "node:assert/strict";

// v1321 — A REANÁLISE MORRIA COM "Request was aborted".
//
// Print do dono (20/08/2026, 08:54): "Não foi possível atualizar: A reanálise não foi concluída e
// nenhuma sugestão foi salva. — Request was aborted." A mesma tela provava que o formato novo
// FUNCIONAVA: a análise das 08:08 tinha concluído, com a leitura reposicionando a faixa.
//
// A causa: a leitura completa da v1320 escreve bem mais, e o orçamento interno da análise era de
// 52 segundos (janela real de 48s pra IA). Passou disso, o próprio app abortava a chamada — e o
// "Request was aborted" é exatamente a mensagem desse corte. Três relógios subiram juntos:
//   servidor (vercel.json): 60s -> 300s nas duas rotas de análise;
//   orçamento interno: 52s -> 150s;
//   navegador: desistia aos 90s -> espera até 320s (sempre acima do teto do servidor).

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const vercel = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

// Servidor: as duas rotas que rodam a análise têm o teto novo; as demais continuam em 60s.
assert.equal(vercel.functions["api/reanalisar-lead.js"].maxDuration, 300, "a rota da reanálise precisa do teto de 300s");
assert.equal(vercel.functions["api/processar-storage.js"].maxDuration, 300, "a rota da importação precisa do teto de 300s");

// Orçamento interno: 150s por padrão, ainda ajustável por variável de ambiente sem publicar.
assert.match(pipeline, /DIRECIONA_ANALYSIS_BUDGET_MS \|\| 150000/, "o orçamento interno da análise precisa ser 150s por padrão");
assert.ok(150000 + 20000 < 300 * 1000, "o orçamento interno precisa caber com folga dentro do teto do servidor");

// Navegador: espera mais que o servidor — nunca desiste antes dele.
assert.match(app, /setTimeout\(\(\)=>ctrl\.abort\(\),320000\)/, "o navegador precisa esperar mais que o teto do servidor");
assert.doesNotMatch(app, /setTimeout\(\(\)=>ctrl\.abort\(\),90000\)/, "a desistência aos 90s não pode voltar");

// A barra fala o tempo real da espera nova.
assert.match(app, /costuma levar de 1 a 2 minutos/, "a barra precisa avisar a duração real");

console.log("v1321-analise-completa-nao-morre-no-relogio: ok");
