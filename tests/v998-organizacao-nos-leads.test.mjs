import http from "node:http";
import assert from "node:assert/strict";
import { EMPRESA_PRINCIPAL_ID } from "../api/_persistence.js";

// v998 — primeira tabela de dados de cliente (whatsapp_processamentos, a Carteira) passa a
// filtrar e gravar por organization_id. Sem login novo (caminho de hoje), tudo cai na empresa
// original — comportamento não muda pra quem já usa o app. Este teste prova, batendo no
// handler de verdade contra um servidor HTTP falso (mesmo padrão do v827-10/v827-15), que o
// filtro e a gravação de organization_id realmente saem na chamada de rede, não só existem
// como parâmetro morto no código.

const getQueries = [];
let corpoInserido = null;

const server = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Content-Type", "application/json");

  if (url.pathname === "/rest/v1/whatsapp_processamentos" && req.method === "GET") {
    getQueries.push(url.search);
    res.statusCode = 200;
    res.end("[]"); // nenhum lead existente ainda — força um INSERT novo
    return;
  }
  if (url.pathname === "/rest/v1/whatsapp_processamentos" && req.method === "POST") {
    corpoInserido = JSON.parse(body || "{}");
    res.statusCode = 201;
    res.end(JSON.stringify({ ...corpoInserido, id: "lead-novo-1" }));
    return;
  }
  if (url.pathname === "/rest/v1/direciona_config") {
    res.statusCode = req.method === "POST" ? 201 : 200;
    res.end(req.method === "POST" ? "{}" : "[]");
    return;
  }
  res.statusCode = 500;
  res.end(JSON.stringify({ error: `Rota simulada não atendida: ${req.method} ${url.pathname}`, body }));
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const port = server.address().port;
  process.env.NODE_ENV = "test";
  process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";

  const { default: handlerLeadUpdate } = await import(`../api/lead-update.js?v998=${Date.now()}`);

  const req = {
    method: "POST",
    headers: {}, // sem login novo e sem chave — em NODE_ENV=test isso ainda é aceito (bypass de teste)
    body: {
      action: "salvar-novo",
      result: {
        lead: { clientName: "Cliente Teste v998", phone: "11999990000" },
        analysis: { clientName: "Cliente Teste v998", summary: "resumo" },
        timeline: []
      }
    }
  };
  let statusCode = 0, response = "";
  const res = {
    status(n) { statusCode = n; return this; },
    setHeader() { return this; },
    end(value = "") { response += value; return this; }
  };
  await handlerLeadUpdate(req, res);
  const payload = JSON.parse(response);
  assert.equal(statusCode, 200, response);
  assert.equal(payload.ok, true);

  assert.ok(getQueries.length >= 1, "precisa ter consultado a tabela antes de decidir se é lead novo");
  for (const q of getQueries) {
    assert.match(q, new RegExp(`organization_id=eq\\.${EMPRESA_PRINCIPAL_ID}`), `busca de deduplicação precisa filtrar por organization_id, veio: ${q}`);
  }
  assert.ok(corpoInserido, "precisa ter inserido um registro novo");
  assert.equal(corpoInserido.organization_id, EMPRESA_PRINCIPAL_ID, "o registro criado precisa gravar organization_id da empresa (sem login novo, cai na principal)");

  console.log("v998-organizacao-nos-leads (persistProcessingResult): ok");
} finally {
  await new Promise(resolve => server.close(resolve));
}

// ---- Segunda parte: a listagem da Carteira (api/leads-recentes.js) também precisa filtrar. ----
{
  const listQueries = [];
  const server2 = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/rest/v1/whatsapp_processamentos" && req.method === "GET") {
      listQueries.push(url.search);
      res.statusCode = 200;
      res.end("[]");
      return;
    }
    res.statusCode = 500;
    res.end(JSON.stringify({ error: `Rota simulada não atendida: ${req.method} ${url.pathname}` }));
  });
  await new Promise(resolve => server2.listen(0, "127.0.0.1", resolve));
  try {
    const port2 = server2.address().port;
    process.env.SUPABASE_URL = `http://127.0.0.1:${port2}`;
    const { default: handlerLeadsRecentes } = await import(`../api/leads-recentes.js?v998=${Date.now()}`);
    const req2 = { method: "GET", headers: {}, query: { limit: "5", fresh: "1" } };
    let statusCode2 = 0, response2 = "";
    const res2 = {
      status(n) { statusCode2 = n; return this; },
      setHeader() { return this; },
      end(value = "") { response2 += value; return this; }
    };
    await handlerLeadsRecentes(req2, res2);
    assert.equal(statusCode2, 200, response2);
    assert.ok(listQueries.length >= 1, "a listagem da Carteira precisa ter consultado o banco");
    for (const q of listQueries) {
      assert.match(q, new RegExp(`organization_id=eq\\.${EMPRESA_PRINCIPAL_ID}`), `listagem da Carteira precisa filtrar por organization_id, veio: ${q}`);
    }
    console.log("v998-organizacao-nos-leads (listRecentProcessings): ok");
  } finally {
    await new Promise(resolve => server2.close(resolve));
  }
}
