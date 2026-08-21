import fs from "node:fs";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

// v1338 — O PORTÃO DA PUBLICAÇÃO, DE VOLTA E SEM O ERRO DA v1325.
//
// A auditoria de 20/08/2026 apontou o buraco: "teste vermelho ≠ produção bloqueada". O CI do
// GitHub dava um "x" no PR e nada mais — dava pra mesclar e publicar com a suíte vermelha.
//
// A v1325 tentou fechar isso publicando com `npm test && node build.js`. Não funcionou, e o modo
// como falhou é a lição: o build da Vercel roda COM AS VARIÁVEIS DE PRODUÇÃO carregadas, e com
// elas parte da suíte deixa de testar o padrão de fábrica e parte tenta falar com a rede de
// verdade. O site ficou parado na 1324 enquanto 1325, 1326 e 1327 esperavam, até o dono avisar:
// "nao, esta na 1324 e nao atualiza". A v1328 tirou o portão — e desde então nada impedia publicar
// com teste vermelho.
//
// Agora o portão roda a suíte num ambiente LIMPO. É o mesmo ambiente da máquina de desenvolvimento,
// então o resultado do build é o mesmo do `npm test` local — sem surpresa na hora de publicar.

const raiz = new URL("../", import.meta.url);
const vercel = JSON.parse(fs.readFileSync(new URL("vercel.json", raiz), "utf8"));
const portao = fs.readFileSync(new URL("scripts/testes-antes-de-publicar.mjs", raiz), "utf8");

// ── 1. A publicação passa pelo portão ────────────────────────────────────────────────────────
assert.equal(vercel.buildCommand, "node scripts/testes-antes-de-publicar.mjs && node build.js",
  "publicar tem que passar pela suíte antes de gerar os arquivos");
assert.ok(!/npm test/.test(vercel.buildCommand),
  "NÃO pode voltar a ser `npm test` cru no build: é assim que as variáveis de produção entram e travam a suíte (v1325)");

// ── 2. O ambiente do portão é limpo — nenhuma variável de produção entra ─────────────────────
const bloco = portao.slice(portao.indexOf("const ambienteLimpo"), portao.indexOf("};", portao.indexOf("const ambienteLimpo")));
for (const proibida of ["OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DIRECIONA_ANALISE_ETAPAS"]) {
  assert.ok(!bloco.includes(proibida), `${proibida} não pode ser repassada pro ambiente da suíte do build`);
}
assert.match(bloco, /NODE_ENV: "test"/, "a suíte do build roda como teste, igual à da máquina");

// As duas conferências abaixo RODAM O PORTÃO DE VERDADE, e o portão roda a suíte inteira. Quando
// este arquivo já está rodando DENTRO do portão (é o caso durante a publicação), repetir isso seria
// uma suíte chamando a si mesma sem fim. O portão marca o ambiente com DIRECIONA_TESTE_DE_BUILD=1;
// é por essa marca que a checagem cara fica pra hora certa: a máquina de quem desenvolve.
const dentroDoPortao = String(process.env.DIRECIONA_TESTE_DE_BUILD || "") === "1";

// ── 3. Suíte vermelha PARA a publicação — provado rodando de verdade ────────────────────────
// Este é o teste que importa: um arquivo de teste que falha de propósito precisa fazer o portão
// devolver erro. Sem isso, o portão poderia estar imprimindo mensagem bonita e deixando passar.
if (!dentroDoPortao) {
  const arquivoFalso = new URL("zzz-portao-de-mentira.test.mjs", new URL("tests/", raiz));
  fs.writeFileSync(arquivoFalso, [
    'import assert from "node:assert/strict";',
    '// arquivo temporário criado por v1338-portao-da-publicacao.test.mjs; some no fim do teste.',
    'assert.equal(1, 2, "falha de propósito");',
    ""
  ].join("\n"));
  try {
    const r = spawnSync(process.execPath, [new URL("scripts/testes-antes-de-publicar.mjs", raiz).pathname], {
      cwd: new URL(".", raiz).pathname,
      encoding: "utf8",
      env: { ...process.env, OPENAI_API_KEY: "sk-de-mentira", DIRECIONA_PULAR_TESTES_NO_BUILD: "" }
    });
    assert.notEqual(r.status, 0, "com um teste vermelho, o portão TEM que devolver erro e parar a publicação");
    assert.match(String(r.stdout) + String(r.stderr), /SUÍTE VERMELHA/,
      "e precisa dizer em português por que a publicação parou");
  } finally {
    fs.rmSync(arquivoFalso, { force: true });
  }
}

// ── 4. A válvula de emergência existe e é barulhenta ────────────────────────────────────────
// Ninguém pode ficar refém do portão: se um dia for preciso publicar com a suíte vermelha, tem
// saída — mas ela precisa gritar no log, senão vira o normal da casa sem ninguém perceber.
if (!dentroDoPortao) {
  const r = spawnSync(process.execPath, [new URL("scripts/testes-antes-de-publicar.mjs", raiz).pathname], {
    cwd: new URL(".", raiz).pathname,
    encoding: "utf8",
    env: { ...process.env, DIRECIONA_PULAR_TESTES_NO_BUILD: "1" }
  });
  assert.equal(r.status, 0, "com a válvula ligada, a publicação passa");
  assert.match(String(r.stdout), /suíte foi PULADA/, "e o log avisa que passou sem conferência");
}

console.log(`v1338-portao-da-publicacao: ok${dentroDoPortao ? " (dentro do portão: as duas provas caras ficaram pra rodada da máquina)" : ""}`);
