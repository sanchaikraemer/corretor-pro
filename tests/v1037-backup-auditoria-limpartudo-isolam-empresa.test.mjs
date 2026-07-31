import http from "node:http";
import assert from "node:assert/strict";
import { EMPRESA_PRINCIPAL_ID } from "../api/_persistence.js";

// v1037 — auditoria externa (ver NOTAS-v1037.md) achou que api/leads-recentes.js (?audit=1 e
// ?export=full, os botões "Auditar"/"Backup" da Carteira) e api/limpar-tudo.js (botão "Apagar
// tudo" das Configurações) liam/apagavam a base INTEIRA do Supabase, de TODAS as empresas, só
// protegidos pela chave compartilhada — que o app.js anexa automaticamente em toda chamada.
// Ou seja: qualquer corretor logado (não só o dono da plataforma) conseguia baixar ou apagar o
// backup de todos os outros clientes do SaaS clicando num botão normal da própria tela dele.
//
// Este teste bate nas rotas de verdade contra um servidor HTTP falso (mesmo padrão do
// v998/v1005) e prova, pras duas rotas:
// 1. Uma empresa QUALQUER (login novo, não a principal) só lê/apaga a PRÓPRIA organization_id —
//    nunca lê/apaga a base toda, e nunca toca nas tabelas legadas (leads/direciona_leads/
//    corretor_pro_backups, que não têm organization_id e só pertencem à empresa original).
// 2. A empresa principal (caminho antigo, sem login novo) continua funcionando exatamente como
//    antes — sem regressão pra quem já usa o sistema hoje.

function fakeRes() {
  let statusCode = 200;
  let payload = "";
  return {
    get statusCode() { return statusCode; },
    status(n) { statusCode = n; return this; },
    setHeader() { return this; },
    end(v = "") { payload += v; return this; },
    get payload() { return payload; }
  };
}

function criarServidor({ organizationId, extraHandlers = {} }) {
  const chamadas = []; // { method, pathname, search, body }
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url, "http://localhost");
    chamadas.push({ method: req.method, pathname: url.pathname, search: url.search, body });
    res.setHeader("Content-Type", "application/json");

    if (url.pathname === "/auth/v1/user") { res.end(JSON.stringify({ id: "user-teste" })); return; }
    if (url.pathname === "/rest/v1/memberships") {
      res.end(JSON.stringify({ organization_id: organizationId, organizations: { status: "ativo", trial_expira_em: null } }));
      return;
    }
    const custom = extraHandlers[url.pathname];
    if (custom) { custom(req, res, url, body); return; }
    // Qualquer rota não prevista responde vazio (não deve quebrar o handler) — os testes abaixo
    // verificam em `chamadas` que rotas indevidas (tabela legada de outra empresa, storage fora
    // do prefixo certo) simplesmente NUNCA são chamadas.
    if (req.method === "HEAD") { res.setHeader("content-range", "*/0"); res.end(); return; }
    res.end("[]");
  });
  return { server, chamadas };
}

async function comServidor(organizationId, extraHandlers, fn) {
  const { server, chamadas } = criarServidor({ organizationId, extraHandlers });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key-de-teste";
    await fn(chamadas);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

const envAntes = { NODE_ENV: process.env.NODE_ENV, npm_lifecycle_event: process.env.npm_lifecycle_event, DIRECIONA_DANGER_LIMPAR_TUDO: process.env.DIRECIONA_DANGER_LIMPAR_TUDO };
function restaurarEnv() {
  for (const [k, v] of Object.entries(envAntes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
}

try {
  process.env.NODE_ENV = "test";

  // ---------------------------------------------------------------------------------------
  // PARTE 1 — api/leads-recentes.js, empresa QUALQUER (não a principal): audit e export só
  // podem ler a própria organização, nunca a base toda nem as tabelas legadas.
  // ---------------------------------------------------------------------------------------
  await comServidor("org-outra-empresa-999", {}, async (chamadas) => {
    const { default: handler } = await import(`../api/leads-recentes.js?v1037a=${Date.now()}`);

    const reqAudit = { method: "GET", headers: { authorization: "Bearer token-outra-empresa" }, query: { audit: "1" } };
    const resAudit = fakeRes();
    await handler(reqAudit, resAudit);
    assert.equal(resAudit.statusCode, 200, resAudit.payload);

    const reqExport = { method: "GET", headers: { authorization: "Bearer token-outra-empresa" }, query: { export: "full" } };
    const resExport = fakeRes();
    await handler(reqExport, resExport);
    assert.equal(resExport.statusCode, 200, resExport.payload);

    const paraWhatsapp = chamadas.filter(c => c.pathname === "/rest/v1/whatsapp_processamentos");
    assert.ok(paraWhatsapp.length >= 2, "audit e export precisam ter consultado whatsapp_processamentos");
    for (const c of paraWhatsapp) {
      assert.match(c.search, /organization_id=eq\.org-outra-empresa-999/, `consulta a whatsapp_processamentos precisa filtrar pela própria empresa, veio: ${c.search}`);
    }

    const paraConfig = chamadas.filter(c => c.pathname === "/rest/v1/direciona_config");
    assert.ok(paraConfig.length >= 1, "export precisa ter consultado direciona_config (o Cérebro)");
    for (const c of paraConfig) {
      assert.match(c.search, /organization_id=eq\.org-outra-empresa-999/, `consulta a direciona_config precisa filtrar pela própria empresa, veio: ${c.search}`);
    }

    // O ponto central do achado: tabelas legadas (só existem pra empresa ORIGINAL) nunca podem
    // ser lidas por conta de outra empresa — antes desta correção eram lidas sempre, de todo mundo.
    for (const tabelaLegada of ["/rest/v1/leads", "/rest/v1/direciona_leads", "/rest/v1/corretor_pro_backups"]) {
      assert.ok(!chamadas.some(c => c.pathname === tabelaLegada), `empresa que não é a principal NUNCA pode consultar ${tabelaLegada}`);
    }

    console.log("v1037 (leads-recentes.js, empresa qualquer): audit/export isolados por organization_id — ok");
  });

  // ---------------------------------------------------------------------------------------
  // PARTE 2 — api/leads-recentes.js, empresa PRINCIPAL (caminho antigo, sem login novo):
  // continua funcionando como antes — inclui as tabelas legadas no backup.
  // ---------------------------------------------------------------------------------------
  await comServidor(EMPRESA_PRINCIPAL_ID, {}, async (chamadas) => {
    const { default: handler } = await import(`../api/leads-recentes.js?v1037b=${Date.now()}`);
    const req = { method: "GET", headers: {}, query: { export: "full" } };
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 200, res.payload);

    const paraWhatsapp = chamadas.filter(c => c.pathname === "/rest/v1/whatsapp_processamentos");
    assert.ok(paraWhatsapp.length >= 1);
    for (const c of paraWhatsapp) assert.match(c.search, new RegExp(`organization_id=eq\\.${EMPRESA_PRINCIPAL_ID}`));

    for (const tabelaLegada of ["/rest/v1/leads", "/rest/v1/direciona_leads", "/rest/v1/corretor_pro_backups"]) {
      assert.ok(chamadas.some(c => c.pathname === tabelaLegada), `empresa principal precisa continuar incluindo ${tabelaLegada} no backup (sem regressão)`);
    }

    console.log("v1037 (leads-recentes.js, empresa principal): sem regressão — ok");
  });

  // ---------------------------------------------------------------------------------------
  // PARTES 3 e 4 (removidas na v1083) — cobriam api/limpar-tudo.js, a rota do botão
  // "Apagar tudo". A rota e o botão foram apagados a pedido do dono ("nunca será usado
  // mesmo"), então não há mais o que isolar aqui. O isolamento por empresa continua coberto
  // nas partes 1 e 2 acima (leads-recentes.js: auditoria e backup) e, pra exclusão de dados,
  // em tests/v1005-excluir-conta-pelo-painel (api/admin-contas.js), que é o único caminho
  // que ainda apaga dados de uma conta.
} finally {
  restaurarEnv();
}

console.log("v1037-backup-auditoria-limpartudo-isolam-empresa: ok");
