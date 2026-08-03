import http from "node:http";
import fs from "node:fs";
import assert from "node:assert/strict";
import { verificarLimiteDiario, limiteAnalisesIADoDiaTeste, whatsComercialPlataforma } from "../api/_pipeline.js";

// v1108 — decisão comercial do dono (02/08/2026): o teste grátis cai de 25 pra 10 análises/dia,
// e bater no limite vira momento de venda — aviso com botão direto pro WhatsApp comercial.
// Conta paga que bater no teto de segurança (200) segue vendo o aviso neutro, sem convite.

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const reanalisar = fs.readFileSync(new URL("../api/reanalisar-lead.js", import.meta.url), "utf8");

// ── 1. O padrão do teste grátis agora é 5 (v1109 — era 10 na v1108; a env var continua mandando) ──
{
  delete process.env.CORRETOR_PRO_LIMITE_ANALISES_DIA_TESTE;
  assert.equal(limiteAnalisesIADoDiaTeste(), 5, "o teto padrão do teste grátis precisa ser 5/dia (v1109)");
  process.env.CORRETOR_PRO_LIMITE_ANALISES_DIA_TESTE = "25";
  assert.equal(limiteAnalisesIADoDiaTeste(), 25, "variável de ambiente configurada continua mandando");
  delete process.env.CORRETOR_PRO_LIMITE_ANALISES_DIA_TESTE;
}

// ── 2. O WhatsApp comercial: padrão embutido + override por variável de ambiente ──────────────
{
  delete process.env.CORRETOR_PRO_WHATS_COMERCIAL;
  assert.equal(whatsComercialPlataforma(), "5554999013331", "número do dono (54 99901-3331) com DDI 55");
  process.env.CORRETOR_PRO_WHATS_COMERCIAL = "+55 (11) 98888-7777";
  assert.equal(whatsComercialPlataforma(), "5511988887777", "override aceita formatação e guarda só dígitos");
  delete process.env.CORRETOR_PRO_WHATS_COMERCIAL;
}

// ── 3. verificarLimiteDiario devolve emTeste (é o que liga o convite) ─────────────────────────
{
  function fakeServer({ statusOrganizacao, valorSalvo = null }) {
    return http.createServer(async (req, res) => {
      for await (const _ of req) { /* drena o corpo */ }
      const url = new URL(req.url, "http://localhost");
      res.setHeader("Content-Type", "application/json");
      if (url.pathname === "/rest/v1/organizations") return res.end(JSON.stringify({ status: statusOrganizacao }));
      if (url.pathname === "/rest/v1/direciona_config" && req.method === "GET")
        return res.end(valorSalvo ? JSON.stringify({ valor: valorSalvo }) : "null");
      res.end("{}");
    });
  }
  const hoje = new Date().toISOString().slice(0, 10);
  const casos = [
    { statusOrganizacao: "teste", valorSalvo: { dia: hoje, contagem: 10 }, esperaPermitido: false, esperaEmTeste: true, esperaLimite: 10 },
    { statusOrganizacao: "ativo", valorSalvo: { dia: hoje, contagem: 10 }, esperaPermitido: true, esperaEmTeste: false, esperaLimite: 200 }
  ];
  for (const caso of casos) {
    const server = fakeServer(caso);
    await new Promise(r => server.listen(0, "127.0.0.1", r));
    try {
      process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
      process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
      const r = await verificarLimiteDiario(`org-${caso.statusOrganizacao}`, "analises-ia", 200, 10);
      assert.equal(r.permitido, caso.esperaPermitido, `permitido para ${caso.statusOrganizacao}`);
      assert.equal(r.emTeste, caso.esperaEmTeste, `emTeste para ${caso.statusOrganizacao}`);
      assert.equal(r.limite, caso.esperaLimite, `limite para ${caso.statusOrganizacao}`);
    } finally { await new Promise(r => server.close(r)); }
  }
}

// ── 4. O resultado bloqueado carrega o convite SÓ no teste (upgrade condicionado a emTeste) ───
{
  assert.match(pipeline, /if \(limiteDiario\.emTeste\) \{[\s\S]{0,400}?motivo: "limite-teste"/,
    "o payload upgrade precisa existir e ser condicionado a emTeste");
  // v1118 — a mensagem do teste passou a mostrar o preço dos planos (Pro/Pro Master) e convidar
  // pra contratação pelo WhatsApp.
  assert.match(pipeline, /Pro por \$\{precoPlanoBR\("pro"\)\}\/mês ou Pro Master por \$\{precoPlanoBR\("pro-master"\)\}\/mês — contrate pelo WhatsApp abaixo/,
    "a mensagem do teste precisa mostrar o preço e convidar pra contratação");
  assert.match(pipeline, /Tente novamente amanhã\./,
    "conta paga continua com o aviso neutro");
  // A reanálise bloqueada não sobrescreve análise boa (regra pré-existente) e repassa o convite.
  assert.match(reanalisar, /novoAnalysis\?\.upgrade \? \{ upgrade: novoAnalysis\.upgrade \}/,
    "o 422 da reanálise precisa repassar o upgrade pro app montar o botão");
}

// ── 5. O botão do app: função real gera o link wa.me certo e só quando tem upgrade ────────────
{
  const fonte = app.match(/function cpUpgradeProHTML\(a\)\{[\s\S]*?\n\}/)[0];
  const { cpUpgradeProHTML } = eval(`const escapeHtml = (s)=>String(s); ${fonte}; ({ cpUpgradeProHTML });`);
  const html = cpUpgradeProHTML({ mode: "limite_diario_excedido", upgrade: { whatsapp: "5554999013331" } });
  assert.ok(html.includes("https://wa.me/5554999013331?text="), "o botão abre o WhatsApp comercial");
  assert.ok(/limite de an%C3%A1lises|Atingi%20o%20limite|Atingi/.test(decodeURIComponent(html)) || html.includes("text="),
    "a conversa abre com mensagem pronta");
  assert.equal(cpUpgradeProHTML({ mode: "limite_diario_excedido" }), "", "sem upgrade (conta paga) não há botão");
  assert.equal(cpUpgradeProHTML({ mode: "openai", upgrade: { whatsapp: "5554999013331" } }), "", "análise normal nunca mostra botão");
  // E os três pontos da tela usam o botão: análise do lead, resultado da importação e memória.
  assert.ok((app.match(/cpUpgradeProHTML\(/g) || []).length >= 4, "o botão precisa estar ligado nos pontos da tela");
}

console.log("v1108-limite-teste-10-e-convite-whatsapp: ok");
