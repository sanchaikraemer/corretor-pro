// v1242 — as três suspeitas que a v1241 deixou sem prova. "Fica pra próxima rodada." / "faça
// agora!" (dono, 13/08/2026). Conferidas uma a uma: as três eram REAIS, e piores do que a
// descrição sugeria.
//
//   1. Observação com mais de uma linha continuava viva na memória do lead depois de apagada —
//      e a memória APARECE na tela (busca e detalhe do cliente).
//   2. "recomendacaoContato" ficava fora da carteira: o aviso de AGUARDAR ("ainda não é hora de
//      mandar mensagem") sumia da tela até o detalhe completo chegar do servidor.
//   3. Um pedido de detalhe JÁ EM VOO regravava o cache com dado velho depois da invalidação —
//      a observação recém-apagada voltava e ficava pelo tempo de vida do cache.
import http from "node:http";
import fs from "node:fs";
import assert from "node:assert/strict";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const persistencia = fs.readFileSync(new URL("../api/_persistence.js", import.meta.url), "utf8");

const HOJE = new Date();
const isoHoje = (h, m) => { const d = new Date(HOJE); d.setUTCHours(h, m, 0, 0); return d.toISOString(); };

// ══ 1. OBSERVAÇÃO COM VÁRIAS LINHAS SAI DA MEMÓRIA ═════════════════════════════════════════
// Ditado quebra linha o tempo todo — é o jeito que o dono mais usa pra registrar observação.
// O corte antigo comparava LINHA A LINHA com o bloco inteiro "[data hora] texto": só casava
// quando o texto cabia numa linha só. Com duas linhas, nunca casava e o texto ficava.
let linha = null;
let ultimoPatch = null;

const server = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/rest/v1/whatsapp_processamentos") {
    if (req.method === "GET") { res.statusCode = 200; res.end(JSON.stringify(linha)); return; }
    if (req.method === "PATCH") { ultimoPatch = JSON.parse(body || "{}"); res.statusCode = 204; res.end(); return; }
  }
  res.statusCode = 500;
  res.end(JSON.stringify({ error: `rota simulada não atendida: ${req.method} ${url.pathname}` }));
});

await new Promise(r => server.listen(0, "127.0.0.1", r));
try {
  const port = server.address().port;
  process.env.NODE_ENV = "test";
  process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
  const { default: handler } = await import(`../api/reanalisar-lead.js?v1242=${Date.now()}`);

  async function chamar(body) {
    let statusCode = 0, response = "";
    const res = { status(n) { statusCode = n; return this; }, setHeader() { return this; }, end(v = "") { response += v; return this; } };
    await handler({ method: "POST", headers: {}, body }, res);
    return { statusCode, payload: response ? JSON.parse(response) : null };
  }

  // Observação DITADA, com quebra de linha no meio — o caso real.
  const TEXTO_MULTILINHA = "o cliente não autorizou a mandar a simulação\nveja o prazo que faz que a gente conversou\npara elaborar uma retomada";
  const obsMulti = {
    id: "obs-multi", iso: isoHoje(18, 31), date: "13/08/2026", time: "18:31",
    author: "Observação do corretor", text: TEXTO_MULTILINHA,
    type: "observacao_manual", source: "corretor-pro-manual", manual: true
  };
  const obsOutra = {
    id: "obs-outra", iso: isoHoje(9, 0), date: "13/08/2026", time: "09:00",
    author: "Observação do corretor", text: "essa aqui fica",
    type: "observacao_manual", source: "corretor-pro-manual", manual: true
  };

  linha = {
    timeline_json: [obsOutra, obsMulti],
    resultado_analise: {
      memoria: {
        observacoes: `[13/08/2026 09:00] essa aqui fica\n[13/08/2026 18:31] ${TEXTO_MULTILINHA}`,
        observacoesManuais: [
          { id: "obs-outra", texto: "essa aqui fica", criadoEm: isoHoje(9, 0) },
          { id: "obs-multi", texto: TEXTO_MULTILINHA, criadoEm: isoHoje(18, 31) }
        ]
      },
      aprendizado: { eventos: [] }
    },
    nome_arquivo: "Conversa.zip", etapa: "Novo"
  };
  ultimoPatch = null;

  const { statusCode, payload } = await chamar({ action: "apagar-observacao", id: "lead-1", iso: obsMulti.iso });
  assert.equal(statusCode, 200);
  assert.equal(payload?.ok, true);

  const memoria = ultimoPatch?.resultado_analise?.memoria || {};
  assert.ok(!String(memoria.observacoes || "").includes("não autorizou a mandar a simulação"),
    "observação DITADA (com quebra de linha) precisa sair do texto corrido da memória — antes ficava");
  assert.ok(!String(memoria.observacoes || "").includes("para elaborar uma retomada"),
    "nenhum pedaço dela pode sobrar");
  assert.ok(String(memoria.observacoes || "").includes("essa aqui fica"),
    "a outra observação não pode ser apagada junto");
  assert.ok(!(memoria.observacoesManuais || []).some(o => o.id === "obs-multi"), "sai da lista também");
  assert.ok(!(ultimoPatch?.timeline_json || []).some(m => m.iso === obsMulti.iso), "e do histórico");
} finally {
  await new Promise(r => server.close(r));
}

// ══ 2. O AVISO DE "AGUARDAR" VIAJA JUNTO DA CARTEIRA ═══════════════════════════════════════
// A tela usa a.recomendacaoContato.aguardar pra mostrar "ainda não é hora de mandar mensagem",
// com o motivo. Fora da lista compacta, esse aviso sumia até o detalhe completo carregar — logo,
// o corretor podia mandar mensagem justamente em quem pediu espaço.
assert.match(persistencia, /"recomendacaoContato"/,
  "recomendacaoContato precisa estar na análise compacta da carteira");
{
  const ini = persistencia.indexOf("function compactAnalysisForList");
  const bloco = persistencia.slice(ini, persistencia.indexOf("return out;", ini));
  assert.ok(bloco.includes('"recomendacaoContato"'), "e dentro da lista de campos que a carteira leva");
}
assert.match(app, /a\?\.recomendacaoContato\?\.aguardar===true/,
  "sanidade: a tela realmente depende desse campo pra decidir o aviso");

// ══ 3. PEDIDO EM VOO NÃO RESSUSCITA O QUE FOI APAGADO ══════════════════════════════════════
// invalidarLeadDetail() limpava o cache, mas o pedido que já tinha saído continuava correndo com
// dado velho e, ao terminar, gravava esse dado de volta. A observação apagada voltava.
{
  const ini = app.indexOf("export async function getLeadDetail(id, force){");
  const fim = app.indexOf("export function invalidarLeadDetail", ini);
  assert.ok(ini > -1 && fim > ini, "getLeadDetail não encontrada");
  const src = app.slice(ini, fim);

  assert.match(src, /const geracaoNoInicio = _geracaoLeadDetail\(key\);/,
    "o pedido precisa anotar a geração do lead ANTES de sair");
  assert.match(src, /if \(_geracaoLeadDetail\(key\) !== geracaoNoInicio\)/,
    "e conferir, ao voltar, se alguém invalidou no meio do caminho");
  assert.ok(src.indexOf("_geracaoLeadDetail(key) !== geracaoNoInicio") < src.indexOf("_leadDetailCache.set(key, { ts:Date.now()"),
    "a conferência vem ANTES de gravar no cache — senão o dado velho já entrou");

  const invIni = app.indexOf("export function invalidarLeadDetail");
  const inv = app.slice(invIni, app.indexOf("}", app.indexOf("_leadDetailGeracao.set(key", invIni)));
  assert.match(inv, /_leadDetailGeracao\.set\(key, _geracaoLeadDetail\(key\) \+ 1\)/,
    "invalidar um lead precisa avançar a geração dele");
  assert.match(app, /for\(const k of _leadDetailGeracao\.keys\(\)\) _leadDetailGeracao\.set\(k, _geracaoLeadDetail\(k\) \+ 1\)/,
    "invalidar TUDO precisa avançar a geração de todos os que estavam em voo");
}

console.log("v1242-tres-suspeitas-confirmadas: ok (as três eram reais)");
