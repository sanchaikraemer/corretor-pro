import http from "node:http";
import fs from "node:fs";
import assert from "node:assert/strict";
import handler from "../api/admin-contas.js";
import { estimarCustoUsd, chavePrecoDoModelo, modeloTemPrecoConhecido } from "../api/_iaCusto.js";

// v1288 — O PAINEL MOSTRAVA CUSTO DE IA INFLADO, e ninguém tinha como perceber.
//
// Origem: 17/08/2026, o dono olhou "R$ 314,32 nos últimos 30 dias" no painel administrativo e
// perguntou "esses valores estão certos, coerentes? tem certeza?". As SOMAS estavam certas (as três
// empresas fechavam exatamente o total), mas o preço unitário não.
//
// A telemetria grava de propósito o modelo que a OpenAI DE FATO usou (completion.model — ver o
// teste v1038 "precisa gravar o modelo que a OpenAI de fato usou, não só o configurado"), e a
// OpenAI devolve o nome COM a data da versão: pede-se "gpt-4o-mini" e volta
// "gpt-4o-mini-2024-07-18". A tabela de preços (api/_iaCusto.js) só tem os nomes curtos e a busca
// era por chave EXATA — então praticamente toda chamada real caía no preço de reserva "_padrao"
// ($5/$15 por 1M de tokens), que existe pra ser um exagero deliberado. Resultado: gpt-4.1 cobrado
// ~2,3x mais caro do que é e gpt-4o-mini (o aprendizado automático, que roda em volume) até ~30x.
//
// Duas garantias aqui: (1) nome com data usa o preço do modelo certo; (2) se AINDA sobrar algum
// modelo sem preço mapeado, o relatório o denuncia por nome (modelosSemPreco) e a tela avisa que o
// valor é teto — nunca mais um total inflado passando por estimativa real.

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1. Preço por modelo — o nome com data da versão precisa achar o preço certo
// ══════════════════════════════════════════════════════════════════════════════════════════════
const UM_MILHAO = 1_000_000;
const custo = (model) => estimarCustoUsd({ kind: "chat", model, promptTokens: UM_MILHAO, completionTokens: 0 });

assert.equal(chavePrecoDoModelo("gpt-4.1-2025-04-14"), "gpt-4.1",
  "o nome que a OpenAI devolve (com data da versão) precisa cair no preço de gpt-4.1");
assert.equal(chavePrecoDoModelo("gpt-4o-mini-2024-07-18"), "gpt-4o-mini");
assert.equal(chavePrecoDoModelo("gpt-4.1-mini-2025-04-14"), "gpt-4.1-mini");
assert.equal(chavePrecoDoModelo("gpt-4.1"), "gpt-4.1", "o nome curto continua funcionando como sempre");

assert.equal(custo("gpt-4.1-2025-04-14"), custo("gpt-4.1"),
  "o mesmo modelo não pode custar diferente só porque veio com a data da versão no nome");
assert.equal(custo("gpt-4o-mini-2024-07-18"), custo("gpt-4o-mini"));
assert.ok(custo("gpt-4o-mini-2024-07-18") < custo("gpt-4.1-2025-04-14"),
  "gpt-4o-mini é bem mais barato que gpt-4.1 — a diferença precisa aparecer na estimativa");

// A regressão em número: era isto que inflava o painel.
const RESERVA = custo("modelo-que-nao-existe");
assert.ok(RESERVA > custo("gpt-4.1-2025-04-14") * 2,
  "o preço de reserva é MUITO mais alto que o de gpt-4.1 — por isso cair nele por engano inflava o total");
assert.ok(RESERVA > custo("gpt-4o-mini-2024-07-18") * 20,
  "e é dezenas de vezes o de gpt-4o-mini — o aprendizado automático era o mais distorcido de todos");

// Nada de adivinhar além da data: um palpite errado poderia SUBESTIMAR o custo, que é o único erro
// que engana de verdade quem está definindo mensalidade. Modelo desconhecido segue na reserva alta.
assert.equal(chavePrecoDoModelo("gpt-9-turbo"), null,
  "modelo futuro desconhecido NÃO pode ser chutado como parente de outro — fica na reserva e é denunciado");
assert.equal(modeloTemPrecoConhecido({ kind: "chat", model: "gpt-9-turbo" }), false);
assert.equal(modeloTemPrecoConhecido({ kind: "chat", model: "gpt-4.1-2025-04-14" }), true);
assert.equal(modeloTemPrecoConhecido({ kind: "whisper", model: "whisper-1" }), true,
  "transcrição é cobrada por minuto de áudio, não por modelo — nunca entra na lista de 'sem preço'");

console.log("v1288 (preço do modelo com data da versão): ok");

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2. Relatório — denuncia por nome todo modelo cobrado pelo preço de reserva
// ══════════════════════════════════════════════════════════════════════════════════════════════
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

// Mesmo padrão de tests/v1173-uso-de-ia-por-categoria.test.mjs.
async function comServidor({ eventos, organizacoes, aoLerEventos }, fn) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/auth/v1/user") return res.end(JSON.stringify({ id: ADMIN_USER_ID }));
    if (url.pathname === "/rest/v1/platform_admins") return res.end(JSON.stringify({ user_id: ADMIN_USER_ID }));
    if (url.pathname === "/rest/v1/organizations") return res.end(JSON.stringify(organizacoes));
    if (url.pathname === "/rest/v1/ai_usage_events") {
      if (aoLerEventos) return res.end(JSON.stringify(aoLerEventos(url)));
      return res.end(JSON.stringify(eventos));
    }
    res.statusCode = 404;
    res.end("{}");
  });
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

const ORG = "org-teste-preco";
const agora = new Date().toISOString();
const pedirRelatorio = async () => {
  const res = fakeRes();
  await handler({ method: "GET", headers: { authorization: "Bearer x" }, query: { relatorio: "uso-ia", dias: "30" } }, res);
  assert.equal(res.statusCode, 200);
  return res.payload;
};

// 2a. Só modelos conhecidos (inclusive com data) → nenhum aviso, e o custo é o preço real.
await comServidor({
  organizacoes: [{ id: ORG, nome: "Empresa 1" }],
  eventos: [
    { organization_id: ORG, kind: "chat", model: "gpt-4.1-2025-04-14", rota: "analise", prompt_tokens: UM_MILHAO, completion_tokens: 0, audio_seconds: 0, criado_em: agora },
    { organization_id: ORG, kind: "whisper", model: "whisper-1", rota: "transcricao-import", prompt_tokens: 0, completion_tokens: 0, audio_seconds: 60, criado_em: agora }
  ]
}, async () => {
  const r = await pedirRelatorio();
  assert.deepEqual(r.modelosSemPreco, [],
    "modelo com data da versão é conhecido — não pode entrar na lista de 'sem preço mapeado'");
  const empresa = r.empresas.find(e => e.organizationId === ORG);
  // 1M de tokens de entrada em gpt-4.1 = US$ 2,00; + 1 min de áudio = US$ 0,006. Na cotação
  // padrão de R$ 5,50: (2 + 0,006) × 5,50 = R$ 11,03.
  assert.equal(empresa.periodo.custoEstimadoBRL, 11.03,
    "o custo tem que sair pelo preço REAL de gpt-4.1 (US$ 2/1M), não pelo preço de reserva");
  assert.equal(r.cotacaoUsdBrl, 5.5, "o relatório precisa dizer em que dólar converteu — a tela mostra isso");
});

// 2b. Modelo fora da tabela → continua na reserva alta, mas agora aparece NOMEADO no relatório.
await comServidor({
  organizacoes: [{ id: ORG, nome: "Empresa 1" }],
  eventos: [
    { organization_id: ORG, kind: "chat", model: "gpt-9-turbo", rota: "analise", prompt_tokens: 1000, completion_tokens: 100, audio_seconds: 0, criado_em: agora },
    { organization_id: ORG, kind: "chat", model: "gpt-9-turbo", rota: "analise", prompt_tokens: 1000, completion_tokens: 100, audio_seconds: 0, criado_em: agora },
    { organization_id: ORG, kind: "chat", model: "gpt-4.1-2025-04-14", rota: "analise", prompt_tokens: 1000, completion_tokens: 100, audio_seconds: 0, criado_em: agora }
  ]
}, async () => {
  const r = await pedirRelatorio();
  assert.deepEqual(r.modelosSemPreco, [{ model: "gpt-9-turbo", chamadas: 2 }],
    "modelo sem preço mapeado precisa aparecer por NOME e com a contagem — é o que permite corrigir a tabela em vez de adivinhar");
});

console.log("v1288 (relatório denuncia modelo sem preço): ok");

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. Leitura paginada — janela congelada, pra não contar chamada em dobro
// ══════════════════════════════════════════════════════════════════════════════════════════════
// A ordem é por data decrescente: sem teto de data, uma análise gravada NO MEIO da leitura entrava
// no topo e empurrava tudo uma casa pra baixo — a linha 1000 virava a 1001 e era lida de novo como
// primeira da página 2. Com 1501 eventos em produção, isso já era duas páginas de verdade.
await comServidor({
  organizacoes: [{ id: ORG, nome: "Empresa 1" }],
  aoLerEventos(url) {
    const filtros = url.searchParams.getAll("criado_em");
    assert.ok(filtros.some(f => f.startsWith("gte.")), "a leitura precisa ter piso de data (últimos N dias)");
    assert.ok(filtros.some(f => f.startsWith("lte.")),
      "a leitura precisa ter TETO de data — sem isso, evento novo gravado durante a leitura desloca as páginas e vira chamada contada em dobro");
    assert.match(String(url.searchParams.get("order") || ""), /criado_em[^,]*,id/,
      "a ordenação precisa de desempate por id — duas linhas com a mesma data não podem sair em ordem imprevisível entre páginas");
    return [];
  }
}, async () => {
  const r = await pedirRelatorio();
  assert.equal(r.totalGeral.periodo.chamadas, 0);
});

console.log("v1288 (leitura paginada com janela congelada): ok");

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 4. Tela — o aviso de "custo estimado por cima" e o dólar usado precisam aparecer
// ══════════════════════════════════════════════════════════════════════════════════════════════
const admin = fs.readFileSync(new URL("../admin-plataforma.html", import.meta.url), "utf8");

assert.match(admin, /id="usoIaAvisoPreco"/,
  "o painel precisa ter onde mostrar o aviso de que o custo está estimado por cima");
assert.match(admin, /function mostrarAvisoPrecoIA/);
assert.match(admin, /mostrarAvisoPrecoIA\(r\.modelosSemPreco/,
  "o aviso tem que ser alimentado pela lista de modelos sem preço que vem do servidor");
assert.match(admin, /estimado por cima/,
  "o aviso precisa dizer em português claro que o valor é teto, não gasto provável");
assert.match(admin, /por dólar/,
  "a legenda precisa dizer em que cotação de dólar a conta foi feita — o número em reais depende disso");

const css = fs.readFileSync(new URL("../contas-estilo.css", import.meta.url), "utf8");
assert.match(css, /\.aviso-preco-ia\{/, "o aviso precisa de estilo próprio, senão passa batido na tela");

console.log("v1288-preco-do-modelo-com-data (front-end): ok");
