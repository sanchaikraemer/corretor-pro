import http from "node:http";
import assert from "node:assert/strict";
import handler from "../api/admin-contas.js";

// v1226 — o dono mandou print do painel com dois selos lado a lado na MESMA conta: "💰 R$ 2,64
// hoje" e "0/150 hoje". Não batia: gasto de dinheiro hoje com zero análises hoje.
//
// Os dois números vinham de relógios diferentes. O contador de análises vira o dia à meia-noite de
// Brasília (diaCalendarioSP, em api/_pipeline.js). O relatório de custo cortava o dia com
// setUTCHours(0,0,0,0) — meia-noite de Londres, 21h de Brasília. Nas três primeiras horas do dia
// em Brasília, o gasto do fim da noite anterior ainda entrava como "hoje" na coluna do dinheiro,
// enquanto a coluna das análises já tinha zerado.
//
// Este teste prende os dois no mesmo dia de calendário de Brasília.

function fakeRes() {
  return {
    statusCode: 200,
    payload: null,
    status(codigo) { this.statusCode = codigo; return this; },
    setHeader() {},
    end(corpo) { this.payload = corpo ? JSON.parse(corpo) : null; }
  };
}

const ADMIN_USER_ID = "admin-plataforma-1";

function montarServidorFake({ eventos, organizacoes }) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/auth/v1/user") return res.end(JSON.stringify({ id: ADMIN_USER_ID }));
    if (url.pathname === "/rest/v1/platform_admins") return res.end(JSON.stringify({ user_id: ADMIN_USER_ID }));
    if (url.pathname === "/rest/v1/organizations") return res.end(JSON.stringify(organizacoes));
    if (url.pathname === "/rest/v1/ai_usage_events") return res.end(JSON.stringify(eventos));
    res.statusCode = 404;
    res.end("{}");
  });
}

async function comServidor(dados, fn) {
  const server = montarServidorFake(dados);
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const antes = { url: process.env.SUPABASE_URL, chave: process.env.SUPABASE_SERVICE_ROLE_KEY };
  try {
    process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
    return await fn();
  } finally {
    process.env.SUPABASE_URL = antes.url;
    process.env.SUPABASE_SERVICE_ROLE_KEY = antes.chave;
    await new Promise(r => server.close(r));
  }
}

const ORG = "org-do-print";

// Dia de calendário de Brasília — a MESMA régua usada pelo contador de análises.
const diaSP = (data) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(data);
const hojeSP = diaSP(new Date());
const ontemSP = diaSP(new Date(new Date(`${hojeSP}T12:00:00-03:00`).getTime() - 86400000));

// 22h de ontem em Brasília = 01h de hoje em UTC: era exatamente esse gasto que aparecia como
// "hoje" no selo do dinheiro depois da virada da meia-noite de Brasília.
const ONTEM_22H_BR = new Date(`${ontemSP}T22:00:00-03:00`).toISOString();
const HOJE_00H30_BR = new Date(`${hojeSP}T00:30:00-03:00`).toISOString();

await comServidor({
  organizacoes: [{ id: ORG, nome: "Empresa 1" }],
  eventos: [
    { organization_id: ORG, kind: "chat", model: "gpt-4.1", rota: "analise", prompt_tokens: 3000, completion_tokens: 800, audio_seconds: 0, criado_em: ONTEM_22H_BR },
    { organization_id: ORG, kind: "chat", model: "gpt-4.1", rota: "analise", prompt_tokens: 3000, completion_tokens: 800, audio_seconds: 0, criado_em: HOJE_00H30_BR }
  ]
}, async () => {
  const res = fakeRes();
  await handler({ method: "GET", headers: { authorization: "Bearer x" }, query: { relatorio: "uso-ia", dias: "30" } }, res);
  assert.equal(res.statusCode, 200);
  const empresa = res.payload.empresas.find(e => e.organizationId === ORG);
  assert.ok(empresa, "a empresa precisa aparecer no relatório");

  assert.equal(empresa.hoje.chamadas, 1,
    "gasto das 22h de ONTEM em Brasília não pode entrar no 'hoje' do custo — é isso que fazia o painel mostrar dinheiro gasto hoje com 0 análises hoje");
  assert.equal(empresa.categoriasHoje.analise.chamadas, 1,
    "a separação por categoria precisa usar o mesmo dia de Brasília");
  assert.equal(empresa.periodo.chamadas, 2, "os 30 dias continuam somando os dois eventos");
  assert.equal(res.payload.totalGeral.hoje.chamadas, 1,
    "o total da plataforma ('Chamadas hoje' / 'Custo estimado hoje') usa a mesma régua de dia");
});

console.log("v1226-custo-hoje-usa-dia-de-brasilia: ok");
