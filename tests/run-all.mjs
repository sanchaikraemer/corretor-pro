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
  // v1293 — A PASTA js/ PASSOU A SER DESCOBERTA SOZINHA, COMO api/ JÁ ERA.
  //
  // Esta lista era escrita à mão, e a revisão de 18/08/2026 mostrou os dois estragos disso:
  //
  //   • ela ainda citava "js/tema.js", apagado na v1268 — linha morta dentro da própria rede de
  //     proteção (não quebrava nada porque o filtro abaixo pula arquivo que não existe, mas
  //     também não protegia coisa nenhuma);
  //   • e não citava "js/importacao.js" — as ~1.500 linhas da importação inteira, o segundo maior
  //     arquivo do front. Os 50 testes que falam dele só LEEM o texto do arquivo; nenhum executa.
  //     Resultado: um erro de digitação lá passava pela suíte toda verde e só aparecia no celular
  //     do dono, na hora de importar uma conversa. Mesma coisa valia pra saudacao.js,
  //     dados-locais.js, enxugar-zip.js e envio-retentativa.js.
  //
  // Agora todo arquivo .js de js/ entra sozinho — um módulo novo nunca mais nasce sem checagem.
  const modulosJs = existsSync(path.join(raiz, "js"))
    ? readdirSync(path.join(raiz, "js")).filter(f => f.endsWith(".js")).sort().map(f => `js/${f}`)
    : [];
  const fixos = [
    "app.js", "build.js", "service-worker.js", ...modulosJs
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
    // v1365 — arquivo que estava na lista mas sumiu ANTES da vez dele não é teste vermelho.
    // Caso real de 22/08/2026: o teste do portão (v1338) cria tests/zzz-portao-de-mentira.test.mjs
    // de propósito e o apaga no finally; se uma rodada paralela (ou uma sobra de rodada morta)
    // deixou o arquivo existir na hora da listagem, ele já não existe quando a vez dele chega —
    // e rodar um arquivo inexistente pintava a suíte inteira de vermelho sem defeito nenhum.
    if (!existsSync(path.join(dirTestes, arquivo))) {
      console.log(`• ${arquivo} — sumiu depois da listagem (arquivo temporário de outro teste); pulado.`);
      continue;
    }
    if (!rodar(process.execPath, [path.join("tests", arquivo)], arquivo)) process.exit(1);
    testesOk++;
  }
}

console.log(`\n✓ Suíte completa: ${sintaxeOk} arquivo(s) checado(s) + ${testesOk} teste(s), todos verdes.`);
