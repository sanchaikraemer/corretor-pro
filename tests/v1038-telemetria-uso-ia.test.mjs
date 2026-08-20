import http from "node:http";
import assert from "node:assert/strict";
import { registrarUsoIA, estimarCustoUsd, cotacaoUsdBrl } from "../api/_iaCusto.js";
import { analyzeWithBrain, transcreverBuffer } from "../api/_pipeline.js";

// v1038 — a auditoria técnica/comercial de 27/07/2026 apontou (item 6.2/12.2): antes de definir
// plano/preço com segurança, é indispensável saber quanto cada corretor está custando de IA de
// verdade — o sistema não registrava nada disso, só um contador de segurança contra abuso (que
// não guarda tokens nem histórico). Este teste prova, contra o código real:
// 1. estimarCustoUsd calcula um valor plausível pra chat e pra whisper, usando a tabela de preço.
// 2. registrarUsoIA grava UM evento real (INSERT) em ai_usage_events com os campos certos.
// 3. analyzeWithBrain (a chamada mais cara do sistema) realmente registra o uso após uma análise
//    bem-sucedida, com os tokens que a OpenAI devolveu.
// 4. transcreverBuffer pede response_format:"verbose_json" (única forma de saber a DURAÇÃO do
//    áudio, que é como o Whisper cobra) e registra o uso em segundos.
// 5. api/admin-uso-ia.js exige login de administrador da plataforma e agrega corretamente por
//    empresa (hoje vs. período), nunca misturando uma empresa com outra.

const envAntes = { NODE_ENV: process.env.NODE_ENV, SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, CORRETOR_PRO_COTACAO_USD_BRL: process.env.CORRETOR_PRO_COTACAO_USD_BRL };
function restaurarEnv() {
  for (const [k, v] of Object.entries(envAntes)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
}
process.env.NODE_ENV = "test";

function fakeRes() {
  let statusCode = 200, payload = "";
  return {
    status(n) { statusCode = n; return this; },
    setHeader() { return this; },
    end(v = "") { payload += v; return this; },
    get statusCode() { return statusCode; },
    get payload() { return payload; }
  };
}

async function comServidor(handler, fn) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-de-teste";
    await fn();
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

try {
  // 1. estimarCustoUsd — chat cobra por token (entrada/saída com preços diferentes), whisper
  // cobra por MINUTO de áudio (não por token).
  {
    delete process.env.CORRETOR_PRO_COTACAO_USD_BRL;
    const custoChat = estimarCustoUsd({ kind: "chat", model: "gpt-4o-mini", promptTokens: 1_000_000, completionTokens: 1_000_000 });
    assert.ok(custoChat > 0, "chat com 1M tokens de cada lado precisa custar mais que zero");
    // gpt-4o-mini: 0.15 entrada + 0.60 saída = 0.75 USD pra 1M+1M tokens.
    assert.ok(Math.abs(custoChat - 0.75) < 0.001, `esperava ~0.75 USD, veio ${custoChat}`);

    const custoWhisper = estimarCustoUsd({ kind: "whisper", audioSeconds: 600 }); // 10 minutos
    assert.ok(Math.abs(custoWhisper - 0.06) < 0.0001, `10 min de whisper a 0.006 USD/min deveria dar 0.06 USD, veio ${custoWhisper}`);

    const custoModeloDesconhecido = estimarCustoUsd({ kind: "chat", model: "modelo-que-nao-existe", promptTokens: 1_000_000, completionTokens: 0 });
    assert.ok(custoModeloDesconhecido > 0, "modelo fora do mapa cai no preço padrão, nunca custo zero");

    assert.equal(cotacaoUsdBrl(), 5.50, "cotação padrão sem env var configurada");
    process.env.CORRETOR_PRO_COTACAO_USD_BRL = "6";
    assert.equal(cotacaoUsdBrl(), 6, "cotação configurável pelo ambiente");
    delete process.env.CORRETOR_PRO_COTACAO_USD_BRL;
    console.log("v1038 (estimarCustoUsd/cotacaoUsdBrl): ok");
  }

  // 2. registrarUsoIA grava um INSERT real em ai_usage_events, com os campos certos.
  await comServidor(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/rest/v1/ai_usage_events" && req.method === "POST") {
      req._capturado = JSON.parse(body || "{}");
      global.__ultimoInsertUsoIA = req._capturado;
      res.statusCode = 201;
      res.end("{}");
      return;
    }
    res.statusCode = 500;
    res.end(JSON.stringify({ error: `rota simulada não atendida: ${req.method} ${url.pathname}` }));
  }, async () => {
    await registrarUsoIA({ organizationId: "org-xyz", kind: "chat", model: "gpt-4.1", rota: "analise", usage: { prompt_tokens: 1200, completion_tokens: 340 } });
    const gravado = global.__ultimoInsertUsoIA;
    assert.ok(gravado, "precisa ter gravado um evento");
    assert.equal(gravado.organization_id, "org-xyz");
    assert.equal(gravado.kind, "chat");
    assert.equal(gravado.model, "gpt-4.1");
    assert.equal(gravado.rota, "analise");
    assert.equal(gravado.prompt_tokens, 1200);
    assert.equal(gravado.completion_tokens, 340);
    assert.equal(gravado.audio_seconds, 0);

    // Sem organizationId, nunca grava (não dá pra atribuir custo a ninguém).
    global.__ultimoInsertUsoIA = null;
    await registrarUsoIA({ organizationId: "", kind: "chat", model: "gpt-4.1", rota: "analise", usage: { prompt_tokens: 10, completion_tokens: 5 } });
    assert.equal(global.__ultimoInsertUsoIA, null, "sem organizationId não pode gravar evento nenhum");
    console.log("v1038 (registrarUsoIA grava evento real): ok");
  });

  // 3. analyzeWithBrain (a chamada mais cara do sistema) registra o uso de verdade após analisar.
  await comServidor(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/rest/v1/direciona_config") { res.end("null"); return; } // limite diário: sem contagem ainda
    if (url.pathname === "/rest/v1/ai_usage_events" && req.method === "POST") {
      global.__eventoAnalise = JSON.parse(body || "{}");
      res.statusCode = 201; res.end("{}"); return;
    }
    res.statusCode = 500;
    res.end(JSON.stringify({ error: `rota simulada não atendida: ${req.method} ${url.pathname}` }));
  }, async () => {
    const respostaBase = {
      summary: "Resumo", diagnostico: { produtoPrincipal: "Produto", etapaFunil: "Atendimento" },
      mensagens: { recomendada: "Oi?", maisSuave: "Oi?", maisDireta: "Oi?" },
      produtoInteresse: "Produto", produtosInteresse: ["Produto"], etapaSugerida: "Atendimento",
      clientProfile: "Perfil", nextAction: "Ação"
    };
    const openaiMock = {
      chat: { completions: { create: async () => ({
        model: "gpt-4.1-mock",
        usage: { prompt_tokens: 5000, completion_tokens: 800 },
        choices: [{ message: { content: JSON.stringify(respostaBase) } }]
      }) } }
    };
    const timeline = [{ date: "09/05/2026", time: "18:30", author: "Cliente", text: "Quero entender as condições." }];
    const resultado = await analyzeWithBrain({
      lead: { clientName: "Cliente" }, timeline, openai: openaiMock,
      cerebroConfig: { metodo: "método do corretor" }, organizationId: "org-analise-teste"
    });
    assert.equal(resultado.mode, "openai", "a análise precisa ter dado certo pro evento fazer sentido");
    const evento = global.__eventoAnalise;
    assert.ok(evento, "analyzeWithBrain precisa ter registrado um evento de uso de IA");
    assert.equal(evento.organization_id, "org-analise-teste");
    assert.equal(evento.kind, "chat");
    assert.equal(evento.model, "gpt-4.1-mock", "precisa gravar o modelo que a OpenAI de fato usou, não só o configurado");
    assert.equal(evento.rota, "analise");
    assert.equal(evento.prompt_tokens, 5000);
    assert.equal(evento.completion_tokens, 800);
    console.log("v1038 (analyzeWithBrain registra uso real): ok");
  });

  // 4. transcreverBuffer pede verbose_json (pra saber a DURAÇÃO do áudio) e registra em segundos.
  await comServidor(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/rest/v1/ai_usage_events" && req.method === "POST") {
      global.__eventoWhisper = JSON.parse(body || "{}");
      res.statusCode = 201; res.end("{}"); return;
    }
    res.statusCode = 500;
    res.end(JSON.stringify({ error: `rota simulada não atendida: ${req.method} ${url.pathname}` }));
  }, async () => {
    let payloadEnviado = null;
    const openaiMock = {
      audio: { transcriptions: { create: async (payload) => {
        payloadEnviado = payload;
        // transcreverBuffer apaga o arquivo temporário assim que esta chamada retorna (ver
        // finally em api/_pipeline.js) — o SDK real da OpenAI já leu o stream inteiro antes de
        // devolver a resposta; este mock não lê, então precisa pelo menos escutar o stream (senão
        // o Node emite um "error" (ENOENT) sem ouvinte quando o arquivo some, derrubando o teste).
        payload?.file?.on?.("error", () => {});
        payload?.file?.resume?.();
        return { text: "Olá, tudo bem?", duration: 42.5 };
      } } }
    };
    const buffer = Buffer.from("audio-fake-de-teste");
    const texto = await transcreverBuffer(buffer, ".ogg", openaiMock, "org-whisper-teste", "transcricao-import");
    assert.equal(texto, "Olá, tudo bem?");
    assert.equal(payloadEnviado.response_format, "verbose_json", "precisa pedir verbose_json pra receber a duração do áudio");
    const evento = global.__eventoWhisper;
    assert.ok(evento, "transcreverBuffer precisa ter registrado um evento de uso de IA");
    assert.equal(evento.organization_id, "org-whisper-teste");
    assert.equal(evento.kind, "whisper");
    assert.equal(evento.rota, "transcricao-import");
    assert.equal(evento.audio_seconds, 42.5);
    console.log("v1038 (transcreverBuffer pede duração e registra uso): ok");
  });

  // 5. api/admin-contas.js?relatorio=uso-ia (v1039: absorveu api/admin-uso-ia.js pra caber no
  // limite de 12 Serverless Functions do plano Hobby — ver NOTAS-v1039.md): exige administrador
  // da plataforma e agrega por empresa sem misturar.
  await comServidor(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/auth/v1/user") { res.end(JSON.stringify({ id: "user-comum" })); return; }
    if (url.pathname === "/rest/v1/platform_admins") { res.end("null"); return; } // não é admin
    res.statusCode = 500;
    res.end(JSON.stringify({ error: `rota simulada não atendida: ${req.method} ${url.pathname}` }));
  }, async () => {
    const { default: handler } = await import(`../api/admin-contas.js?v1038a=${Date.now()}`);
    const req = { method: "GET", headers: { authorization: "Bearer token-nao-admin" }, query: { relatorio: "uso-ia" } };
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 403, res.payload);
    console.log("v1038 (admin-contas.js?relatorio=uso-ia recusa quem não é administrador): ok");
  });

  await comServidor(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/auth/v1/user") { res.end(JSON.stringify({ id: "admin-1" })); return; }
    if (url.pathname === "/rest/v1/platform_admins") { res.end(JSON.stringify({ user_id: "admin-1" })); return; }
    if (url.pathname === "/rest/v1/organizations") {
      res.end(JSON.stringify([{ id: "org-a", nome: "Empresa A" }, { id: "org-b", nome: "Empresa B" }]));
      return;
    }
    if (url.pathname === "/rest/v1/ai_usage_events") {
      const agora = new Date();
      const ontem = new Date(agora.getTime() - 2 * 86400000).toISOString();
      res.end(JSON.stringify([
        { organization_id: "org-a", kind: "chat", model: "gpt-4o-mini", rota: "analise", prompt_tokens: 1_000_000, completion_tokens: 0, audio_seconds: 0, criado_em: agora.toISOString() },
        { organization_id: "org-a", kind: "chat", model: "gpt-4o-mini", rota: "analise", prompt_tokens: 1_000_000, completion_tokens: 0, audio_seconds: 0, criado_em: ontem },
        { organization_id: "org-b", kind: "whisper", model: "whisper-1", rota: "transcricao-import", prompt_tokens: 0, completion_tokens: 0, audio_seconds: 600, criado_em: agora.toISOString() }
      ]));
      return;
    }
    res.statusCode = 500;
    res.end(JSON.stringify({ error: `rota simulada não atendida: ${req.method} ${url.pathname}` }));
  }, async () => {
    const { default: handler } = await import(`../api/admin-contas.js?v1038b=${Date.now()}`);
    const req = { method: "GET", headers: { authorization: "Bearer token-admin" }, query: { relatorio: "uso-ia", dias: "30" } };
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 200, res.payload);
    const r = JSON.parse(res.payload);
    assert.equal(r.ok, true);
    const empresaA = r.empresas.find(e => e.organizationId === "org-a");
    const empresaB = r.empresas.find(e => e.organizationId === "org-b");
    assert.ok(empresaA && empresaB, "as duas empresas precisam aparecer, sem misturar uma com a outra");
    assert.equal(empresaA.nome, "Empresa A");
    assert.equal(empresaA.hoje.chamadas, 1, "empresa A: só 1 chamada é de HOJE (a de ontem não conta)");
    assert.equal(empresaA.periodo.chamadas, 2, "empresa A: as 2 chamadas contam no período de 30 dias");
    assert.equal(empresaA.hoje.custoEstimadoBRL > 0, true, "custo de hoje da empresa A precisa ser maior que zero");
    assert.equal(empresaB.periodo.audioMinutos, 10, "empresa B: 600s de áudio = 10 minutos");
    assert.equal(empresaB.hoje.tokensEntrada, 0, "empresa B não teve tokens de chat, só áudio");
    console.log("v1039 (admin-contas.js?relatorio=uso-ia agrega por empresa, hoje vs período): ok");
  });
} finally {
  restaurarEnv();
  delete global.__ultimoInsertUsoIA;
  delete global.__eventoAnalise;
  delete global.__eventoWhisper;
}

console.log("v1038-telemetria-uso-ia: ok");
