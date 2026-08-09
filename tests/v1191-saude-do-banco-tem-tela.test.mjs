import fs from "node:fs";
import assert from "node:assert/strict";

// v1191 — A CONFERÊNCIA DO BANCO GANHOU TELA.
//
// A rota /api/diagnostico?mode=banco existe desde a v1185 e responde a pergunta mais importante
// da operação: "o banco que está no ar tem todas as travas que o código supõe que existem?".
// Só que ela EXIGE o login de administrador no cabeçalho da chamada — e nenhuma tela chamava.
// Resultado: abrir o endereço na barra do navegador devolve 403, e o dono não tinha COMO ver
// isso. Descoberto quando ele foi conferir a migração 0018 que a v1190 passou a exigir.
//
// É o mesmo achado da v1186 (recurso feito, testado, publicado e sem porta de entrada), e o
// motivo de este teste conferir a LIGAÇÃO entre tela e rota, não só a existência do código.

const html = fs.readFileSync(new URL("../admin-plataforma.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../contas-estilo.css", import.meta.url), "utf8");
const rota = fs.readFileSync(new URL("../api/diagnostico.js", import.meta.url), "utf8");

// ── 1. O cartão existe, aparece depois do login e tem botão de atualizar ─────────────────────
assert.match(html, /id="areaBanco"/, "o painel precisa ter o cartão da saúde do banco");
assert.match(html, /getElementById\('areaBanco'\)\.style\.display = ''/,
  "o cartão precisa ser exibido depois do login de administrador");
assert.match(html, /onclick="carregarBanco\(\)"/, "precisa ter botão pra conferir de novo");
assert.match(html, /carregarBanco\(\);/, "a conferência roda sozinha ao entrar no painel");

// ── 2. A tela chama a rota certa, COM o login no cabeçalho (era o que faltava) ────────────────
const fn = html.match(/async function carregarBanco\(\)[\s\S]*?\n\}/);
assert.ok(fn, "carregarBanco não encontrada");
assert.match(fn[0], /fetch\('\/api\/diagnostico\?mode=banco'/, "precisa chamar a conferência de verdade");
assert.match(fn[0], /'Authorization': `Bearer \$\{token\}`/,
  "sem o login no cabeçalho a rota devolve 403 — é exatamente por isso que colar o endereço no navegador não funciona");
assert.match(fn[0], /supabaseClient\.auth\.getSession\(\)/, "o token vem da sessão do administrador");

// ── 3. Os três estados possíveis da resposta têm tratamento na tela ───────────────────────────
assert.match(fn[0], /conferenciaDisponivel === false/,
  "banco que ainda não sabe se reportar (falta a 0017) precisa de texto próprio");
assert.match(fn[0], /Banco em dia/, "estado bom precisa aparecer escrito");
assert.match(fn[0], /faltando\.length/, "estado ruim mostra quantas faltam");
assert.match(fn[0], /Number\(f\.numero\) === 18/,
  "quando a 0018 é uma das que faltam, o aviso precisa dizer que o cadastro novo fica recusando (v1190)");
assert.match(fn[0], /SQL Editor/, "o passo a passo precisa dizer onde colar");
assert.match(fn[0], /supabase\/migrations/, "e de onde tirar o arquivo");

// ── 4. Nada de HTML cru vindo do servidor sem escapar ────────────────────────────────────────
for (const campo of ["r.resumo", "r.proximoPasso", "f.arquivo"]) {
  const re = new RegExp(`escapeHtml\\(${campo.replace(".", "\\.")}`);
  assert.match(fn[0], re, `${campo} precisa passar por escapeHtml antes de ir pra tela`);
}

// ── 5. O estilo do cartão existe (senão o aviso vermelho não fica vermelho) ───────────────────
assert.match(css, /\.banco-resumo\{/, "o cartão precisa de estilo próprio");
assert.match(css, /\.banco-resumo\.ok-banco\{/, "verde pra banco em dia");
assert.match(css, /\.banco-resumo\.falta-banco\{/, "vermelho pra banco atrasado");
assert.match(css, /\.banco-passo\{/, "o passo a passo precisa de estilo");

// ── 6. Do outro lado, a rota continua sendo exclusiva do administrador ────────────────────────
assert.match(rota, /if \(mode === "banco"\)[\s\S]{0,300}?getPlatformAdminUserId[\s\S]{0,200}?403/,
  "conferir o banco continua sendo exclusivo do administrador da plataforma");

console.log("v1191-saude-do-banco-tem-tela: ok");
