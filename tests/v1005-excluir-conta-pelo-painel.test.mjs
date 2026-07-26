import http from "node:http";
import assert from "node:assert/strict";
import { EMPRESA_PRINCIPAL_ID } from "../api/_persistence.js";

// v1005 — o painel administrativo ganhou o botão "Excluir" (conta de teste inteira: dados,
// vínculos, organização e login), pra nunca mais precisar de SQL colado na mão. Este teste
// bate na rota de verdade (api/admin-contas.js) contra um servidor falso e prova:
// (1) quem não é administrador da plataforma é recusado; (2) a conta original nunca pode ser
// excluída; (3) na exclusão válida, todo DELETE sai filtrado pela conta certa e o login some.

const chamadas = [];
let ehAdmin = true;

const server = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Content-Type", "application/json");
  chamadas.push({ method: req.method, path: url.pathname, search: url.search });

  if (url.pathname === "/auth/v1/user") { res.end(JSON.stringify({ id: "admin-1" })); return; }
  if (url.pathname.startsWith("/auth/v1/admin/users/") && req.method === "DELETE") { res.end("{}"); return; }
  if (url.pathname === "/rest/v1/memberships" && req.method === "GET") {
    const select = url.searchParams.get("select") || "";
    if (select.includes("organizations")) { res.end(JSON.stringify({ organization_id: EMPRESA_PRINCIPAL_ID, organizations: { status: "ativo", trial_expira_em: null } })); return; }
    if (url.searchParams.get("organization_id")) { res.end(JSON.stringify([{ user_id: "11111111-2222-3333-4444-555555555555" }])); return; }
    res.end("[]"); // checagem de vínculo restante do login: nenhum → pode apagar o login
    return;
  }
  if (url.pathname === "/rest/v1/platform_admins" && req.method === "GET") {
    const uid = url.searchParams.get("user_id") || "";
    if (uid.includes("admin-1")) { res.end(ehAdmin ? JSON.stringify({ user_id: "admin-1" }) : "null"); return; }
    res.end("null"); // o login da conta excluída não é admin
    return;
  }
  if (url.pathname === "/rest/v1/organizations" && req.method === "GET") { res.end(JSON.stringify({ id: "org-teste", nome: "Conta de Teste" })); return; }
  if (req.method === "DELETE") { res.statusCode = 204; res.end(); return; }
  res.statusCode = 500;
  res.end(JSON.stringify({ error: `rota simulada não atendida: ${req.method} ${url.pathname}${url.search}` }));
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const port = server.address().port;
  process.env.NODE_ENV = "test";
  process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
  const { default: handler } = await import(`../api/admin-contas.js?v1005=${Date.now()}`);

  async function chamar(body) {
    let statusCode = 0, response = "";
    const req = { method: "POST", headers: { authorization: "Bearer token-admin" }, body };
    const res = {
      status(n) { statusCode = n; return this; },
      setHeader() { return this; },
      end(value = "") { response += value; return this; }
    };
    await handler(req, res);
    return { statusCode, payload: response ? JSON.parse(response) : null };
  }

  // 1. Quem não é administrador da plataforma é recusado.
  ehAdmin = false;
  {
    const { statusCode, payload } = await chamar({ action: "excluir-conta", organizationId: "org-teste" });
    assert.equal(statusCode, 403, JSON.stringify(payload));
  }

  // 2. A conta original nunca pode ser excluída, nem pelo administrador.
  ehAdmin = true;
  {
    const { statusCode, payload } = await chamar({ action: "excluir-conta", organizationId: EMPRESA_PRINCIPAL_ID });
    assert.equal(statusCode, 400, JSON.stringify(payload));
    assert.match(String(payload?.error || ""), /original/i);
  }

  // 3. Exclusão válida: todos os DELETE de dados saem filtrados pela conta certa; o login some.
  chamadas.length = 0;
  {
    const { statusCode, payload } = await chamar({ action: "excluir-conta", organizationId: "org-teste" });
    assert.equal(statusCode, 200, JSON.stringify(payload));
    assert.equal(payload.ok, true);
    assert.equal(payload.loginsApagados, 1, "o login da conta excluída precisa ser apagado");
    const deletesDados = chamadas.filter(c => c.method === "DELETE" && c.path.startsWith("/rest/v1/"));
    assert.ok(deletesDados.length >= 4, `esperava DELETE em whatsapp/config/memberships/organizations, veio: ${JSON.stringify(deletesDados)}`);
    for (const d of deletesDados) {
      assert.ok(/organization_id=eq\.org-teste|id=eq\.org-teste/.test(d.search), `DELETE precisa mirar só a conta excluída: ${d.path}${d.search}`);
    }
    const deleteLogin = chamadas.find(c => c.method === "DELETE" && c.path.startsWith("/auth/v1/admin/users/"));
    assert.ok(deleteLogin, "o login (auth) da conta excluída precisa ser apagado");
  }

  console.log("v1005-excluir-conta-pelo-painel: ok");
} finally {
  await new Promise(resolve => server.close(resolve));
}
