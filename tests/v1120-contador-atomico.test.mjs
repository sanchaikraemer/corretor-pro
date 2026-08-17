// v1120 — os contadores de análise passam a poder reservar de forma ATÔMICA (função reservar_analise_ia
// da migração 0012): checar+somar numa transação só, com trava por empresa, pra cliques simultâneos
// não furarem o teto. Se a função não existir no banco (0012 não aplicada) ou der erro, o app volta
// pro jeito antigo — nunca bloqueia à toa.
//
// Este teste sobe um Supabase de mentira que RESPONDE à função nova (rpc) e confirma que:
//   • quando a função existe, o app usa a resposta dela (não faz a leitura/gravação antiga);
//   • quando a função não existe (404), o app cai no jeito antigo e ainda funciona.

import assert from "node:assert/strict";
import http from "node:http";
import { verificarLimiteAnalises } from "../api/_pipeline.js";

function fakeServer({ rpc = null, status = "ativo", diario = 0 }) {
  const chamadas = { rpc: 0, configGet: 0, configPost: 0 };
  const server = http.createServer(async (req, res) => {
    let body = ""; for await (const c of req) body += c;
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/rest/v1/rpc/reservar_analise_ia" && req.method === "POST") {
      chamadas.rpc++;
      if (rpc === null) { res.statusCode = 404; return res.end(JSON.stringify({ message: "function does not exist" })); }
      return res.end(JSON.stringify(rpc));
    }
    if (url.pathname === "/rest/v1/organizations") return res.end(JSON.stringify({ status }));
    if (url.pathname === "/rest/v1/direciona_config" && req.method === "GET") {
      chamadas.configGet++;
      const chave = decodeURIComponent(url.searchParams.get("chave") || "");
      if (chave.includes("limite-diario:analises-ia")) return res.end(diario ? JSON.stringify({ valor: { dia: hoje(), contagem: diario } }) : "null");
      return res.end("null");
    }
    if (url.pathname === "/rest/v1/direciona_config" && req.method === "POST") { chamadas.configPost++; return res.end("{}"); }
    res.statusCode = 404; res.end("{}");
  });
  return { server, chamadas };
}
function hoje() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()); }

async function com(opts, orgId, fn) {
  const { server, chamadas } = fakeServer(opts);
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  try {
    process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
    const r = await verificarLimiteAnalises(orgId);
    await fn(r, chamadas);
  } finally { await new Promise(r => server.close(r)); }
}

// 1) Função nova EXISTE e libera: o app usa a resposta dela e NÃO faz a gravação antiga.
await com({ rpc: { permitido: true, usado_dia: 8, usado_mes: 40, motivo: null } }, "org-1", (r, c) => {
  assert.equal(r.permitido, true, "reserva atômica liberada");
  assert.equal(r.usado, 8, "usa a contagem do dia devolvida pela função");
  assert.equal(r.usadoMes, 40, "usa a contagem do mês devolvida pela função");
  assert.equal(c.rpc, 1, "chamou a função atômica");
  assert.equal(c.configPost, 0, "NÃO fez a gravação antiga (a função já somou de forma atômica)");
});

// 2) Função nova EXISTE e bloqueia por mês: o app respeita o bloqueio sem gravar nada.
await com({ rpc: { permitido: false, usado_dia: 3, usado_mes: 50, motivo: "mes" } }, "org-2", (r, c) => {
  assert.equal(r.permitido, false, "reserva atômica bloqueou");
  assert.equal(r.motivo, "mes");
  assert.equal(c.configPost, 0, "bloqueio atômico não grava contador antigo");
});

// 3) Função NÃO existe (404): cai no jeito antigo e ainda decide certo (Pro — v1284: o fusível
// técnico do dia é 40; o pacote do mês, 50).
await com({ rpc: null, diario: 40 }, "org-3", (r, c) => {
  assert.equal(c.rpc, 1, "tentou a função atômica primeiro");
  assert.equal(r.permitido, false, "sem a função, o jeito antigo bloqueia a 16ª do Pro");
  assert.equal(r.motivo, "dia");
  assert.equal(r.limite, 40);
});

console.log("v1120-contador-atomico: ok");
