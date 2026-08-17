// v1092 — EXECUTOR DA SUÍTE.
//
// Antes, o script "test" do package.json era uma corrente gigante de `&&` com os 267 arquivos de
// teste escritos um a um, na mão. Isso tem dois defeitos sérios:
//
//   1. Um teste novo só roda se alguém lembrar de acrescentá-lo à corrente. Esquecer é silencioso
//      — o arquivo fica no disco parecendo que protege alguma coisa, e nunca é executado.
//   2. A corrente tinha mais de 20 mil caracteres numa linha só, impossível de revisar.
//
// Este executor descobre os testes sozinho, roda em ordem determinística (alfabética, pra a mesma
// ordem em qualquer máquina), PARA no primeiro erro e devolve código de saída diferente de zero.
//
// Também mantém aqui a checagem de sintaxe (`node --check`) que a corrente fazia antes de rodar
// os testes: ela pega erro de digitação em arquivo que nenhum teste importa.

import { readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dirTestes = path.join(raiz, "tests");

// Arquivos que precisam ao menos compilar. As rotas de api/ são descobertas sozinhas — assim uma
// rota nova entra na checagem sem ninguém precisar lembrar.
function arquivosParaChecarSintaxe() {
  const fixos = [
    "app.js", "build.js", "service-worker.js",
    "js/state.js", "js/commercial-schema.js", "js/dom.js", "js/tema.js",
    "js/proposta.js", "js/pwa-install.js"
  ].filter(f => existsSync(path.join(raiz, f)));
  const api = existsSync(path.join(raiz, "api"))
    ? readdirSync(path.join(raiz, "api")).filter(f => f.endsWith(".js")).sort().map(f => `api/${f}`)
    : [];
  // v1283 — a bateria de conversas (evals/) também entra na checagem. Ela não roda na suíte (fala
  // com a IA de verdade e gasta dinheiro), então sem isto um erro de digitação lá só apareceria
  // no dia em que o dono fosse comparar um prompt antes/depois — justo a hora errada.
  const evals = existsSync(path.join(raiz, "evals"))
    ? readdirSync(path.join(raiz, "evals")).filter(f => f.endsWith(".mjs")).sort().map(f => `evals/${f}`)
    : [];
  return [...fixos, ...api, ...evals];
}

function rodar(comando, args, rotulo) {
  const r = spawnSync(comando, args, { cwd: raiz, stdio: "inherit", env: process.env });
  if (r.error) {
    console.error(`\n✗ ${rotulo} — não consegui executar: ${r.error.message}`);
    return false;
  }
  if (r.status !== 0) {
    console.error(`\n✗ ${rotulo} — falhou (código ${r.status})`);
    return false;
  }
  return true;
}

const somenteSintaxe = process.argv.includes("--somente-sintaxe");
const somenteTestes = process.argv.includes("--somente-testes");

let sintaxeOk = 0;
if (!somenteTestes) {
  for (const arquivo of arquivosParaChecarSintaxe()) {
    if (!rodar(process.execPath, ["--check", arquivo], `node --check ${arquivo}`)) process.exit(1);
    sintaxeOk++;
  }
}

let testesOk = 0;
if (!somenteSintaxe) {
  const testes = readdirSync(dirTestes)
    .filter(f => f.endsWith(".test.mjs"))
    .sort((a, b) => a.localeCompare(b, "en")); // ordem determinística, igual em qualquer máquina
  if (!testes.length) {
    console.error("✗ Nenhum arquivo tests/*.test.mjs encontrado — a suíte não pode passar vazia.");
    process.exit(1);
  }
  for (const arquivo of testes) {
    if (!rodar(process.execPath, [path.join("tests", arquivo)], arquivo)) process.exit(1);
    testesOk++;
  }
}

console.log(`\n✓ Suíte completa: ${sintaxeOk} arquivo(s) checado(s) + ${testesOk} teste(s), todos verdes.`);
