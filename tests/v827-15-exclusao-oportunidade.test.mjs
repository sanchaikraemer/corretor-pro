import http from "node:http";
import assert from "node:assert/strict";
import { _buscarProcessamentoExistenteV681, _nomeIdentity, _nomeRuimIdentity, _nomesMesmoLead, EMPRESA_PRINCIPAL_ID } from "../api/_persistence.js";

// §v827-16 (plano de estabilização, item 1 — "separar cliente de oportunidade"):
// o NOME é o identificador real do cliente neste app (é o que vem estável do export do
// WhatsApp) — telefone é detectado varrendo o TEXTO da conversa e pode pegar qualquer
// número citado no meio do papo, não é confiável como identidade. Uma versão anterior
// (v827-15) tentou também barrar a fusão quando o "produto" identificado mudava entre
// duas reimportações — mas uma conversa real muda de assunto o tempo todo (cliente
// pergunta de um empreendimento e, mais adiante na MESMA conversa, de outro), então essa
// trava fragmentava um único cliente em vários cadastros. Corrigido: reimportar pelo
// mesmo nome SEMPRE atualiza o mesmo registro, não importa qual produto a IA
// identificar naquela rodada.
const supabaseFake = (rows) => ({
  from() {
    return { select() { return { eq() { return { order() { return { limit() { return Promise.resolve({ data: rows, error: null }); } }; } }; } }; } };
  }
});
const rowJoao = { id: "row-joao", telefone: "", resultado_analise: { produtoInteresse: "Personalité", clientName: "João Pedro" } };

const mesmoProduto = await _buscarProcessamentoExistenteV681(supabaseFake([rowJoao]), {
  result: { analysis: { produtoInteresse: "Personalité", clientName: "João Pedro" }, lead: { clientName: "João Pedro" } },
  fileName: "Conversa do WhatsApp com João Pedro.zip"
});
assert.equal(mesmoProduto?.row?.id, "row-joao", "mesmo nome + mesmo produto atualiza o registro existente");

// O caso que quebrava antes: a conversa evolui (cliente passa a falar de outro produto)
// e o corretor reimporta pra atualizar. Tem que continuar sendo o MESMO registro.
const produtoMudouNaMesmaConversa = await _buscarProcessamentoExistenteV681(supabaseFake([rowJoao]), {
  result: { analysis: { produtoInteresse: "Quality", clientName: "João Pedro" }, lead: { clientName: "João Pedro" } },
  fileName: "Conversa do WhatsApp com João Pedro.zip"
});
assert.equal(produtoMudouNaMesmaConversa?.row?.id, "row-joao", "reimportar pelo mesmo nome atualiza o mesmo registro mesmo se o produto identificado mudou");

// Nome claramente diferente continua não casando (isso nunca mudou).
const nomeDiferente = await _buscarProcessamentoExistenteV681(supabaseFake([rowJoao]), {
  result: { analysis: { produtoInteresse: "Personalité", clientName: "Maria Clara" }, lead: { clientName: "Maria Clara" } },
  fileName: "Conversa do WhatsApp com Maria Clara.zip"
});
assert.equal(nomeDiferente, null, "nome diferente não deve casar com o registro de outro cliente");

// Integração: apagar um lead não pode arrastar junto um cliente DIFERENTE cujo id o
// front tenha mandado por engano (cache antigo) — a exclusão em lote confere o nome.
const registros = {
  "lead-A": { id: "lead-A", resultado_analise: { clientName: "João Pedro" } },
  "lead-B": { id: "lead-B", resultado_analise: { clientName: "Maria Clara" } },
  "lead-C": { id: "lead-C", resultado_analise: { clientName: "João Pedro" } }
};
let deleteQuery = "";
const getQueries = []; // v999 — toda leitura em whatsapp_processamentos precisa filtrar por organization_id

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/storage/v1/object/list/whatsapp-zips" && req.method === "POST") {
    res.statusCode = 200;
    res.end("[]");
    return;
  }
  if (url.pathname === "/rest/v1/whatsapp_processamentos" && req.method === "GET") {
    getQueries.push(url.search);
    const select = url.searchParams.get("select") || "";
    if (select.includes("timeline_json")) {
      res.statusCode = 200;
      res.end("[]");
      return;
    }
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
  if (url.pathname === "/rest/v1/direciona_config" && req.method === "GET") {
    res.statusCode = 200;
    res.end("[]");
    return;
  }
  if (url.pathname === "/rest/v1/direciona_config" && ["DELETE", "POST"].includes(req.method)) {
    res.statusCode = req.method === "POST" ? 201 : 204;
    res.end(req.method === "POST" ? "[]" : "");
    return;
  }
  if (["/rest/v1/leads", "/rest/v1/direciona_leads"].includes(url.pathname) && req.method === "DELETE") {
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
  assert.ok(payload.ids.includes("lead-C"), "apaga o duplicado real (mesmo nome)");
  assert.ok(!payload.ids.includes("lead-B"), "NÃO apaga o cliente diferente");
  assert.ok(deleteQuery.includes("lead-A") && deleteQuery.includes("lead-C"), "o DELETE de fato só pediu os ids validados");
  assert.ok(!deleteQuery.includes("lead-B"), "o DELETE não pode incluir o cliente diferente");
  assert.match(deleteQuery, new RegExp(`organization_id=eq\\.${EMPRESA_PRINCIPAL_ID}`), "o DELETE de leads precisa filtrar por organization_id");
  // v1002 — a exceção que existia aqui (aprenderRespostasDaCarteira lia a carteira inteira sem
  // filtro, porque o banco de exemplos do Cérebro era um "balde" global) acabou: agora TODA
  // leitura de whatsapp_processamentos nesse fluxo, inclusive a da reconstrução do banco de
  // exemplos, precisa sair filtrada por organization_id.
  assert.ok(getQueries.length >= 1, "precisa ter consultado a tabela antes de apagar");
  for (const q of getQueries) {
    assert.match(q, new RegExp(`organization_id=eq\\.${EMPRESA_PRINCIPAL_ID}`), `toda leitura no fluxo de apagar precisa filtrar por organization_id, veio: ${q}`);
  }

  console.log("v827-15-exclusao-oportunidade: ok");
} finally {
  await new Promise(resolve => server.close(resolve));
}
