import fs from "node:fs";
import assert from "node:assert/strict";

// v1060 — o dono reparou que "Regras comerciais" e "Sinais de objeção" apareciam DEPOIS do botão
// Salvar e dos números técnicos (Período dos áudios, Atendimentos por dia, Descanso após atender)
// na tela de Inteligência Comercial — ficavam "escondidos" lá embaixo. Foram apresentados 4 modelos
// de reorganização (abas, acordeão, lista reordenada com rodapé fixo, passo a passo); o dono
// escolheu o Modelo 2 (acordeão): cada campo do Cérebro vira um bloco que abre/fecha, agrupado sob
// "Estilo" e "Regras e objeções", com os números técnicos numa seção própria antes dos botões.
// Reaproveita `details.bloco-recolhe`, o mesmo componente de bloco recolhível já usado em
// "Evolução do atendimento" (app.js) — sem inventar um padrão visual novo.

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

// Todos os campos continuam existindo com os mesmos IDs que app.js já lê/grava.
for (const id of ["cerebroCorretorNome", "cerebroMetodo", "cerebroTom", "cerebroDiferenciais", "cerebroEvitar", "cerebroRegrasTexto", "cerebroObjecoesTexto", "cerebroDiasImportacao", "cerebroAtendimentosDia", "cerebroDiasDescanso", "cerebroSalvar", "cerebroResetar", "cerebroZerar", "cerebroStatus"]) {
  assert.match(html, new RegExp(`id="${id}"`), `campo ${id} precisa continuar existindo com o mesmo id`);
}

// Regras comerciais e Sinais de objeção viram blocos recolhíveis, reaproveitando o mesmo
// componente já usado em "Evolução do atendimento" — não é um padrão visual novo.
assert.match(html, /<details class="bloco-recolhe cerebro-campo"[^>]*>\s*<summary>Regras comerciais</, "Regras comerciais precisa virar um bloco-recolhe");
assert.match(html, /<details class="bloco-recolhe cerebro-campo"[^>]*>\s*<summary>Sinais de obje/, "Sinais de objeção precisa virar um bloco-recolhe");
// v1186 — a regra era `details.ficha-cliente,details.bloco-recolhe{...}`. A auditoria de
// 09/08/2026 tirou do CSS as 167 classes que nenhuma tela citava, e `ficha-cliente` era uma
// delas (sobra de uma geração antiga da tela do lead). O componente em si não mudou.
assert.match(css, /details\.bloco-recolhe\{margin-top:8px\}/, "bloco-recolhe é o componente já existente — não pode ter sido duplicado com outro nome");
assert.doesNotMatch(css, /ficha-cliente/, "ficha-cliente saiu do CSS na faxina da v1186 — nenhuma tela usava");

// O ACHADO ORIGINAL: Regras comerciais e Sinais de objeção precisam vir ANTES do botão Salvar e
// antes dos números técnicos — nunca mais depois.
const posRegras = html.indexOf('<summary>Regras comerciais');
const posObjecoes = html.indexOf('<summary>Sinais de obje');
const posConfigLabel = html.indexOf('cerebro-grupo-label">Configurações técnicas');
const posSalvar = html.indexOf('id="cerebroSalvar"');
assert.ok(posRegras > 0 && posObjecoes > 0 && posConfigLabel > 0 && posSalvar > 0, "todos os marcadores precisam existir no HTML");
assert.ok(posRegras < posSalvar, "Regras comerciais precisa vir antes do botão Salvar");
assert.ok(posObjecoes < posSalvar, "Sinais de objeção precisa vir antes do botão Salvar");
assert.ok(posRegras < posConfigLabel, "Regras comerciais precisa vir antes das configurações técnicas (áudios/atendimentos/descanso)");
assert.ok(posObjecoes < posConfigLabel, "Sinais de objeção precisa vir antes das configurações técnicas");

// Os agrupamentos visuais existem (Estilo / Regras e objeções / Configurações técnicas).
assert.match(html, /cerebro-grupo-label">Estilo</);
assert.match(html, /cerebro-grupo-label">Regras e obje/);
assert.match(css, /\.cerebro-grupo-label\{/, "precisa existir estilo pro rótulo de agrupamento");

console.log("v1060-cerebro-regras-objecoes-em-acordeao: ok");
