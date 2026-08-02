import http from "node:http";
import fs from "node:fs";
import assert from "node:assert/strict";
import { verificarLimiteAnalises, planoComercial, PLANO_CONTRATADO_KEY } from "../api/_pipeline.js";

// v1110 — planos comerciais (decisão do dono, estratégia de chamariz tipo "pipoca de cinema"):
// Teste 5/dia · Pro 25/dia + 250/mês · Pro Master 50/dia + 500/mês (o dobro em tudo, preço
// próximo — o preço nunca aparece no app). Cada limite atingido é um degrau de venda no
// WhatsApp comercial. A conta original fica FORA dos planos (só o fusível técnico de 200/dia).

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const adminContas = fs.readFileSync(new URL("../api/admin-contas.js", import.meta.url), "utf8");
const painel = fs.readFileSync(new URL("../admin-plataforma.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const EMPRESA_PRINCIPAL = "00000000-0000-0000-0000-000000000001";
const hoje = new Date().toISOString().slice(0, 10);
const mesSP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);

// ── 1. Os números dos planos (com env mandando) ───────────────────────────────────────────────
{
  for (const nome of ["CORRETOR_PRO_LIMITE_DIA_PRO", "CORRETOR_PRO_LIMITE_MES_PRO", "CORRETOR_PRO_LIMITE_DIA_PROMASTER", "CORRETOR_PRO_LIMITE_MES_PROMASTER"]) delete process.env[nome];
  assert.deepEqual({ ...planoComercial("pro") }, { tipo: "pro", nome: "Pro", dia: 25, mes: 250 }, "Pro: 25/dia e 250/mês");
  assert.deepEqual({ ...planoComercial("pro-master") }, { tipo: "pro-master", nome: "Pro Master", dia: 50, mes: 500 }, "Pro Master: 50/dia e 500/mês (o dobro)");
  assert.equal(planoComercial("qualquer-coisa").tipo, "pro", "tipo desconhecido cai no plano de entrada (Pro)");
  assert.equal(planoComercial("").tipo, "pro", "conta ativa sem plano registrado = Pro");
  process.env.CORRETOR_PRO_LIMITE_MES_PRO = "999";
  assert.equal(planoComercial("pro").mes, 999, "variável de ambiente manda sobre o padrão");
  delete process.env.CORRETOR_PRO_LIMITE_MES_PRO;
}

// ── 2. verificarLimiteAnalises: dia + mês por plano, teste e conta original ───────────────────
function fakeServer({ status = "ativo", plano = null, diario = 0, mensal = 0 }) {
  const chamadas = { organizations: 0, gravacoes: [] };
  const server = http.createServer(async (req, res) => {
    let body = ""; for await (const c of req) body += c;
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/rest/v1/organizations" && req.method === "GET") {
      chamadas.organizations++;
      return res.end(JSON.stringify({ status }));
    }
    if (url.pathname === "/rest/v1/direciona_config" && req.method === "GET") {
      const chave = decodeURIComponent(url.searchParams.get("chave") || "");
      if (chave.includes("limite-diario:analises-ia")) return res.end(diario ? JSON.stringify({ valor: { dia: hoje, contagem: diario } }) : "null");
      if (chave.includes("limite-mensal:analises-ia")) return res.end(mensal ? JSON.stringify({ valor: { mes: mesSP, contagem: mensal } }) : "null");
      if (chave.includes(PLANO_CONTRATADO_KEY)) return res.end(plano ? JSON.stringify({ valor: { tipo: plano } }) : "null");
      return res.end("null");
    }
    if (url.pathname === "/rest/v1/direciona_config" && req.method === "POST") {
      try { chamadas.gravacoes.push(JSON.parse(body)); } catch (_) {}
      return res.end("{}");
    }
    res.end("{}");
  });
  return { server, chamadas };
}

async function comServidor(opts, orgId, fn) {
  const { server, chamadas } = fakeServer(opts);
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  try {
    process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
    const resultado = await verificarLimiteAnalises(orgId);
    return await fn(resultado, chamadas);
  } finally { await new Promise(r => server.close(r)); }
}

// Conta ativa sem plano registrado → régua do Pro; 25ª do dia ainda passa, 26ª bloqueia.
await comServidor({ diario: 24 }, "org-pro", (r) => {
  assert.equal(r.permitido, true, "24 usadas: a 25ª ainda entra");
  assert.equal(r.plano?.tipo, "pro");
});
await comServidor({ diario: 25 }, "org-pro", (r) => {
  assert.equal(r.permitido, false, "25 usadas: bloqueia a 26ª");
  assert.equal(r.motivo, "dia");
  assert.equal(r.limite, 25);
});
// Teto MENSAL do Pro segura mesmo com o dia folgado.
await comServidor({ diario: 3, mensal: 250 }, "org-pro", (r) => {
  assert.equal(r.permitido, false, "250 no mês bloqueia mesmo com só 3 no dia");
  assert.equal(r.motivo, "mes");
  assert.equal(r.limiteMes, 250);
});
// Pro Master: o dobro (50/dia, 500/mês).
await comServidor({ plano: "pro-master", diario: 49, mensal: 499 }, "org-master", (r) => {
  assert.equal(r.permitido, true, "49/dia e 499/mês: a próxima ainda entra no Pro Master");
  assert.equal(r.plano?.nome, "Pro Master");
});
await comServidor({ plano: "pro-master", diario: 50 }, "org-master", (r) => {
  assert.equal(r.permitido, false); assert.equal(r.motivo, "dia"); assert.equal(r.limite, 50);
});
// Conta em teste: 5/dia, com a marca emTeste (liga o convite).
await comServidor({ status: "teste", diario: 5 }, "org-teste", (r) => {
  assert.equal(r.permitido, false); assert.equal(r.emTeste, true); assert.equal(r.limite, 5);
});
// Conta ORIGINAL: fora dos planos — fusível técnico de 200/dia, mês nunca conta, e nem consulta o status.
await comServidor({ diario: 60, mensal: 5000 }, EMPRESA_PRINCIPAL, (r, chamadas) => {
  assert.equal(r.permitido, true, "60 no dia passa longe do fusível de 200");
  assert.equal(r.plano, null, "conta original não tem plano");
  assert.equal(chamadas.organizations, 0, "conta original nem consulta o status");
});
await comServidor({ diario: 200 }, EMPRESA_PRINCIPAL, (r) => {
  assert.equal(r.permitido, false, "o fusível de 200 continua valendo pra conta original");
});
// A análise que passa grava os DOIS contadores (dia e mês) pra conta com plano.
await comServidor({ diario: 1, mensal: 10 }, "org-pro", (r, chamadas) => {
  assert.equal(r.permitido, true);
  const chaves = chamadas.gravacoes.map(g => g.chave || g?.[0]?.chave).join("|");
  assert.ok(/limite-diario:analises-ia/.test(chaves) && /limite-mensal:analises-ia/.test(chaves),
    "precisa gravar contador do dia E do mês");
});

// ── 3. Cada degrau tem a sua mensagem e o seu botão (montados no servidor) ────────────────────
{
  assert.match(pipeline, /do plano Pro\. O Pro Master tem o dobro/, "Pro esbarrando → convite pro Pro Master");
  assert.match(pipeline, /do plano Pro Master\. Precisa de mais\?/, "Pro Master esbarrando → convite pra plano maior");
  assert.match(pipeline, /motivo: "upgrade-pro-master"/, "upgrade do Pro identificado");
  assert.match(pipeline, /motivo: "plano-personalizado"/, "upgrade do Pro Master identificado");
  assert.match(pipeline, /Tente novamente amanhã\./, "conta original mantém o aviso neutro, sem botão");
  // O app usa o rótulo/mensagem que o servidor manda (não fixa mais um texto único).
  assert.match(app, /a\?\.upgrade\?\.botao/, "o botão da tela usa o rótulo vindo do servidor");
  assert.match(app, /a\?\.upgrade\?\.mensagemWhats/, "a mensagem pronta do WhatsApp vem do servidor");
}

// ── 4. Painel administrativo: definir plano é ação de servidor, exclusiva do administrador ────
{
  assert.match(adminContas, /action.*definir-plano|definir-plano.*action/s, "a rota aceita definir-plano");
  assert.match(adminContas, /\["pro", "pro-master"\]\.includes\(tipo\)/, "só aceita os dois planos reais");
  assert.match(adminContas, /A conta original não usa pacotes/, "recusa plano na conta original");
  assert.match(adminContas, /relatorioPlanos/, "o painel consegue ler os planos das contas");
  assert.match(painel, /definirPlano\('\$\{e\.id\}','pro'\)/, "botão Pago · Pro no painel");
  assert.match(painel, /definirPlano\('\$\{e\.id\}','pro-master'\)/, "botão Pago · Pro Master no painel");
  assert.ok(!/onclick="marcarPago\(/.test(painel), "o botão antigo de marcar pago sem plano saiu");
}

console.log("v1110-planos-pro-e-pro-master: ok");
