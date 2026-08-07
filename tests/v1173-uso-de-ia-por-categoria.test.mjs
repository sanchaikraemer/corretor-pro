import http from "node:http";
import fs from "node:fs";
import assert from "node:assert/strict";
import handler from "../api/admin-contas.js";

// v1173 — o dono viu o custo por conta (v1172) e desconfiou: "cada análise custava centavos,
// como agora passa de 1 real cada?" e "se não há histórico não há aprendizado pra gastar". As
// duas coisas eram verdade ao mesmo tempo: uma "análise" pedida de propósito continua custando
// centavos — só que "chamadas"/"custo" da conta somavam ISSO junto com o aprendizado automático
// que roda sozinho lendo o histórico da carteira (ver v1172 → v1173, tests/observacao/NOTAS).
// Sem separar, dividir custo-total-da-conta por "quantas análises eu lembro de ter pedido" dá um
// número bem maior que o custo real de uma análise — e não dá pra saber se uma conta com custo
// alto é aprendizado ou análise de verdade. Este arquivo prova que a rota separa por categoria.

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

// Mesmo padrão já provado em tests/v1038-telemetria-uso-ia.test.mjs: platform_admins responde um
// OBJETO só (não array — requirePlatformAdmin usa .maybeSingle()), organizations/ai_usage_events
// respondem o array direto.
function montarServidorFake({ eventos, organizacoes }) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/auth/v1/user") return res.end(JSON.stringify({ id: ADMIN_USER_ID }));
    if (url.pathname === "/rest/v1/platform_admins") return res.end(JSON.stringify({ user_id: ADMIN_USER_ID }));
    if (url.pathname === "/rest/v1/organizations") return res.end(JSON.stringify(organizacoes));
    if (url.pathname === "/rest/v1/ai_usage_events") return res.end(JSON.stringify(eventos));
    res.statusCode = 404;
    res.end("{}");
  });
  return server;
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

const ORG_ZULEICA = "org-zuleica";
const agora = new Date().toISOString();

// ── 1. análise pedida de propósito x aprendizado automático viram categorias separadas ─────────
await comServidor({
  organizacoes: [{ id: ORG_ZULEICA, nome: "Zuleica" }],
  eventos: [
    // 1 análise pedida de propósito
    { organization_id: ORG_ZULEICA, kind: "chat", model: "gpt-4.1", rota: "analise", prompt_tokens: 2000, completion_tokens: 500, audio_seconds: 0, criado_em: agora },
    // 60 chamadas de aprendizado automático (carteira inteira sendo lida sozinha, 1 por conversa)
    ...Array.from({ length: 60 }, () => ({ organization_id: ORG_ZULEICA, kind: "chat", model: "gpt-4.1-mini", rota: "inteligencia-observada", prompt_tokens: 1500, completion_tokens: 300, audio_seconds: 0, criado_em: agora })),
    // 1 transcrição de áudio (ensinando o Cérebro por voz)
    { organization_id: ORG_ZULEICA, kind: "whisper", model: "whisper-1", rota: "ensinar-cerebro-por-voz", prompt_tokens: 0, completion_tokens: 0, audio_seconds: 40, criado_em: agora }
  ]
}, async () => {
  const res = fakeRes();
  await handler({ method: "GET", headers: { authorization: "Bearer x" }, query: { relatorio: "uso-ia", dias: "30" } }, res);
  assert.equal(res.statusCode, 200);
  const zuleica = res.payload.empresas.find(e => e.organizationId === ORG_ZULEICA);
  assert.ok(zuleica, "Zuleica precisa aparecer no relatório");

  assert.equal(zuleica.hoje.chamadas, 62, "total de chamadas de hoje precisa somar as 62 (1 análise + 60 aprendizado + 1 transcrição)");
  assert.equal(zuleica.categoriasHoje.analise.chamadas, 1, "só 1 chamada é análise pedida de propósito");
  assert.equal(zuleica.categoriasHoje.aprendizado.chamadas, 60, "as 60 chamadas de leitura do histórico precisam cair em 'aprendizado', não em 'análise'");
  assert.equal(zuleica.categoriasHoje.transcricao.chamadas, 1, "a transcrição de áudio tem categoria própria");
  assert.equal(zuleica.categoriasHoje.outros.chamadas, 0, "nada sobra pra 'outros' neste caso");

  // o custo da análise real (1 chamada) precisa ser BEM menor que o custo do aprendizado (60
  // chamadas, mesmo em modelo mais barato) — prova em número que "análise custa centavos"
  // continua verdade isoladamente; o que infla o total é o VOLUME do aprendizado automático.
  assert.ok(zuleica.categoriasHoje.analise.custoEstimadoBRL < zuleica.categoriasHoje.aprendizado.custoEstimadoBRL,
    "o custo de 1 análise isolada precisa ser menor que o custo das 60 chamadas de aprendizado — prova que o 'caro' vinha do volume do aprendizado, não da análise em si");

  // categoriasPeriodo (30d) segue a mesma régua da categoriasHoje (mesmo dia == mesmo período aqui)
  assert.equal(zuleica.categoriasPeriodo.aprendizado.chamadas, 60);
});

// ── 2. Conta sem NENHUM evento não aparece com custo nenhum (prova o "se não há histórico não há
//    aprendizado pra gastar" — uma conta vazia simplesmente não entra na lista de "empresas") ───
await comServidor({
  organizacoes: [{ id: "org-vazia", nome: "Conta vazia" }],
  eventos: []
}, async () => {
  const res = fakeRes();
  await handler({ method: "GET", headers: { authorization: "Bearer x" }, query: { relatorio: "uso-ia", dias: "30" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.empresas.find(e => e.organizationId === "org-vazia"), undefined,
    "conta sem nenhum evento de IA não pode aparecer com custo — não existe aprendizado a partir do nada");
});

console.log("v1173-uso-de-ia-por-categoria (servidor): ok");

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Front-end — a tabela detalhada mostra as categorias separadas (não só o total)
// ══════════════════════════════════════════════════════════════════════════════════════════════
const admin = fs.readFileSync(new URL("../admin-plataforma.html", import.meta.url), "utf8");

assert.match(admin, /<th>Análise hoje<\/th><th>Aprendizado auto hoje<\/th>/,
  "a tabela 'Uso de IA por empresa' precisa separar análise de aprendizado automático nas colunas de hoje");
assert.match(admin, /celulaCategoria\('analise'\)/);
assert.match(admin, /celulaCategoria\('aprendizado'\)/);

console.log("v1173-uso-de-ia-por-categoria (front-end): ok");
