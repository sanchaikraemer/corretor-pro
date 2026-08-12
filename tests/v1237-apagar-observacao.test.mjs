// v1237 — APAGAR UMA OBSERVAÇÃO DO HISTÓRICO.
//
// Pedido do dono (12/08/2026, com print): "quero opção de apagar a última mensagem, assim posso
// reanalisar de novo". Ele tinha registrado uma observação contando a mensagem que mandou pro
// cliente e queria tirá-la pra rodar a análise sem ela. Não existia caminho nenhum — o ✕ da v1197
// só aparece em mensagem copiada pelo app.
//
// Por que isso não é detalhe de tela: observação entra no pedido enviado à IA como VERDADE
// CONFIRMADA, com peso alto no diagnóstico (ver observacoesManuaisTexto em api/_pipeline.js). Uma
// observação ditada errada ou duplicada empurrava a análise inteira, sem volta.
//
// Salvar uma observação grava QUATRO coisas (api/lead-update.js): o item da timeline, a entrada em
// memoria.observacoesManuais, a linha no texto corrido memoria.observacoes e o ATENDIMENTO do dia.
// Este teste roda a rota DE VERDADE contra um banco simulado e trava que as quatro são desfeitas.
import http from "node:http";
import fs from "node:fs";
import assert from "node:assert/strict";

const HOJE = new Date();
const isoHoje = (h, m) => { const d = new Date(HOJE); d.setUTCHours(h, m, 0, 0); return d.toISOString(); };
const ONTEM = new Date(HOJE); ONTEM.setUTCDate(ONTEM.getUTCDate() - 1);
const isoOntem = (h) => { const d = new Date(ONTEM); d.setUTCHours(h, 0, 0, 0); return d.toISOString(); };

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
  const { default: handler } = await import(`../api/reanalisar-lead.js?v1237=${Date.now()}`);

  async function chamar(body) {
    let statusCode = 0, response = "";
    const res = { status(n) { statusCode = n; return this; }, setHeader() { return this; }, end(v = "") { response += v; return this; } };
    await handler({ method: "POST", headers: {}, body }, res);
    return { statusCode, payload: response ? JSON.parse(response) : null };
  }

  const falaDoCliente = { iso: isoHoje(12, 0), author: "Adriano", text: "bom dia", type: "mensagem", source: "whatsapp" };
  const obsDeHoje = {
    id: "obs-111", iso: isoHoje(18, 31), date: "12/08/2026", time: "18:31",
    author: "Observação do corretor", text: "Mandei essa msg pra ele",
    type: "observacao_manual", source: "corretor-pro-manual", manual: true
  };
  const obsDeOntem = {
    id: "obs-000", iso: isoOntem(15), date: "11/08/2026", time: "15:00",
    author: "Observação do corretor", text: "observação de ontem",
    type: "observacao_manual", source: "corretor-pro-manual", manual: true
  };

  const estadoBase = () => ({
    timeline_json: [falaDoCliente, obsDeOntem, obsDeHoje],
    resultado_analise: {
      memoria: {
        observacoes: "[11/08/2026 15:00] observação de ontem\n[12/08/2026 18:31] Mandei essa msg pra ele",
        observacoesManuais: [
          { id: "obs-000", texto: "observação de ontem", criadoEm: isoOntem(15) },
          { id: "obs-111", texto: "Mandei essa msg pra ele", criadoEm: isoHoje(18, 31) }
        ],
        preferencias: "não pode sumir"
      },
      aprendizado: {
        eventos: [
          { evento: "contato_manual", detalhes: { tipo: "Observação", de: "observacao_manual" }, quando: isoOntem(15) },
          { evento: "contato_manual", detalhes: { tipo: "Observação", de: "observacao_manual" }, quando: isoHoje(18, 31) },
          { evento: "contato_manual", detalhes: { tipo: "Mensagem enviada", de: "copiar_msg" }, quando: isoHoje(9, 0) }
        ]
      }
    },
    nome_arquivo: "Conversa do WhatsApp com Adriano.zip",
    etapa: "Novo"
  });

  // ── 1. Apagar a única observação de hoje: sai de TODOS os lugares ───────────────────────────
  linha = estadoBase(); ultimoPatch = null;
  {
    const { statusCode, payload } = await chamar({ action: "apagar-observacao", id: "lead-1", iso: obsDeHoje.iso });
    assert.equal(statusCode, 200, "apagar deveria responder 200");
    assert.equal(payload?.ok, true, "apagar deveria responder ok:true");
    assert.equal(payload?.atendimentoDesfeito, true, "era a única observação de hoje: o atendimento de hoje é desfeito");

    const tl = ultimoPatch?.timeline_json || [];
    assert.ok(!tl.some(m => m.iso === obsDeHoje.iso), "a observação precisa sair do histórico");
    assert.ok(tl.some(m => m.iso === falaDoCliente.iso), "a fala do cliente NÃO pode ser apagada junto");
    assert.ok(tl.some(m => m.iso === obsDeOntem.iso), "a observação de ONTEM não pode ser apagada junto");

    // O texto tem que sumir da memória também — senão continuaria pesando na próxima análise,
    // que é exatamente o motivo de ele querer apagar.
    const mem = ultimoPatch?.resultado_analise?.memoria || {};
    assert.ok(!String(mem.observacoes || "").includes("Mandei essa msg pra ele"),
      "o texto apagado não pode sobreviver no texto corrido das observações");
    assert.ok(String(mem.observacoes || "").includes("observação de ontem"),
      "a observação de ontem continua no texto corrido");
    assert.ok(!(mem.observacoesManuais || []).some(o => o.id === "obs-111"),
      "a entrada apagada tem que sair da lista de observações manuais");
    assert.ok((mem.observacoesManuais || []).some(o => o.id === "obs-000"),
      "a observação de ontem continua na lista");
    assert.equal(mem.preferencias, "não pode sumir", "o resto da memória do lead não pode ser perdido");

    const evs = ultimoPatch?.resultado_analise?.aprendizado?.eventos || [];
    assert.ok(!evs.some(e => e.detalhes?.de === "observacao_manual" && e.quando === obsDeHoje.iso),
      "o atendimento gerado pela observação de hoje precisa sair — senão o cliente segue fora da fila sem motivo");
    assert.ok(evs.some(e => e.detalhes?.de === "observacao_manual" && e.quando === isoOntem(15)),
      "o atendimento de ONTEM não pode ser tocado");
    assert.ok(evs.some(e => e.detalhes?.de === "copiar_msg"),
      "atendimento de hoje que veio de COPIAR mensagem não é desta observação e continua valendo");
  }

  // ── 2. Duas observações no mesmo dia: apagar uma não desfaz o atendimento do dia ────────────
  linha = estadoBase();
  const outraObsHoje = {
    id: "obs-222", iso: isoHoje(19, 0), date: "12/08/2026", time: "19:00",
    author: "Observação do corretor", text: "outra de hoje", type: "observacao_manual", source: "corretor-pro-manual"
  };
  linha.timeline_json = [...linha.timeline_json, outraObsHoje];
  ultimoPatch = null;
  {
    const { payload } = await chamar({ action: "apagar-observacao", id: "lead-1", iso: obsDeHoje.iso });
    assert.equal(payload?.ok, true);
    assert.equal(payload?.atendimentoDesfeito, false,
      "ainda há outra observação hoje: o atendimento do dia continua valendo");
    assert.ok((ultimoPatch?.timeline_json || []).some(m => m.iso === outraObsHoje.iso),
      "a outra observação de hoje continua no histórico");
  }

  // ── 3. Fala do cliente NUNCA pode ser apagada por aqui ──────────────────────────────────────
  linha = estadoBase(); ultimoPatch = null;
  {
    const { statusCode, payload } = await chamar({ action: "apagar-observacao", id: "lead-1", iso: falaDoCliente.iso });
    assert.equal(statusCode, 400, "apagar fala do cliente tem que ser recusado");
    assert.equal(payload?.ok, false);
    assert.equal(ultimoPatch, null, "nada pode ser gravado quando o alvo é inválido");
  }

  // ── 4. Observação que não existe mais ───────────────────────────────────────────────────────
  linha = estadoBase(); ultimoPatch = null;
  {
    const { statusCode } = await chamar({ action: "apagar-observacao", id: "lead-1", iso: isoHoje(23, 59) });
    assert.equal(statusCode, 404, "observação inexistente responde 404");
    assert.equal(ultimoPatch, null, "e não grava nada");
  }

  // ── 5. Sem iso ──────────────────────────────────────────────────────────────────────────────
  linha = estadoBase(); ultimoPatch = null;
  {
    const { statusCode } = await chamar({ action: "apagar-observacao", id: "lead-1" });
    assert.equal(statusCode, 400, "sem identificar a observação, responde 400");
  }
} finally {
  await new Promise(r => server.close(r));
}

// ── 6. A tela: o ✕ aparece na observação e chama a ação certa ───────────────────────────────
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const ini = app.indexOf("function cp704TimelineHtml(");
const fim = app.indexOf("window.cp704DesfazerMensagemEnviada", ini);
const timelineSrc = app.slice(ini, fim);

assert.match(timelineSrc, /ehObsApagavel = tipo==='observacao_manual'/,
  "a observação registrada por você precisa poder ser apagada");
assert.match(timelineSrc, /podeDesfazer = \(ehEnviada \|\| ehObsApagavel\)/,
  "o ✕ vale pra mensagem copiada E pra observação");
assert.match(timelineSrc, /cp704ApagarObservacao\(/,
  "o ✕ da observação chama a função de apagar observação");
assert.match(timelineSrc, /title="Apagar esta observação"/,
  "o botão precisa dizer o que faz (o texto de 'não enviei essa mensagem' não serve aqui)");

// A função existe, confirma antes e recarrega o lead pra ele já poder reanalisar.
const iniFn = app.indexOf("window.cp704ApagarObservacao");
const fnSrc = app.slice(iniFn, app.indexOf("window.cp704AbrirPropostaSalva", iniFn));
assert.match(fnSrc, /action:'apagar-observacao'/, "chama a ação nova da rota");
assert.match(fnSrc, /cp903Confirm|confirm\(/, "apagar é destrutivo: tem que confirmar antes");
assert.match(fnSrc, /recarregarLeadFoco/, "depois de apagar, a tela do lead precisa se atualizar");

// Fala do cliente não ganha ✕ na tela (a trava do servidor é a segunda linha de defesa).
assert.ok(!/tipo==='mensagem'/.test(timelineSrc.slice(timelineSrc.indexOf("ehObsApagavel"))),
  "só observação e mensagem copiada ganham o ✕");

console.log("v1237-apagar-observacao: ok");
