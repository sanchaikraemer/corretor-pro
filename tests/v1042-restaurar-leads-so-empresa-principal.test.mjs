import fs from "node:fs";
import http from "node:http";
import assert from "node:assert/strict";
import { EMPRESA_PRINCIPAL_ID } from "../api/_persistence.js";

// v1042 — auditando a redução de dependência da chave compartilhada antiga (auditoria item 4.1),
// achado real: api/restaurar-leads.js só checava a chave (requireApiKey), nunca de qual empresa
// era o pedido. Como o app anexa essa chave automaticamente em TODA chamada de QUALQUER corretor
// logado (ver v1037), e a função window.restaurarLeadsAntigos(true) fica exposta global no
// navegador, qualquer conta conseguia disparar — inclusive com force:true — uma reescrita dos
// dados da empresa principal a partir das tabelas legadas. Esta rota só faz sentido pra empresa
// principal (é a única dona das tabelas legadas "leads"/"direciona_leads"); agora exige a
// identidade real de quem chama e recusa qualquer empresa que não seja a principal.

function fakeRes() {
  let statusCode = 200, payload = "";
  return {
    status(n) { statusCode = n; return this; },
    setHeader() { return this; },
    end(v = "") { payload += v; return this; },
    get statusCode() { return statusCode; },
    get payload() { return payload; }
  };
}

function criarServidor(organizationId) {
  const chamadas = [];
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url, "http://localhost");
    chamadas.push({ method: req.method, pathname: url.pathname });
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/rest/v1/memberships") {
      res.end(JSON.stringify({ organization_id: organizationId, organizations: { status: "ativo", trial_expira_em: null } }));
      return;
    }
    if (url.pathname === "/auth/v1/user") { res.end(JSON.stringify({ id: "user-teste" })); return; }
    res.end("[]"); // whatsapp_processamentos/leads/direciona_leads — só interessa se a rota chegou até lá
  });
  return { server, chamadas };
}

async function comServidor(organizationId, fn) {
  const { server, chamadas } = criarServidor(organizationId);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
    await fn(chamadas);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

process.env.NODE_ENV = "test";

// 1. Empresa QUALQUER (login novo, não a principal) — recusada com 403, nunca chega a ler/gravar
// nas tabelas legadas.
await comServidor("org-outra-empresa-999", async (chamadas) => {
  const { default: handler } = await import(`../api/restaurar-leads.js?v1042a=${Date.now()}`);
  const req = { method: "POST", headers: { authorization: "Bearer token-outra-empresa" }, body: { force: true } };
  const res = fakeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 403, res.payload);
  assert.ok(!chamadas.some(c => c.pathname === "/rest/v1/leads" || c.pathname === "/rest/v1/direciona_leads" || c.pathname === "/rest/v1/whatsapp_processamentos"),
    "empresa que não é a principal nunca pode chegar a ler/gravar as tabelas legadas, nem com force:true");
  console.log("v1042 (empresa qualquer): restaurar-leads recusa com 403 — ok");
});

// 2. Empresa PRINCIPAL — continua funcionando (chega a consultar as tabelas normalmente).
await comServidor(EMPRESA_PRINCIPAL_ID, async (chamadas) => {
  const { default: handler } = await import(`../api/restaurar-leads.js?v1042b=${Date.now()}`);
  const req = { method: "GET", headers: {} };
  const res = fakeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200, res.payload);
  assert.ok(chamadas.some(c => c.pathname === "/rest/v1/whatsapp_processamentos"), "empresa principal precisa continuar conseguindo restaurar, sem regressão");
  console.log("v1042 (empresa principal): restaurar-leads continua funcionando — ok");
});

// 3. app.js: garantirRestauracaoLeadsAntigos marca como "tentado" mesmo quando a chamada falha
// (agora sempre falha com 403 pra qualquer empresa que não seja a principal) — senão toda outra
// empresa repetiria essa chamada perdida em todo carregamento, pra sempre.
{
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const funcSrc = app.match(/async function garantirRestauracaoLeadsAntigos\(\)\{[\s\S]*?\n\}/)?.[0] || "";
  assert.ok(funcSrc, "achei garantirRestauracaoLeadsAntigos em app.js");
  assert.match(funcSrc, /catch\(_\)\{[\s\S]*localStorage\.setItem\(LEGACY_RESTORE_KEY/,
    "precisa marcar LEGACY_RESTORE_KEY mesmo no catch (falha), não só no caminho de sucesso");
}

console.log("v1042-restaurar-leads-so-empresa-principal: ok");
