import http from "node:http";
import fs from "node:fs";
import assert from "node:assert/strict";
import { verificarLimiteAnalises, planoComercial, PLANO_CONTRATADO_KEY } from "../api/_pipeline.js";

// v1133 — usava a data em UTC como "hoje", mas o código conta o limite pelo dia civil de
// São Paulo. Depois das 21h em Brasília já é o dia seguinte em UTC, e o teste falhava sozinho
// toda noite (ver a explicação completa em tests/v1013-limite-diario-uso-ia.test.mjs).
const _hojeSP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

// v1110 — planos comerciais (decisão do dono, estratégia de chamariz tipo "pipoca de cinema");
// v1111 — recalibrado pela régua do uso real do dono: Pro 15/dia + 150/mês, Pro Master 30/dia +
// 300/mês.
//
// v1284 — RECALIBRADO DE NOVO, agora com o custo REAL medido no painel da OpenAI (17/08/2026):
// uma análise custa de R$ 0,20 a R$ 0,40, então 150 análises custavam até R$ 60 num plano de
// R$ 49,90 — margem NEGATIVA. O preço ficou igual e o volume desceu: Pro 50/mês, Pro Master
// 120/mês. E o teto DIÁRIO deixou de ser régua comercial ("independente de limite diário", dono):
// virou fusível técnico de 40/dia, alto de propósito, só pra um erro em laço não queimar o mês
// numa hora. A trava econômica desses números vive em v1284-planos-novos-margem-e-bonus.test.mjs;
// aqui continua a mecânica (dia, mês, teste, conta original, painel).
// A conta original fica FORA dos planos (só o fusível técnico dela).

const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
const adminContas = fs.readFileSync(new URL("../api/admin-contas.js", import.meta.url), "utf8");
const painel = fs.readFileSync(new URL("../admin-plataforma.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

const EMPRESA_PRINCIPAL = "00000000-0000-0000-0000-000000000001";
const hoje = _hojeSP;
const mesSP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);

// ── 1. Os números dos planos (com env mandando) ───────────────────────────────────────────────
{
  for (const nome of ["CORRETOR_PRO_LIMITE_DIA_PRO", "CORRETOR_PRO_LIMITE_MES_PRO", "CORRETOR_PRO_LIMITE_DIA_PROMASTER", "CORRETOR_PRO_LIMITE_MES_PROMASTER"]) delete process.env[nome];
  assert.deepEqual({ ...planoComercial("pro") }, { tipo: "pro", nome: "Pro", dia: 40, mes: 50 }, "Pro: 50/mês, fusível de 40/dia (v1284)");
  assert.deepEqual({ ...planoComercial("pro-master") }, { tipo: "pro-master", nome: "Pro Master", dia: 40, mes: 120 }, "Pro Master: 120/mês, mesmo fusível de 40/dia (v1284)");
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

// Conta ativa sem plano registrado → régua do Pro. O fusível técnico (40/dia) não pode encostar
// em quem está usando o produto normalmente: 39 no dia ainda entra.
await comServidor({ diario: 39 }, "org-pro", (r) => {
  assert.equal(r.permitido, true, "39 usadas no dia: a 40ª ainda entra (o fusível é alto de propósito)");
  assert.equal(r.plano?.tipo, "pro");
});
await comServidor({ diario: 40 }, "org-pro", (r) => {
  assert.equal(r.permitido, false, "40 usadas no mesmo dia: o fusível técnico segura");
  assert.equal(r.motivo, "dia");
  assert.equal(r.limite, 40);
});
// Teto MENSAL do Pro segura mesmo com o dia folgado — é ele que protege o dinheiro.
await comServidor({ diario: 3, mensal: 50 }, "org-pro", (r) => {
  assert.equal(r.permitido, false, "50 no mês bloqueia mesmo com só 3 no dia");
  assert.equal(r.motivo, "mes");
  assert.equal(r.limiteMes, 50);
});
// Pro Master: mesmo fusível diário, mais do que o dobro no mês.
await comServidor({ plano: "pro-master", diario: 29, mensal: 119 }, "org-master", (r) => {
  assert.equal(r.permitido, true, "29/dia e 119/mês: a próxima ainda entra no Pro Master");
  assert.equal(r.plano?.nome, "Pro Master");
});
await comServidor({ plano: "pro-master", mensal: 120 }, "org-master", (r) => {
  assert.equal(r.permitido, false); assert.equal(r.motivo, "mes"); assert.equal(r.limiteMes, 120);
});
// Conta em teste: 5/dia, com a marca emTeste (liga o convite).
await comServidor({ status: "teste", diario: 5 }, "org-teste", (r) => {
  assert.equal(r.permitido, false); assert.equal(r.emTeste, true); assert.equal(r.limite, 5);
});
// Conta ORIGINAL: fora dos planos — fusível técnico de 150/dia (v1112 tinha baixado pra 50; a
// v1174 subiu pra 150 a pedido do dono), mês nunca conta, e nem consulta o status.
await comServidor({ diario: 149, mensal: 5000 }, EMPRESA_PRINCIPAL, (r, chamadas) => {
  assert.equal(r.permitido, true, "149 no dia ainda passa no fusível de 150 (e o mês não conta)");
  assert.equal(r.plano, null, "conta original não tem plano");
  assert.equal(chamadas.organizations, 0, "conta original nem consulta o status");
});
await comServidor({ diario: 150 }, EMPRESA_PRINCIPAL, (r) => {
  assert.equal(r.permitido, false, "o fusível de 150 vale pra conta original");
});
// v1284 — a conta com plano NÃO pode ser barrada pelo dia enquanto o pacote do mês tem saldo:
// 39 no dia com 10 no mês segue liberado (era 15/dia antes, e isso atrapalhava quem senta num
// sábado pra pôr a carteira em dia).
await comServidor({ diario: 39, mensal: 10 }, "org-pro", (r) => {
  assert.equal(r.permitido, true, "39 no dia e 10 no mês: o pacote do mês é que manda");
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
  // v1284 — estourar o MÊS deixou de ser parede: as duas saídas (pacote extra agora, ou subir de
  // plano) aparecem na mesma mensagem. Bloquear no dia 20 quem está usando muito é perder o
  // melhor cliente.
  assert.match(pipeline, /análises deste mês do plano Pro\. Para continuar hoje/, "Pro estourando o mês → pacote extra + Pro Master");
  assert.match(pipeline, /análises deste mês do plano Pro Master\. Para continuar hoje/, "Pro Master estourando o mês → pacote extra");
  assert.match(pipeline, /motivo: "pacote-ou-upgrade"/, "saída do Pro identificada");
  assert.match(pipeline, /motivo: "pacote-ou-personalizado"/, "saída do Pro Master identificada");
  // E o fusível técnico não pode se passar por régua comercial: quem esbarra nele não recebe
  // oferta de upgrade, recebe aviso de segurança.
  assert.match(pipeline, /motivo: "fusivel-tecnico"/, "o fusível diário tem aviso próprio");
  assert.match(pipeline, /por segurança, o sistema pausou por hoje/, "o aviso do fusível fala de segurança, não de plano pequeno");
  assert.ok(!/análises por dia do plano Pro/.test(pipeline), "não pode mais existir mensagem dizendo que o PLANO tem teto diário");
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
