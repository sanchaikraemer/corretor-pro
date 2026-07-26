import http from "node:http";
import assert from "node:assert/strict";
import { EMPRESA_PRINCIPAL_ID } from "../api/_persistence.js";
import { ORGANIZACAO_PADRAO_LEGADA, upsertConfigComOrganizacao } from "../api/_pipeline.js";

// v1002 — o Cérebro (e todo o aprendizado da IA guardado em direciona_config) passa a ser
// separado por corretor: toda leitura filtra por organization_id e toda gravação carimba o
// dono e usa a unicidade nova "por corretor + chave" (migração 0004), com fallback pra regra
// antiga enquanto a migração não tiver sido aplicada no banco.

// 1. A constante padrão do pipeline precisa ser a MESMA conta original de _persistence.js
// (são definidas em arquivos separados só pra evitar import circular).
assert.equal(ORGANIZACAO_PADRAO_LEGADA, EMPRESA_PRINCIPAL_ID,
  "ORGANIZACAO_PADRAO_LEGADA (pipeline) divergiu de EMPRESA_PRINCIPAL_ID (persistence)");

// 2. O helper de gravação: caminho principal usa a unicidade nova e carimba o dono…
{
  const chamadas = [];
  const fake = { from() { return { upsert(payload, opts) { chamadas.push({ payload, opts }); return Promise.resolve({ error: null }); } }; } };
  await upsertConfigComOrganizacao(fake, "org-teste", { chave: "direciona-cerebro", valor: { tom: "x" } });
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].opts.onConflict, "organization_id,chave", "gravação precisa usar a unicidade por corretor + chave");
  assert.equal(chamadas[0].payload.organization_id, "org-teste", "gravação precisa carimbar o dono na linha");
}

// …e, se a migração 0004 ainda não rodou no banco (a unicidade nova não existe), cai na regra
// antiga sem quebrar — continuando a carimbar o dono.
{
  const chamadas = [];
  const fake = { from() { return { upsert(payload, opts) {
    chamadas.push({ payload, opts });
    if (opts.onConflict === "organization_id,chave") {
      return Promise.resolve({ error: { message: "there is no unique or exclusion constraint matching the ON CONFLICT specification" } });
    }
    return Promise.resolve({ error: null });
  } }; } };
  const r = await upsertConfigComOrganizacao(fake, "org-teste", { chave: "direciona-cerebro", valor: {} });
  assert.equal(chamadas.length, 2, "com a unicidade nova ausente, precisa tentar de novo com a regra antiga");
  assert.equal(chamadas[1].opts.onConflict, "chave");
  assert.equal(chamadas[1].payload.organization_id, "org-teste", "mesmo no fallback, o dono precisa ser carimbado");
  assert.equal(r.error, null);
}

// 3. Ponta a ponta na rota do Cérebro (api/cerebro-config.js) contra um servidor falso:
// a leitura sai filtrada por organization_id e o save grava com on_conflict novo + dono no corpo.
{
  const gets = [];
  const upserts = [];
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/rest/v1/direciona_config" && req.method === "GET") {
      gets.push(url.search);
      res.statusCode = 200;
      res.end("[]");
      return;
    }
    if (url.pathname === "/rest/v1/direciona_config" && req.method === "POST") {
      upserts.push({ search: url.search, body: JSON.parse(body || "{}") });
      res.statusCode = 201;
      res.end("[]");
      return;
    }
    res.statusCode = 500;
    res.end(JSON.stringify({ error: `rota simulada não atendida: ${req.method} ${url.pathname}${url.search}` }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    process.env.NODE_ENV = "test";
    process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
    const { default: handler } = await import(`../api/cerebro-config.js?v1002=${Date.now()}`);

    async function chamar(method, body) {
      let statusCode = 0, response = "";
      const req = { method, headers: {}, query: {}, body };
      const res = {
        status(n) { statusCode = n; return this; },
        setHeader() { return this; },
        end(value = "") { response += value; return this; }
      };
      await handler(req, res);
      return { statusCode, payload: response ? JSON.parse(response) : null };
    }

    const leitura = await chamar("GET");
    assert.equal(leitura.statusCode, 200, JSON.stringify(leitura.payload));
    assert.ok(gets.length >= 1, "GET do Cérebro precisa ter lido o banco");
    for (const q of gets) {
      assert.match(q, new RegExp(`organization_id=eq\\.${EMPRESA_PRINCIPAL_ID}`),
        `toda leitura de direciona_config precisa filtrar por organization_id, veio: ${q}`);
    }

    const save = await chamar("POST", { corretorNome: "Teste v1002", metodo: "método de teste" });
    assert.equal(save.statusCode, 200, JSON.stringify(save.payload));
    assert.ok(upserts.length >= 1, "o save do Cérebro precisa ter gravado no banco");
    const gravacao = upserts[upserts.length - 1];
    assert.match(decodeURIComponent(gravacao.search), /on_conflict=organization_id,chave/,
      `o save precisa usar a unicidade por corretor + chave, veio: ${gravacao.search}`);
    const linha = Array.isArray(gravacao.body) ? gravacao.body[0] : gravacao.body;
    assert.equal(linha.organization_id, EMPRESA_PRINCIPAL_ID, "o save precisa carimbar o dono na linha gravada");
    assert.equal(linha.chave, "direciona-cerebro");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

console.log("v1002-cerebro-por-corretor: ok");
