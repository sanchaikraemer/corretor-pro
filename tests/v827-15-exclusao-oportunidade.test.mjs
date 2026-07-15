import http from "node:http";
import assert from "node:assert/strict";
import { _produtosIncompativeis, _buscarProcessamentoExistenteV681 } from "../api/_persistence.js";

// §v827-15 (plano de estabilização, item 1 — "separar cliente de oportunidade"):
// telefone identifica o CONTATO, não a NEGOCIAÇÃO. Dois produtos diferentes e
// identificados no mesmo telefone (ex.: apartamento e sala comercial do mesmo
// cliente) são oportunidades distintas — nunca podem ser tratadas como o mesmo
// registro só porque telefone ou nome batem.
assert.equal(_produtosIncompativeis({ produtoInteresse: "Apartamento Renaissance" }, { produtoInteresse: "Sala Comercial Centro" }), true, "produtos diferentes e identificados são incompatíveis");
assert.equal(_produtosIncompativeis({ produtoInteresse: "Apartamento Renaissance" }, { produtoInteresse: "Apartamento Renaissance" }), false, "mesmo produto não é incompatível");
assert.equal(_produtosIncompativeis({ produtoInteresse: "Não identificado" }, { produtoInteresse: "Sala Comercial Centro" }), false, "sem produto identificado de um lado, não bloqueia (reimportação normal)");
assert.equal(_produtosIncompativeis({}, {}), false, "sem produto identificado nos dois lados, não bloqueia");

// Mesmo telefone, mas o cliente já negocia OUTRO produto identificado (ex.: já tem um
// apartamento em andamento e agora fala de uma sala comercial): a reimportação/nova
// análise não pode cair dentro do registro do apartamento — precisa virar um lead novo.
const supabaseFake = (rows) => ({
  from() {
    return { select() { return { order() { return { limit() { return Promise.resolve({ data: rows, error: null }); } }; } }; } };
  }
});
const rowApartamento = { id: "row-apto", telefone: "5511999998888", resultado_analise: { produtoInteresse: "Apartamento Renaissance", lead: { phone: "5511999998888" } } };

const mesmoProduto = await _buscarProcessamentoExistenteV681(supabaseFake([rowApartamento]), {
  result: { analysis: { produtoInteresse: "Apartamento Renaissance", lead: { phone: "5511999998888" } }, lead: { phone: "5511999998888" } },
  fileName: "Conversa do WhatsApp com Cliente X.zip"
});
assert.equal(mesmoProduto?.row?.id, "row-apto", "mesmo telefone + mesmo produto deve atualizar o registro existente");

const produtoNovo = await _buscarProcessamentoExistenteV681(supabaseFake([rowApartamento]), {
  result: { analysis: { produtoInteresse: "Sala Comercial Centro", lead: { phone: "5511999998888" } }, lead: { phone: "5511999998888" } },
  fileName: "Conversa do WhatsApp com Cliente X.zip"
});
assert.equal(produtoNovo, null, "mesmo telefone + produto DIFERENTE e identificado deve virar oportunidade nova (não achar registro existente)");

// Integração: apagar um lead não pode arrastar junto uma oportunidade diferente do
// mesmo contato, mesmo que o front (com cache antigo) mande o id dela em `ids`.
const registros = {
  "lead-A": { id: "lead-A", telefone: "5511999998888", resultado_analise: { produtoInteresse: "Apartamento Renaissance", lead: { phone: "5511999998888" } } },
  "lead-B": { id: "lead-B", telefone: "5511999998888", resultado_analise: { produtoInteresse: "Sala Comercial Centro", lead: { phone: "5511999998888" } } },
  "lead-C": { id: "lead-C", telefone: "5511999998888", resultado_analise: { produtoInteresse: "Apartamento Renaissance", lead: { phone: "5511999998888" } } }
};
let deleteQuery = "";

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/rest/v1/whatsapp_processamentos" && req.method === "GET") {
    res.statusCode = 200;
    res.end(JSON.stringify(Object.values(registros)));
    return;
  }
  if (url.pathname === "/rest/v1/whatsapp_processamentos" && req.method === "DELETE") {
    deleteQuery = url.search;
    res.statusCode = 204;
    res.end();
    return;
  }
  res.statusCode = 500;
  res.end(JSON.stringify({ error: `Rota simulada não atendida: ${req.method} ${url.pathname}` }));
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const port = server.address().port;
  process.env.NODE_ENV = "test";
  process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
  const { default: handler } = await import(`../api/lead-update.js?integration=${Date.now()}`);

  const req = {
    method: "POST",
    headers: {},
    body: { action: "apagar", id: "lead-A", ids: ["lead-A", "lead-B", "lead-C"] }
  };
  let statusCode = 0, response = "";
  const res = {
    status(n) { statusCode = n; return this; },
    setHeader() { return this; },
    end(value = "") { response += value; return this; }
  };
  await handler(req, res);
  const payload = JSON.parse(response);
  assert.equal(statusCode, 200, response);
  assert.equal(payload.ok, true);
  assert.ok(payload.ids.includes("lead-A"), "apaga o alvo principal");
  assert.ok(payload.ids.includes("lead-C"), "apaga o duplicado real (mesmo contato e mesmo produto)");
  assert.ok(!payload.ids.includes("lead-B"), "NÃO apaga a oportunidade diferente do mesmo contato");
  assert.ok(deleteQuery.includes("lead-A") && deleteQuery.includes("lead-C"), "o DELETE de fato só pediu os ids validados");
  assert.ok(!deleteQuery.includes("lead-B"), "o DELETE não pode incluir a oportunidade diferente");

  console.log("v827-15-exclusao-oportunidade: ok");
} finally {
  await new Promise(resolve => server.close(resolve));
}
