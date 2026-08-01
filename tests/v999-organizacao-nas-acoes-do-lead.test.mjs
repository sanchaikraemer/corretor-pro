import http from "node:http";
import assert from "node:assert/strict";
import { EMPRESA_PRINCIPAL_ID } from "../api/_persistence.js";

// v999 — segunda leva de ações de api/lead-update.js passam a filtrar por organization_id:
// mudar etapa, memória, observação, aprendizado, editar dados, lembretes e apagar (apagar já
// tem seu próprio teste de integração em v827-15-exclusao-oportunidade.test.mjs, reforçado
// nesta mesma versão). Este teste bate no handler de verdade contra um servidor HTTP falso e
// confirma que CADA uma dessas ações manda o filtro pra rede — não só aceita o parâmetro.

const queries = []; // { method, search }

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
        id: "lead-1",
        resultado_analise: { clientName: "Cliente Teste v999", memoria: {}, aprendizado: { eventos: [] } },
        timeline_json: []
      }));
      return;
    }
    if (req.method === "PATCH") {
      const written = JSON.parse(body || "{}");
      if (url.searchParams.get("select")) {
        res.statusCode = 200;
        res.end(JSON.stringify({ id: "lead-1", ...written }));
      } else {
        res.statusCode = 204;
        res.end();
      }
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
  const { default: handler } = await import(`../api/lead-update.js?v999=${Date.now()}`);

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
    { action: "etapa", id: "lead-1", etapa: "Ativo" },
    { action: "memoria-set", id: "lead-1", observacoes: "nota de memória" },
    { action: "observacao-adicionar", id: "lead-1", texto: "cliente pediu retorno amanhã" },
    { action: "aprendizado", id: "lead-1", evento: "teste-v999" },
    // v1092 — "lembrete-set" e "lembrete-clear" saíram daqui porque as duas ações foram
    // removidas da API: nenhuma tela do app as chamou em nenhum momento do projeto.
    { action: "editar-dados", id: "lead-1", nome: "Novo Nome" }
  ];

  // Ação que não existe mais precisa ser RECUSADA, nunca respondida como se tivesse funcionado.
  for (const extinta of ["lembrete-set", "lembrete-clear"]) {
    const { statusCode, payload } = await chamar({ action: extinta, id: "lead-1", dias: 3 });
    assert.notEqual(statusCode, 200, `a ação removida "${extinta}" não pode responder sucesso`);
    assert.notEqual(payload?.ok, true, `a ação removida "${extinta}" não pode responder ok:true`);
  }

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

  console.log(`v999-organizacao-nas-acoes-do-lead: ok (${acoes.length} ações, ${queries.length} chamadas à rede, todas filtradas)`);
} finally {
  await new Promise(resolve => server.close(resolve));
}
