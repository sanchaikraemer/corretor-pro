import http from "node:http";
import assert from "node:assert/strict";
import { EMPRESA_PRINCIPAL_ID } from "../api/_persistence.js";

// v1005 — o painel administrativo ganhou o botão "Excluir" (conta de teste inteira: dados,
// vínculos, organização, arquivos e login), pra nunca mais precisar de SQL colado na mão. Este
// teste bate na rota de verdade (api/admin-contas.js) contra um servidor falso e prova:
// (1) quem não é administrador da plataforma é recusado; (2) a conta original nunca pode ser
// excluída; (3) na exclusão válida, a exclusão de dados vira UMA chamada transacional (RPC), o
// Storage da conta é limpo e o login some.
//
// v1013 — auditoria de isolamento entre contas encontrou 3 problemas nesta mesma rota:
// (a) não apagava arquivos do Storage da conta; (b) apagava as 4 tabelas uma de cada vez, sem
// transação (falha no meio deixava dado órfão); (c) erro ao apagar o login era ignorado (podia
// responder ok:true com o login ainda existindo). Este teste foi reescrito pra cobrir as 3
// correções: (a) chamada RPC única (transacional, ver migração 0007) em vez de 4 DELETEs soltos;
// (b) limpeza do Storage escopada pela conta; (c) erro no auth.admin.deleteUser aparece em
// loginsComErro, nunca é escondido atrás de um ok:true.

const chamadas = [];
let ehAdmin = true;
let loginComErro = false;

const server = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Content-Type", "application/json");
  chamadas.push({ method: req.method, path: url.pathname, search: url.search, body });

  if (url.pathname === "/auth/v1/user") { res.end(JSON.stringify({ id: "admin-1" })); return; }
  if (url.pathname.startsWith("/auth/v1/admin/users/") && req.method === "DELETE") {
    if (loginComErro) { res.statusCode = 400; res.end(JSON.stringify({ message: "falha simulada ao apagar login" })); return; }
    res.end("{}");
    return;
  }
  if (url.pathname === "/rest/v1/rpc/excluir_organizacao") {
    if (req.method !== "POST") { res.statusCode = 405; res.end("{}"); return; }
    let payload;
    try { payload = JSON.parse(body || "{}"); } catch (_) { payload = {}; }
    // A própria function do banco recusaria a conta original — o teste 2 nunca chega aqui
    // porque a rota já bloqueia antes de chamar o RPC, mas fica coerente com a migração 0007.
    if (payload.p_organization_id === EMPRESA_PRINCIPAL_ID) {
      res.statusCode = 400;
      res.end(JSON.stringify({ message: "A conta original não pode ser excluída." }));
      return;
    }
    res.end(JSON.stringify({ nome: "Conta de Teste", ids_usuarios: ["11111111-2222-3333-4444-555555555555"] }));
    return;
  }
  if (url.pathname === "/rest/v1/memberships" && req.method === "GET") {
    const select = url.searchParams.get("select") || "";
    if (select.includes("organizations")) { res.end(JSON.stringify({ organization_id: EMPRESA_PRINCIPAL_ID, organizations: { status: "ativo", trial_expira_em: null } })); return; }
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
  // Storage: bucket "vazio" nos testes — só interessa aqui que a rota TENTA limpar (ver
  // asserções abaixo), a paginação de verdade já é coberta por tests/v959-limpar-tudo-...
  if (url.pathname.includes("/storage/v1/object/list/")) { res.end("[]"); return; }
  if (url.pathname.includes("/storage/v1/object/")) { res.end("[]"); return; }
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

  // 2. A conta original nunca pode ser excluída, nem pelo administrador (bloqueado ANTES de
  // chamar o RPC — a rota já checa isso, a function do banco checa de novo por segurança).
  ehAdmin = true;
  {
    const { statusCode, payload } = await chamar({ action: "excluir-conta", organizationId: EMPRESA_PRINCIPAL_ID });
    assert.equal(statusCode, 400, JSON.stringify(payload));
    assert.match(String(payload?.error || ""), /original/i);
  }

  // 3. Exclusão válida: dados saem numa ÚNICA chamada RPC transacional; Storage é limpo (2
  // prefixos: whatsapp/organizations/{id} e organizations/{id}); o login some.
  chamadas.length = 0;
  {
    const { statusCode, payload } = await chamar({ action: "excluir-conta", organizationId: "org-teste" });
    assert.equal(statusCode, 200, JSON.stringify(payload));
    assert.equal(payload.ok, true);
    assert.equal(payload.loginsApagados, 1, "o login da conta excluída precisa ser apagado");
    assert.equal(payload.loginsComErro, undefined, "sem falha simulada, não pode haver login com erro");
    assert.ok(payload.storage, "resposta precisa trazer o resultado da limpeza de Storage");

    const rpcCall = chamadas.find(c => c.path === "/rest/v1/rpc/excluir_organizacao");
    assert.ok(rpcCall, "exclusão de dados precisa usar a function transacional excluir_organizacao");
    assert.match(rpcCall.body, /org-teste/, "RPC precisa receber o id da conta certa");

    const deletesSoltosDeDados = chamadas.filter(c => c.method === "DELETE" && /^\/rest\/v1\/(whatsapp_processamentos|direciona_config|memberships|organizations)$/.test(c.path));
    assert.equal(deletesSoltosDeDados.length, 0, "não pode mais existir DELETE solto por tabela — tudo passa pela function transacional");

    const listStorage = chamadas.filter(c => c.path.includes("/storage/v1/object/list/"));
    assert.ok(listStorage.length >= 2, "precisa listar o Storage em pelo menos os 2 prefixos da conta (zip e dados)");
    assert.ok(listStorage.some(c => c.body && c.body.includes(`whatsapp/organizations/org-teste`)), "precisa listar o prefixo do ZIP da conta");
    assert.ok(listStorage.some(c => c.body && c.body.includes(`organizations/org-teste`)), "precisa listar o prefixo de manifestos/cache da conta");

    const deleteLogin = chamadas.find(c => c.method === "DELETE" && c.path.startsWith("/auth/v1/admin/users/"));
    assert.ok(deleteLogin, "o login (auth) da conta excluída precisa ser apagado");
  }

  // 4. Erro real ao apagar o login NUNCA pode ficar escondido atrás de ok:true — precisa
  // aparecer em loginsComErro.
  chamadas.length = 0;
  loginComErro = true;
  {
    const { statusCode, payload } = await chamar({ action: "excluir-conta", organizationId: "org-teste" });
    assert.equal(statusCode, 200, JSON.stringify(payload));
    assert.equal(payload.ok, true, "os DADOS já foram excluídos (transação separada da conta de login) — resposta continua ok:true");
    assert.equal(payload.loginsApagados, 0, "login que falhou não pode contar como apagado");
    assert.ok(Array.isArray(payload.loginsComErro) && payload.loginsComErro.length === 1, "erro real ao apagar login precisa aparecer em loginsComErro, nunca ser escondido");
    assert.match(String(payload.aviso || ""), /não puderam ser removidos/i, "resposta precisa avisar claramente sobre o login que não foi removido");
  }
  loginComErro = false;

  console.log("v1005-excluir-conta-pelo-painel: ok");
} finally {
  await new Promise(resolve => server.close(resolve));
}
