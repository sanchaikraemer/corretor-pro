import http from "node:http";
import assert from "node:assert/strict";
import { verificarLimiteDiario, limiteAnalisesIADoDia, limiteAnalisesIADoDiaTeste } from "../api/_pipeline.js";

// v1041 — auditoria item 6.3 ("Abuso do período de teste"): uma conta em teste grátis tinha
// exatamente o mesmo teto diário de análises de IA que uma conta paga (200/dia) — criar contas de
// teste era um jeito barato de consumir IA de graça. Agora, enquanto a organização estiver com
// status "teste", o teto diário cai bastante (25 por padrão); assim que virar "ativo" (pagou),
// volta pro limite normal automaticamente — sem precisar de nenhuma ação manual na virada.

function fakeServer({ statusOrganizacao, valorSalvo = null }) {
  const chamadas = { organizations: 0, config: 0 };
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/rest/v1/organizations" && req.method === "GET") {
      chamadas.organizations++;
      res.end(statusOrganizacao ? JSON.stringify({ status: statusOrganizacao }) : "null");
      return;
    }
    if (url.pathname === "/rest/v1/direciona_config" && req.method === "GET") {
      chamadas.config++;
      res.end(valorSalvo ? JSON.stringify({ valor: valorSalvo }) : "null");
      return;
    }
    if (url.pathname === "/rest/v1/direciona_config" && req.method === "POST") {
      res.end("{}");
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  return { server, chamadas };
}

async function comServidor(opts, fn) {
  const { server, chamadas } = fakeServer(opts);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
    await fn(chamadas);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

// 1. Organização em teste: usa o teto REDUZIDO, não o normal.
await comServidor({ statusOrganizacao: "teste" }, async (chamadas) => {
  const r = await verificarLimiteDiario("org-teste", "analises-ia", 200, 25);
  assert.equal(r.limite, 25, "empresa em teste precisa cair no teto reduzido, não no de 200");
  assert.equal(r.permitido, true);
  assert.equal(chamadas.organizations, 1, "precisa ter consultado o status da organização");
});

// 2. Organização ativa (pagando): continua no teto normal, mesmo com limiteTeste informado.
await comServidor({ statusOrganizacao: "ativo" }, async () => {
  const r = await verificarLimiteDiario("org-ativa", "analises-ia", 200, 25);
  assert.equal(r.limite, 200, "empresa ativa (pagando) não pode ser afetada pelo teto de teste");
});

// 3. Sem limiteTeste informado (chamador não pediu o comportamento novo): nunca consulta
// organizations — comportamento idêntico ao de antes desta versão (compatibilidade).
await comServidor({ statusOrganizacao: "teste" }, async (chamadas) => {
  const r = await verificarLimiteDiario("org-x", "analises-ia", 200);
  assert.equal(r.limite, 200, "sem limiteTeste, o comportamento antigo (teto único) continua valendo");
  assert.equal(chamadas.organizations, 0, "sem limiteTeste, nem precisa consultar o status da organização");
});

// 4. Organização sem status reconhecido (base antiga, ou consulta falhou) — nunca bloqueia por
// engano: cai no teto normal, igual ao comportamento fail-open já testado em v1013.
await comServidor({ statusOrganizacao: null }, async () => {
  const r = await verificarLimiteDiario("org-sem-status", "analises-ia", 200, 25);
  assert.equal(r.limite, 200, "organização sem status reconhecido cai no teto normal, nunca no reduzido por engano");
});

// 5. O teto reduzido realmente bloqueia mais cedo que o normal — não é só um número decorativo.
await comServidor({ statusOrganizacao: "teste", valorSalvo: { dia: new Date().toISOString().slice(0, 10), contagem: 25 } }, async () => {
  const r = await verificarLimiteDiario("org-teste-no-limite", "analises-ia", 200, 25);
  assert.equal(r.permitido, false, "com 25 já usadas e teto de teste = 25, a próxima análise precisa ser bloqueada");
  assert.equal(r.limite, 25);
});

// 6. limiteAnalisesIADoDiaTeste() lê CORRETOR_PRO_LIMITE_ANALISES_DIA_TESTE do ambiente, com
// padrão seguro (bem menor que o normal) se ausente/inválido.
{
  delete process.env.CORRETOR_PRO_LIMITE_ANALISES_DIA_TESTE;
  const padrao = limiteAnalisesIADoDiaTeste();
  assert.ok(padrao > 0 && padrao < limiteAnalisesIADoDia(), "padrão do teste precisa ser positivo e menor que o limite normal");
  process.env.CORRETOR_PRO_LIMITE_ANALISES_DIA_TESTE = "10";
  assert.equal(limiteAnalisesIADoDiaTeste(), 10, "env var configurada precisa valer");
  process.env.CORRETOR_PRO_LIMITE_ANALISES_DIA_TESTE = "-5";
  assert.equal(limiteAnalisesIADoDiaTeste(), padrao, "valor inválido (negativo) cai no padrão seguro");
  delete process.env.CORRETOR_PRO_LIMITE_ANALISES_DIA_TESTE;
}

console.log("v1041-limite-menor-durante-teste: ok");
