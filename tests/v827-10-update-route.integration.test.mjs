import http from "node:http";
import assert from "node:assert/strict";

const currentAnalysis = {
  clientName: "Rudi Maciel Renaissance",
  lead: { clientName: "Rudi Maciel Renaissance", phone: "" },
  memoria: { observacoes: "teste" },
  summary: "anterior",
  messages: {
    a: "Boa tarde, mensagem anterior válida para você?",
    b: "Boa tarde, podemos conversar sobre isso agora?",
    c: "Boa tarde, qual próximo passo prefere seguir?"
  }
};
const oldTimeline = [{ date:"14/07/2026", time:"10:00", author:"Rudi", text:"Mensagem antiga", iso:"2026-07-14T10:00:00-03:00" }];
let patchCount = 0;

const server = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/rest/v1/whatsapp_processamentos" && req.method === "GET") {
    res.statusCode = 200;
    res.end(JSON.stringify({
      resultado_analise: currentAnalysis,
      etapa: "Atendimento",
      timeline_json: oldTimeline,
      atualizado_em: "2026-07-14T10:00:00Z",
      updated_at: "2026-07-14T10:00:00Z"
    }));
    return;
  }
  if (url.pathname === "/rest/v1/whatsapp_processamentos" && req.method === "PATCH") {
    patchCount++;
    if (url.searchParams.get("select")) {
      res.statusCode = 200;
      res.end(JSON.stringify({ id:"lead-1" }));
    } else {
      res.statusCode = 204;
      res.end();
    }
    return;
  }
  if (url.pathname === "/rest/v1/direciona_config" && req.method === "POST") {
    res.statusCode = 201;
    res.end("{}");
    return;
  }
  res.statusCode = 500;
  res.end(JSON.stringify({ error:`Rota simulada não atendida: ${req.method} ${url.pathname}`, body }));
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const port = server.address().port;
  process.env.NODE_ENV = "test";
  process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
  const { default: handler } = await import(`../api/lead-update.js?integration=${Date.now()}`);
  const validAnalysis = {
    mode:"openai",
    summary:"nova análise pronta",
    sugestoesPendentes:false,
    messages:{
      a:"Boa tarde, podemos retomar o ponto principal da conversa?",
      b:"Boa tarde, qual alternativa faz mais sentido para você?",
      c:"Boa tarde, posso avançar com a próxima etapa hoje?"
    },
    validacaoSugestoes:[],
    mensagensValidadasEm:new Date().toISOString(),
    clientName:"Rudi Maciel Renaissance",
    lead:{ clientName:"Rudi Maciel Renaissance" }
  };
  const req = {
    method:"POST",
    headers:{},
    body:{
      action:"atualizar-com-evolucao",
      id:"lead-1",
      importId:"import-12345678",
      result:{
        analysis:validAnalysis,
        lead:{ clientName:"Rudi Maciel Renaissance" },
        timeline:[...oldTimeline, { date:"15/07/2026", time:"11:00", author:"Rudi", text:"Mensagem nova", iso:"2026-07-15T11:00:00-03:00" }],
        audiosEncontrados:1,
        audiosTranscritos:1
      }
    }
  };
  let statusCode = 0;
  let response = "";
  const res = {
    status(n){ statusCode = n; return this; },
    setHeader(){ return this; },
    end(value = ""){ response += value; return this; }
  };
  await handler(req, res);
  const payload = JSON.parse(response);
  assert.equal(statusCode, 200, response);
  assert.equal(payload.ok, true);
  assert.equal(payload.id, "lead-1");
  assert.equal(patchCount, 2, "deve consolidar a timeline e depois salvar a análise");
  console.log("v827-10 update route integration: ok");
} finally {
  await new Promise(resolve => server.close(resolve));
}
