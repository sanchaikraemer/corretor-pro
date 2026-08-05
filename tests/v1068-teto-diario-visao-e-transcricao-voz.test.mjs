import http from "node:http";
import assert from "node:assert/strict";

// v1133 — usava a data em UTC como "hoje", mas o código conta o limite pelo dia civil de
// São Paulo. Depois das 21h em Brasília já é o dia seguinte em UTC, e o teste falhava sozinho
// toda noite (ver a explicação completa em tests/v1013-limite-diario-uso-ia.test.mjs).
const _hojeSP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

// v1068 — auditoria de segurança achou que transcrever-audio (api/cerebro-config.js) chamava a
// OpenAI sem NENHUM teto diário — diferente da análise principal (api/_pipeline.js,
// verificarLimiteDiario, desde a v1013). Um script (ou uma conta de teste grátis, o mesmo cenário
// que motivou a v1041) podia gerar chamadas de Whisper ilimitadas, sem nenhuma rede de segurança.
// Este teste confirma, contra o handler de verdade e um servidor HTTP falso simulando o Supabase,
// que a ação agora recusa (HTTP 429) depois que o teto configurado é atingido.
// v1069 — extrair-print, detectar-rosto e ler-prints-conversa (que também tinham o mesmo teto,
// junto com transcrever-audio) foram deletadas do código por pedido do dono (nunca funcionaram
// bem, ele nunca vai usar essas três) — os testes dessas três ações saíram daqui.

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
      const hoje = _hojeSP;
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
  CORRETOR_PRO_LIMITE_TRANSCRICAO_VOZ_DIA: process.env.CORRETOR_PRO_LIMITE_TRANSCRICAO_VOZ_DIA
};
function restaurarEnv() {
  for (const [k, v] of Object.entries(envAntes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
}
process.env.NODE_ENV = "test";
// Precisa de uma chave (mesmo falsa) pra getOpenAI() devolver um cliente de verdade — senão a
// ação retorna "indisponível agora" ANTES de chegar no teto diário, e o teste não provaria nada
// sobre o teto. Como o teto é sempre atingido abaixo, a função nunca chega a fazer a chamada de
// rede de verdade (retorna 429 antes disso).
process.env.OPENAI_API_KEY = "sk-fake-test-key-nao-usada-de-verdade";
process.env.CORRETOR_PRO_LIMITE_TRANSCRICAO_VOZ_DIA = "5";

try {
  const { default: cerebroHandler } = await import(`../api/cerebro-config.js?v1068b=${Date.now()}`);

  // transcrever-audio (api/cerebro-config.js): com o teto (5) já atingido, recusa com 429.
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
