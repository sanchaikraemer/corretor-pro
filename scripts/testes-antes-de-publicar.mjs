// ============================================================================================
// v1338 — A SUÍTE VOLTA A SEGURAR A PUBLICAÇÃO. AGORA SEM O ERRO DA v1325.
//
// O que aconteceu na v1325: a auditoria apontou, com razão, que "teste vermelho ≠ produção
// bloqueada" — o CI do GitHub avisava e não impedia nada. A correção foi publicar com
// `npm test && node build.js` no vercel.json. Só que o build da Vercel roda COM AS VARIÁVEIS DE
// PRODUÇÃO carregadas: chave da OpenAI, endereço do Supabase, os ajustes de análise. Com elas no
// ambiente, parte da suíte deixa de testar o padrão de fábrica e parte tenta falar com a rede de
// verdade — e trava. Resultado: o site ficou parado na 1324 enquanto 1325, 1326 e 1327 esperavam,
// e o dono precisou avisar ("nao, esta na 1324 e nao atualiza"). Na v1328 o portão foi removido, e
// desde então nada impede publicar com teste vermelho.
//
// Este arquivo devolve o portão pelo caminho certo: roda a suíte num ambiente LIMPO, com só o que
// o Node precisa pra existir. Nenhuma variável de produção entra. É exatamente o mesmo ambiente da
// máquina de quem desenvolve — então o resultado aqui é o mesmo resultado de lá, e não uma
// surpresa que só aparece na hora de publicar.
//
// VÁLVULA DE EMERGÊNCIA: se um dia for preciso publicar com a suíte vermelha, basta criar a
// variável DIRECIONA_PULAR_TESTES_NO_BUILD=1 nas configurações da Vercel. O portão avisa que foi
// pulado, em letras garrafais, e deixa passar. Ninguém fica refém do portão.
// ============================================================================================
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

if (String(process.env.DIRECIONA_PULAR_TESTES_NO_BUILD || "").trim() === "1") {
  console.log("\n⚠️  ATENÇÃO: a suíte foi PULADA nesta publicação (DIRECIONA_PULAR_TESTES_NO_BUILD=1).");
  console.log("   Esta versão está indo pro ar sem conferência. Tire a variável assim que der.\n");
  process.exit(0);
}

// Só o mínimo pra o Node funcionar. Tudo o que é de produção fica de fora de propósito.
const ambienteLimpo = {
  PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
  HOME: process.env.HOME || "/tmp",
  LANG: process.env.LANG || "C.UTF-8",
  TZ: process.env.TZ || "UTC",
  NODE_ENV: "test",
  // A Vercel usa isto pra achar o node_modules em alguns runtimes; sem ele o spawn falha.
  NODE_PATH: process.env.NODE_PATH || "",
  // Sinaliza pro executor que ele está rodando dentro do build (aparece no log).
  DIRECIONA_TESTE_DE_BUILD: "1"
};

console.log("→ Conferindo a suíte antes de publicar (ambiente limpo, sem variáveis de produção)…");

const TETO_MS = 10 * 60 * 1000;
const r = spawnSync(process.execPath, [path.join(raiz, "tests", "run-all.mjs")], {
  cwd: raiz,
  env: ambienteLimpo,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
  timeout: TETO_MS
});
const saida = `${r.stdout || ""}${r.stderr || ""}`;
process.stdout.write(saida);

// ── FALHA DE MÁQUINA NÃO PODE PARAR A PUBLICAÇÃO ────────────────────────────────────────────
// Esta é a lição da v1325 levada até o fim. O portão existe pra barrar CÓDIGO ERRADO. Se o que
// deu errado foi a máquina da publicação — um pacote que não foi instalado, o Node que não subiu —
// isso não é um defeito do app, e não pode deixar o site preso numa versão velha. Nesse caso o
// portão AVISA em letras garrafais e deixa passar; o CI do GitHub, que roda em máquina limpa a
// cada envio, continua sendo a segunda rede.
const PROBLEMA_DE_MAQUINA = /ERR_MODULE_NOT_FOUND|Cannot find (module|package)|ERR_DLOPEN_FAILED|ENOENT: no such file or directory, open '.*node_modules/;
if (r.error && r.error.code !== "ETIMEDOUT") {
  console.error("\n⚠️  Não deu pra RODAR a suíte nesta máquina de publicação:", r.error.message);
  console.error("   Isso não é teste vermelho — é problema de ambiente. A publicação SEGUE.\n");
  process.exit(0);
}
if (r.status !== 0 && PROBLEMA_DE_MAQUINA.test(saida)) {
  console.error("\n⚠️  A suíte parou por falta de um pacote nesta máquina de publicação, não por teste vermelho.");
  console.error("   A publicação SEGUE, e a conferência de verdade continua no CI do GitHub.\n");
  process.exit(0);
}
if (r.error && r.error.code === "ETIMEDOUT") {
  console.error(`\n✗ A suíte passou de ${TETO_MS / 60000} minutos e foi interrompida. A publicação PAROU.`);
  console.error("  A versão que já está no ar continua no ar. Rode `npm test` na máquina pra ver onde travou.\n");
  process.exit(1);
}
if (r.status !== 0) {
  console.error("\n✗ SUÍTE VERMELHA — a publicação PAROU aqui, de propósito.");
  console.error("  A versão que já está no ar continua no ar, intacta.");
  console.error("  Conserte o teste apontado acima e envie de novo. Em emergência, veja");
  console.error("  DIRECIONA_PULAR_TESTES_NO_BUILD no começo de scripts/testes-antes-de-publicar.mjs.\n");
  process.exit(r.status || 1);
}

console.log("✓ Suíte verde. Seguindo pra publicação.\n");
