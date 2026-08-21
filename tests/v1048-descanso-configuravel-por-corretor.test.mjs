import fs from "node:fs";
import assert from "node:assert/strict";
import { sanitizeCerebroConfig, CEREBRO_DEFAULTS } from "../api/cerebro-config.js";
// v1337 — o fuso do app saiu de 35 literais "America/Sao_Paulo" e virou cpFuso(). Este import
// entrega as funções REAIS de fuso do app.js pros trechos que este teste roda com eval.
import "./_fuso-do-app.mjs";

// v1048 — o dono explicou o critério de quem entra na fila "Fazer agora" e apontou o ponto exato
// que queria mudar: "o número 2 (você não atendeu ele hoje ainda) esse 'hoje' deve mudar para
// 'x' dias... e esse número de dias desde o último atendimento, quero que seja personalizado no
// cérebro também... o usuário pode escolher se quer dar um tempo após o atendimento de 3, 5, 10
// ou mais dias até o cliente voltar a lista de prioridades".
//
// Antes: limiarRetomada tinha uma regra FIXA (3 dias pra lead criado há ≤7 dias, 5 pra
// estabelecido), sem nenhuma opção de ajuste — a mesma trava que já vinha causando confusão em
// versões anteriores (v981/v1018/v1019), sempre em torno do mesmo "prazo de descanso" pós-
// atendimento. Agora é um valor só, escolhido pelo corretor no Cérebro Comercial (campo
// "Descanso após atender", 1 a 60 dias, padrão 5).

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cerebroApi = fs.readFileSync(new URL("../api/cerebro-config.js", import.meta.url), "utf8");

// --- servidor: o campo existe, tem default 5 e é clampado em 1–60 -------------------
assert.equal(CEREBRO_DEFAULTS.diasDescansoPosAtendimento, 5, "default do servidor precisa ser 5");
assert.equal(sanitizeCerebroConfig({}).diasDescansoPosAtendimento, 5, "sem valor → 5");
assert.equal(sanitizeCerebroConfig({ diasDescansoPosAtendimento: 3 }).diasDescansoPosAtendimento, 3, "3 dias vale");
assert.equal(sanitizeCerebroConfig({ diasDescansoPosAtendimento: 10 }).diasDescansoPosAtendimento, 10, "10 dias vale");
assert.equal(sanitizeCerebroConfig({ diasDescansoPosAtendimento: "20" }).diasDescansoPosAtendimento, 20, "string numérica vale");
assert.equal(sanitizeCerebroConfig({ diasDescansoPosAtendimento: 0 }).diasDescansoPosAtendimento, 5, "0 → volta pro padrão");
assert.equal(sanitizeCerebroConfig({ diasDescansoPosAtendimento: 90 }).diasDescansoPosAtendimento, 5, "fora do teto (60) → padrão");
assert.equal(sanitizeCerebroConfig({ diasDescansoPosAtendimento: "lixo" }).diasDescansoPosAtendimento, 5, "lixo → padrão");
assert.match(cerebroApi, /diasDescansoPosAtendimento: clampDiasDescanso\(body\.diasDescansoPosAtendimento\)/,
  "o save padrão da rota precisa persistir diasDescansoPosAtendimento");

// --- formulário do Cérebro: campo novo, carregado e salvo ---------------------------
assert.match(html, /id="cerebroDiasDescanso"[^>]*min="1"[^>]*max="60"/,
  "index.html precisa do campo Descanso após atender (1 a 60) no Cérebro");
assert.match(app, /diasDescansoPosAtendimento: \(Number\(c\.diasDescansoPosAtendimento\) >= 1 && Number\(c\.diasDescansoPosAtendimento\) <= 60\)/,
  "sanitizeCerebroConfigV762 precisa aceitar/clampar diasDescansoPosAtendimento");
assert.match(app, /qs\("#cerebroDiasDescanso"\)/, "o formulário precisa ler/preencher o campo novo");
assert.match(app, /diasDescansoPosAtendimento: \(Number\.isFinite\(descansoN\) && descansoN >= 1 && descansoN <= 60\)/,
  "salvarCerebro precisa enviar o campo pro banco");

// --- a regra fixa "3 dias novo / 5 estabelecido" saiu de vez ------------------------
assert.doesNotMatch(app, /if\(dCriado <= 7\) return 3;/, "a distinção fixa por idade do lead não pode mais existir");
assert.match(app, /function limiarRetomada\(l\)\{\s*return cpDiasDescansoPosAtendimento\(\);\s*\}/,
  "limiarRetomada precisa delegar pro valor configurável, sem regra própria");

// --- comportamento real: o valor configurado no Cérebro muda a janela de espera ----
const diasCalSrc = app.match(/function diasCalendarioBR\(quando\)\{[\s\S]*?\n\}/)[0];
const tiposSrc = app.match(/const TIPOS_ATENDIMENTO_TIMELINE = new Set\(\[[^\]]*\]\);/)[0];
const ultAtSrc = app.match(/function ultimoAtendimentoTs\(l\)\{[\s\S]*?\n\}/)[0];
const lembTsSrc = app.match(/function lembreteTs\(l\)\{[\s\S]*?\n\}/)[0];
const lembVencSrc = app.match(/function lembreteVencido\(l\)\{[^\n]*\}/)[0];
const diasDescansoSrc = app.match(/function cpDiasDescansoPosAtendimento\(\)\{[\s\S]*?\n\}/)[0];
const limiarSrc = app.match(/function limiarRetomada\(l\)\{[\s\S]*?\n\}/)[0];
const janelaSrc = app.match(/function emJanelaDeEspera\(l\)\{[\s\S]*?\n\}/)[0];

function montarEmJanelaDeEspera(diasConfigurados) {
  return eval(`
    const obterCerebroConfigParaAnalise = () => (${diasConfigurados == null ? "null" : `{ diasDescansoPosAtendimento: ${diasConfigurados} }`});
    ${diasCalSrc}
    ${tiposSrc}
    ${ultAtSrc}
    ${lembTsSrc}
    ${lembVencSrc}
    ${diasDescansoSrc}
    ${limiarSrc}
    ${janelaSrc}
    emJanelaDeEspera
  `);
}

const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();
const leadAtendidoHa7Dias = () => ({
  analysis: { aprendizado: { eventos: [
    { evento: "contato_manual", detalhes: { tipo: "Atendido", de: "botao_atendido" }, quando: diasAtras(7) }
  ] } }
});

// Sem Cérebro configurado: cai no padrão de 5 dias — 7 dias já passou, lead elegível de novo.
assert.equal(montarEmJanelaDeEspera(null)(leadAtendidoHa7Dias()), false,
  "sem config, padrão de 5 dias — atendido há 7 dias já não protege mais");

// Corretor escolheu 10 dias de descanso: atendido há 7 dias AINDA precisa estar protegido.
assert.equal(montarEmJanelaDeEspera(10)(leadAtendidoHa7Dias()), true,
  "com 10 dias configurados, atendido há 7 dias continua protegido (não volta pra fila ainda)");

// Corretor escolheu 3 dias de descanso: atendido há 7 dias não protege (passou muito do prazo).
assert.equal(montarEmJanelaDeEspera(3)(leadAtendidoHa7Dias()), false,
  "com 3 dias configurados, atendido há 7 dias não protege mais (passou do prazo escolhido)");

console.log("v1048-descanso-configuravel-por-corretor: ok");
