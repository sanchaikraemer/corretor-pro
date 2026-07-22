// v881 — a saudação da home ("N leads pra atender hoje", em laranja no topo) precisa
// BATER com o card "Fazer agora" e com a lista "Top conversão" logo abaixo.
//
// Bug: o cabeçalho laranja mostrava "10 leads pra atender hoje" enquanto o card
// "Fazer agora" mostrava 0 e a lista dizia "Tudo em dia! Nenhum lead pendente agora".
// Causa: renderSaudacao usava um cálculo próprio (entraEmRetomada + meta de 12) que
// contava leads de reativação parados 5+ dias como "pra atender hoje", divergindo de
// toda a home — que é calculada por cp786Categoria (via cp788Grupos / renderResumoDia).
//
// Correção: renderSaudacao passa a contar exatamente os leads da categoria "agora",
// a mesma fonte de verdade do card "Fazer agora".

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(raiz, "app.js"), "utf8");

// Isola o corpo de renderSaudacao (até a próxima declaração de função no topo do arquivo).
const ini = app.indexOf("function renderSaudacao(items){");
assert.ok(ini !== -1, "renderSaudacao não foi encontrada em app.js");
const corpo = app.slice(ini, app.indexOf("\nfunction ", ini + 1));

// 1. A saudação = DOSE do dia (v914: cpFazerAgoraDose — até 10, 0 no fim de semana).
assert.ok(
  /cpFazerAgoraDose\(items\)/.test(corpo),
  "renderSaudacao deveria contar acaoMostrada = cpFazerAgoraDose(items)"
);

// 2. Não conta mais a categoria crua nem o cálculo antigo (meta de 12) direto na saudação.
assert.ok(
  !/cp786Categoria\(l\)\s*===\s*["']agora["']/.test(corpo),
  "renderSaudacao não deve mais contar cp786Categoria==='agora' cru (some do card real)"
);
assert.ok(
  !/META_DIA/.test(corpo),
  "renderSaudacao ainda usa META_DIA — o teto de 12 fazia o número divergir da lista"
);

// 3. A frase-alvo continua sendo gerada a partir de acaoMostrada.
assert.ok(
  /acaoMostrada\s*>\s*0/.test(corpo) &&
    corpo.includes("lead${acaoMostrada>1?\"s\":\"\"} pra atender hoje"),
  "a frase 'N leads pra atender hoje' deveria depender de acaoMostrada"
);

console.log("v881-saudacao-bate-fazer-agora: OK");
