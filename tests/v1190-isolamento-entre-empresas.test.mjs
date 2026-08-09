import fs from "node:fs";
import assert from "node:assert/strict";
import { EMPRESA_PRINCIPAL_ID } from "../api/_persistence.js";

// v1190 — TRAVA CONTRA REGRESSÃO NO ISOLAMENTO ENTRE EMPRESAS.
//
// O servidor fala com o banco pela chave de serviço (service_role), que enxerga tudo: a separação
// entre um corretor e outro depende INTEIRAMENTE do código lembrar de filtrar por empresa em toda
// consulta. A auditoria da v1190 varreu as rotas e não achou vazamento — este teste existe pra que
// continue assim: uma consulta nova que esqueça o filtro derruba a suíte na hora.

const TABELAS_DE_CLIENTE = ["whatsapp_processamentos", "direciona_config"];

// Consultas que legitimamente não filtram por empresa, com a razão. Qualquer outra é erro.
const EXCECOES = new Set([
  // Varredura administrativa da conta original, que precisa saber o que é DAS OUTRAS empresas
  // justamente pra não tocar (usa .neq organization_id) — e a rota inteira já recusa quem não é
  // a empresa principal.
  "api/restaurar-leads.js:idsDeOutrasEmpresas"
]);

const arquivos = fs.readdirSync(new URL("../api/", import.meta.url)).filter(f => f.endsWith(".js"));
let conferidas = 0;

for (const nome of arquivos) {
  const caminho = `api/${nome}`;
  const src = fs.readFileSync(new URL(`../api/${nome}`, import.meta.url), "utf8");
  const re = /\.from\(\s*["'`](\w+)["'`]\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    if (!TABELAS_DE_CLIENTE.includes(m[1])) continue;
    const linha = src.slice(0, m.index).split("\n").length;
    // A cadeia da consulta: até o fim do statement (heurística generosa — 900 caracteres cobrem
    // as maiores cadeias do projeto, que têm select+eq+order+limit).
    const cadeia = src.slice(m.index, m.index + 900);
    const funcaoAcima = (src.slice(0, m.index).match(/(?:async\s+)?function\s+(\w+)/g) || []).pop() || "";
    const chaveExcecao = `${caminho}:${(funcaoAcima.match(/function\s+(\w+)/) || [])[1] || ""}`;
    if (EXCECOES.has(chaveExcecao)) continue;
    conferidas++;
    assert.ok(
      /organization_id/.test(cadeia),
      `${caminho}:${linha} — consulta em "${m[1]}" sem filtro por empresa:\n  ${cadeia.split("\n").slice(0, 6).join("\n  ")}`
    );
  }
}
assert.ok(conferidas >= 25, `a varredura precisa cobrir as consultas de verdade (cobriu ${conferidas})`);

// ── A identidade NUNCA vem do que o navegador manda ──────────────────────────────────────────
{
  const persistence = fs.readFileSync(new URL("../api/_persistence.js", import.meta.url), "utf8");
  const fn = persistence.match(/export async function resolveOrganizationId[\s\S]*?\n\}/)[0];
  assert.match(fn, /auth\.getUser\(bearer\)/, "o token de login é conferido com o Supabase, não aceito de boca");
  assert.match(fn, /\.from\("memberships"\)[\s\S]{0,200}?\.eq\("user_id", userData\.user\.id\)/,
    "a empresa vem do vínculo daquele usuário, nunca de um id mandado pelo cliente");
  assert.doesNotMatch(fn, /req\.body\??\.organizationId|req\.query\??\.organizationId/,
    "organization_id vindo do corpo/query não pode ser usado pra escopo de dados");

  // Toda rota resolve a identidade antes de tocar em dado.
  for (const nome of arquivos.filter(f => !f.startsWith("_"))) {
    const src = fs.readFileSync(new URL(`../api/${nome}`, import.meta.url), "utf8");
    assert.match(src, /resolveOrganizationId|resolveOrganizationIdByAtalhoToken|requireLoginSemEmpresa|requirePlatformAdmin/,
      `api/${nome} precisa identificar de quem é a chamada antes de qualquer coisa`);
  }
}

// ── A restauração da conta original continua recusando qualquer outra empresa ─────────────────
{
  const restaurar = fs.readFileSync(new URL("../api/restaurar-leads.js", import.meta.url), "utf8");
  assert.match(restaurar, /organizationId !== EMPRESA_PRINCIPAL_ID[\s\S]{0,160}?403/,
    "restaurar-leads reescreve dados da conta original — nenhuma outra empresa pode disparar isso");
  assert.equal(EMPRESA_PRINCIPAL_ID, "00000000-0000-0000-0000-000000000001");
}

// ── O conhecimento da IA (v1190) também é por empresa, na leitura E na gravação ───────────────
{
  const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  const grava = pipeline.match(/export async function atualizarConhecimentoCorretor[\s\S]*?\n\}/)[0];
  assert.match(grava, /\.eq\("organization_id", organizationId\)/);
  assert.match(grava, /upsertConfigComOrganizacao\(supabase, organizationId/);
  const le = pipeline.match(/export async function conhecimentoCorretorTexto[\s\S]*?\n\}/)[0];
  assert.match(le, /\.eq\("organization_id", organizationId\)/);
  assert.match(le, /_conhecimentoCorretorCache\.get\(organizationId\)/,
    "o cache do conhecimento é por empresa — nunca um bloco de uma conta servido pra outra");
}

console.log(`v1190-isolamento-entre-empresas: ok (${conferidas} consultas conferidas)`);
