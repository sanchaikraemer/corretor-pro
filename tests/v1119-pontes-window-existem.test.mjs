// v1119 — rede de segurança pra a regressão MAIS PROVÁVEL do projeto (apontada na auditoria de
// qualidade): app.js é um módulo ES, então uma função declarada no topo NÃO fica acessível pros
// onclick="funcao()" do HTML — só a linha `window.funcao = funcao` faz essa ponte. Se uma faxina
// remove uma ponte (ou renomeia a função sem renomear o handler), o botão para de funcionar em
// silêncio: sem erro no console, sem teste vermelho, até o dono flagrar com print.
//
// Este teste extrai todo handler on*="nome(" (cujo valor começa com um identificador simples
// seguido de "(") de app.js e index.html, e exige que cada `nome` tenha uma ponte `window.nome =`
// em app.js ou nos módulos js/. Rodei o extrator antes de commitar: 42 handlers, 0 órfãos.
// (Handlers com expressão composta — ex.: onclick="event.stop();x()" — são deixados de fora de
// propósito: melhor não checar do que dar falso positivo.)

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ler = (f) => readFileSync(path.join(raiz, f), "utf8");

const app = ler("app.js");
const index = ler("index.html");
// v1268 — a lista era escrita à mão e quebrou quando js/tema.js foi apagado (o tema claro saiu do
// sistema). Agora lê a pasta js/ inteira: módulo novo entra sozinho, módulo apagado sai sozinho —
// mesma ideia que o executor da suíte já usa pra descobrir os testes desde a v1092.
const modulos = readdirSync(path.join(raiz, "js"))
  .filter(f => f.endsWith(".js")).sort()
  .map(f => ler(path.join("js", f))).join("\n");

// Handlers on*="nome(...)" — valor da atributo COMEÇA com um identificador simples seguido de "(".
const handlerRe = /\son[a-z]+\s*=\s*"([A-Za-z_$][\w$]*)\s*\(/g;
const nomes = new Set();
for (const src of [app, index]) {
  let m;
  while ((m = handlerRe.exec(src))) nomes.add(m[1]);
}

// Pontes: window.nome = ... (em app.js ou nos módulos js/).
const pontes = new Set();
const ponteRe = /window\.([A-Za-z_$][\w$]*)\s*=/g;
for (const src of [app, modulos]) {
  let p;
  while ((p = ponteRe.exec(src))) pontes.add(p[1]);
}

assert.ok(nomes.size >= 30, `esperava dezenas de handlers inline, achei ${nomes.size} — o extrator pode ter quebrado`);

const orfaos = [...nomes].filter(n => !pontes.has(n)).sort();
assert.deepEqual(orfaos, [],
  `Handlers inline sem a ponte window.x correspondente (o botão não vai funcionar): ${orfaos.join(", ")}`);

console.log(`v1119-pontes-window-existem: ok (${nomes.size} handlers, todos com ponte)`);
