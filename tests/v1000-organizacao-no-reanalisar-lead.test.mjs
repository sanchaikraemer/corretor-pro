import http from "node:http";
import assert from "node:assert/strict";
import { EMPRESA_PRINCIPAL_ID } from "../api/_persistence.js";

// v1000 — api/reanalisar-lead.js (remover item da conversa, marcar/desmarcar atendido,
// reagendar/remover lembrete e a reanálise completa) passa a exigir e filtrar por
// organization_id, igual já foi feito em leads-recentes.js e lead-update.js. Este teste bate
// nas ações "rápidas" (sem chamar IA) contra um servidor HTTP falso e confirma que toda
// leitura e gravação saem filtradas pra rede.

const queries = [];

const server = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Content-Type", "application/json");

  if (url.pathname === "/rest/v1/whatsapp_processamentos") {
    queries.push({ method: req.method, search: url.search });
    if (req.method === "GET") {
      res.statusCode = 200;
      res.end(JSON.stringify({
        timeline_json: [{ iso: "2026-07-01T10:00:00-03:00", author: "Cliente", text: "oi" }],
        resultado_analise: { aprendizado: { eventos: [] }, lembrete: null },
        nome_arquivo: "Conversa do WhatsApp com Cliente Teste.zip",
        etapa: "Novo"
      }));
      return;
    }
    if (req.method === "PATCH") {
      res.statusCode = 204;
      res.end();
      return;
    }
  }
  res.statusCode = 500;
  res.end(JSON.stringify({ error: `rota simulada não atendida: ${req.method} ${url.pathname}${url.search}`, body }));
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const port = server.address().port;
  process.env.NODE_ENV = "test";
  process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
  const { default: handler } = await import(`../api/reanalisar-lead.js?v1000=${Date.now()}`);

  async function chamar(body) {
    let statusCode = 0, response = "";
    const req = { method: "POST", headers: {}, body };
    const res = {
      status(n) { statusCode = n; return this; },
      setHeader() { return this; },
      end(value = "") { response += value; return this; }
    };
    await handler(req, res);
    return { statusCode, payload: response ? JSON.parse(response) : null };
  }

  const acoes = [
    { action: "remover-item", id: "lead-1", iso: "2026-07-01T10:00:00-03:00" },
    { action: "marcar-atendido", id: "lead-1" },
    { action: "desmarcar-atendido", id: "lead-1" },
    { action: "reagendar-lembrete", id: "lead-1", data: "2026-08-01" },
    { action: "remover-lembrete", id: "lead-1" }
  ];

  for (const acao of acoes) {
    const { statusCode, payload } = await chamar(acao);
    assert.equal(statusCode, 200, `ação "${acao.action}" deveria responder 200, veio ${statusCode}: ${JSON.stringify(payload)}`);
    assert.equal(payload?.ok, true, `ação "${acao.action}" deveria responder ok:true`);
  }

  assert.ok(queries.length >= acoes.length, "cada ação precisa ter batido na rede pelo menos uma vez");
  for (const q of queries) {
    assert.match(q.search, new RegExp(`organization_id=eq\\.${EMPRESA_PRINCIPAL_ID}`),
      `toda chamada (${q.method} ${q.search}) precisa filtrar por organization_id`);
  }

  console.log(`v1000-organizacao-no-reanalisar-lead: ok (${acoes.length} ações, ${queries.length} chamadas à rede, todas filtradas)`);
} finally {
  await new Promise(resolve => server.close(resolve));
}
