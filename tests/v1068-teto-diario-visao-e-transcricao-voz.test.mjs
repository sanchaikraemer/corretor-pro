import http from "node:http";
import assert from "node:assert/strict";

// v1068 — auditoria de segurança achou que extrair-print, detectar-rosto e ler-prints-conversa
// (api/lead-update.js) e transcrever-audio (api/cerebro-config.js) chamavam a OpenAI sem NENHUM
// teto diário — diferente da análise principal (api/_pipeline.js, verificarLimiteDiario, desde a
// v1013). Um script (ou uma conta de teste grátis, o mesmo cenário que motivou a v1041) podia
// gerar chamadas de visão/Whisper ilimitadas, sem nenhuma rede de segurança. Este teste confirma,
// contra o handler de verdade e um servidor HTTP falso simulando o Supabase, que as quatro ações
// agora recusam (HTTP 429) depois que o teto configurado é atingido.

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

async function comServidor(contagemJaUsada, fn) {
  const chamadasConfig = [];
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/auth/v1/user") { res.end(JSON.stringify({ id: "user-teste" })); return; }
    if (url.pathname === "/rest/v1/memberships") {
      res.end(JSON.stringify({ organization_id: "org-teste", organizations: { status: "ativo", trial_expira_em: null } }));
      return;
    }
    if (url.pathname === "/rest/v1/direciona_config" && req.method === "GET") {
      chamadasConfig.push(url.search);
      // Simula que a conta já usou "contagemJaUsada" chamadas hoje, pra esse "chave" específico.
      const hoje = new Date().toISOString().slice(0, 10);
      res.end(JSON.stringify({ valor: { dia: hoje, contagem: contagemJaUsada } }));
      return;
    }
    if (url.pathname === "/rest/v1/direciona_config") { res.end("{}"); return; } // upsert (grava contagem)
    res.statusCode = 500;
    res.end(JSON.stringify({ error: `rota simulada não atendida: ${req.method} ${url.pathname}` }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-de-teste";
    await fn(chamadasConfig);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

const envAntes = {
  NODE_ENV: process.env.NODE_ENV, SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  CORRETOR_PRO_LIMITE_VISAO_DIA: process.env.CORRETOR_PRO_LIMITE_VISAO_DIA,
  CORRETOR_PRO_LIMITE_TRANSCRICAO_VOZ_DIA: process.env.CORRETOR_PRO_LIMITE_TRANSCRICAO_VOZ_DIA
};
function restaurarEnv() {
  for (const [k, v] of Object.entries(envAntes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
}
process.env.NODE_ENV = "test";
// Precisa de uma chave (mesmo falsa) pra getOpenAI() devolver um cliente de verdade — senão as
// ações retornam "indisponível agora" ANTES de chegar no teto diário, e o teste não provaria
// nada sobre o teto. Como o teto é sempre atingido nos três casos abaixo, a função nunca chega
// a fazer a chamada de rede de verdade (retorna 429 antes disso).
process.env.OPENAI_API_KEY = "sk-fake-test-key-nao-usada-de-verdade";
process.env.CORRETOR_PRO_LIMITE_VISAO_DIA = "5";
process.env.CORRETOR_PRO_LIMITE_TRANSCRICAO_VOZ_DIA = "5";

try {
  const { default: handler } = await import(`../api/lead-update.js?v1068a=${Date.now()}`);
  const { default: cerebroHandler } = await import(`../api/cerebro-config.js?v1068b=${Date.now()}`);

  // 1. extrair-print: com o teto (5) já atingido, recusa com 429 — antes desta correção não
  // existia nenhum teto, então esta ação nunca teria sido barrada.
  await comServidor(5, async () => {
    const req = { method: "POST", headers: { authorization: "Bearer token-teste" }, body: { action: "extrair-print", imagemBase64: "data:image/png;base64,AAAA" } };
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 429, res.payload);
    const r = JSON.parse(res.payload);
    assert.match(r.error, /Limite diário/);
    console.log("v1068 (extrair-print): recusa com 429 depois do teto diário — ok");
  });

  // 2. detectar-rosto: mesmo teto, mesmo comportamento.
  await comServidor(5, async () => {
    const req = { method: "POST", headers: { authorization: "Bearer token-teste" }, body: { action: "detectar-rosto", imagemBase64: "data:image/png;base64,AAAA" } };
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 429, res.payload);
    console.log("v1068 (detectar-rosto): recusa com 429 depois do teto diário — ok");
  });

  // 3. ler-prints-conversa: mesmo teto, mesmo comportamento.
  await comServidor(5, async () => {
    const req = { method: "POST", headers: { authorization: "Bearer token-teste" }, body: { action: "ler-prints-conversa", imagens: ["data:image/png;base64,AAAA"] } };
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 429, res.payload);
    console.log("v1068 (ler-prints-conversa): recusa com 429 depois do teto diário — ok");
  });

  // 4. transcrever-audio (api/cerebro-config.js): mesmo teto, rota diferente.
  await comServidor(5, async () => {
    const req = { method: "POST", headers: { authorization: "Bearer token-teste" }, body: { action: "transcrever-audio", audioBase64: "AAAA" } };
    const res = fakeRes();
    await cerebroHandler(req, res);
    assert.equal(res.statusCode, 429, res.payload);
    const r = JSON.parse(res.payload);
    assert.match(r.error, /Limite diário/);
    console.log("v1068 (transcrever-audio): recusa com 429 depois do teto diário — ok");
  });
} finally {
  restaurarEnv();
}

console.log("v1068-teto-diario-visao-e-transcricao-voz: ok");
