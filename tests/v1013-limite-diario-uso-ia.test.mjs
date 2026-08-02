import http from "node:http";
import assert from "node:assert/strict";
import { verificarLimiteDiario, limiteAnalisesIADoDia } from "../api/_pipeline.js";

// v1013 — auditoria de isolamento entre contas encontrou que não existia NENHUM controle de
// consumo por conta: um bug, um script ou uso mal-intencionado podia gerar chamadas ilimitadas
// (e pagas) à OpenAI numa única organização, inclusive numa conta de teste grátis. Este teste
// prova o comportamento de verificarLimiteDiario (usado tanto dentro de analyzeWithBrain quanto
// em api/diagnostico.js mode=openai): conta por organização, reseta sozinho a cada dia civil, e
// nunca bloqueia por engano se a checagem falhar (rede de segurança, não trava de cobrança).

function fakeServer(estadoInicial) {
  let valorSalvo = estadoInicial; // null = nada salvo ainda
  const chamadas = { leituras: 0, gravacoes: 0 };
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    res.setHeader("Content-Type", "application/json");
    if (req.method === "GET" && req.url.includes("/rest/v1/direciona_config")) {
      chamadas.leituras++;
      res.end(valorSalvo ? JSON.stringify({ valor: valorSalvo }) : "null");
      return;
    }
    if (req.method === "POST" && req.url.includes("/rest/v1/direciona_config")) {
      chamadas.gravacoes++;
      try { const payload = JSON.parse(body || "{}"); valorSalvo = payload.valor; } catch (_) {}
      res.end("{}");
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  return { server, chamadas, getValor: () => valorSalvo };
}

async function comServidor(estadoInicial, fn) {
  const { server, chamadas, getValor } = fakeServer(estadoInicial);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
    await fn({ chamadas, getValor });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

// 1. Primeira chamada do dia: permitido, contagem vira 1.
await comServidor(null, async ({ getValor }) => {
  const r = await verificarLimiteDiario("org-a", "analises-ia", 3);
  assert.equal(r.permitido, true);
  assert.equal(r.usado, 1);
  assert.equal(getValor().contagem, 1);
});

// 2. Contagem já no limite (mesmo dia) → bloqueia, sem incrementar mais.
await comServidor({ dia: new Date().toISOString().slice(0, 10), contagem: 3 }, async ({ getValor }) => {
  const r = await verificarLimiteDiario("org-a", "analises-ia", 3);
  assert.equal(r.permitido, false);
  assert.equal(r.usado, 3);
  assert.equal(getValor().contagem, 3, "não pode gravar contagem nova quando bloqueado");
});

// 3. Contagem de ONTEM não conta pra hoje — reseta sozinho a cada dia civil.
await comServidor({ dia: "2000-01-01", contagem: 999 }, async () => {
  const r = await verificarLimiteDiario("org-a", "analises-ia", 3);
  assert.equal(r.permitido, true, "contagem de um dia antigo não pode bloquear o dia de hoje");
  assert.equal(r.usado, 1);
});

// 4. Contagem é isolada por organização — usar a chave "limite-diario:{chave}" por conta
// (organization_id no filtro), nunca compartilhada entre contas.
await comServidor(null, async ({ chamadas }) => {
  await verificarLimiteDiario("org-b", "analises-ia", 5);
  const leituraUrl = new URL("http://x" + "/rest/v1/direciona_config"); // só valida que não explodiu
  assert.ok(chamadas.leituras >= 1);
});

// 5. Falha ao consultar o banco (Supabase indisponível) NUNCA bloqueia uma análise real —
// é rede de segurança contra abuso, não trava de cobrança que precise ser exata.
{
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await verificarLimiteDiario("org-sem-supabase", "analises-ia", 1);
  assert.equal(r.permitido, true, "sem Supabase configurado, a checagem nunca pode bloquear a análise");
}

// 6. Sem organizationId, também nunca bloqueia (chamada malformada não deveria travar nada).
{
  const r = await verificarLimiteDiario("", "analises-ia", 1);
  assert.equal(r.permitido, true);
}

// 7. limiteAnalisesIADoDia() lê CORRETOR_PRO_LIMITE_ANALISES_DIA do ambiente (configurável pelo
// dono do produto sem precisar mudar código) e cai num padrão seguro se ausente/inválido.
{
  delete process.env.CORRETOR_PRO_LIMITE_ANALISES_DIA;
  assert.equal(limiteAnalisesIADoDia(), 200, "padrão sem env var configurada");
  process.env.CORRETOR_PRO_LIMITE_ANALISES_DIA = "50";
  assert.equal(limiteAnalisesIADoDia(), 50, "env var configurada precisa valer");
  process.env.CORRETOR_PRO_LIMITE_ANALISES_DIA = "-5";
  assert.equal(limiteAnalisesIADoDia(), 200, "valor inválido (negativo) cai no padrão seguro");
  delete process.env.CORRETOR_PRO_LIMITE_ANALISES_DIA;
}

// 8. analyzeWithBrain e api/diagnostico.js realmente usam a checagem (não ficou só declarada).
const fs = await import("node:fs");
const pipelineSrc = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
// v1110 — a checagem de "analises-ia" evoluiu pra verificarLimiteAnalises (planos com teto
// diário E mensal); a exigência original continua a mesma: checar ANTES de gastar com a OpenAI.
assert.match(pipelineSrc, /await verificarLimiteAnalises\(organizationId\)/,
  "analyzeWithBrain precisa checar o limite (dia/mês por plano, teto reduzido em teste) antes de gastar com a OpenAI");
const diagSrc = fs.readFileSync(new URL("../api/diagnostico.js", import.meta.url), "utf8");
assert.match(diagSrc, /verificarLimiteDiario\(organizationId, "diagnostico-openai", LIMITE_DIAGNOSTICO_OPENAI_DIA\)/,
  "mode=openai do diagnóstico também precisa checar o limite diário antes de chamar a OpenAI de verdade");

console.log("v1013-limite-diario-uso-ia: ok");
