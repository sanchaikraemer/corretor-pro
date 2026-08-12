import http from "node:http";
import fs from "node:fs";
import assert from "node:assert/strict";

// v1197 — DESFAZER UMA MENSAGEM QUE FOI COPIADA MAS NÃO ENVIADA.
//
// Relato do dono (10/08/2026, com print): copiou a sugestão sem querer, NÃO mandou pro cliente, e
// ela ficou registrada no histórico — com o cliente marcado como atendido, o que o tira da fila
// do dia por vários dias.
//
// Copiar registra TRÊS coisas de uma vez (ver cp704CopyMsg em app.js e o bloco `apenasSalvar` em
// api/reanalisar-lead.js):
//   1. a mensagem no histórico (timeline, type "mensagem_enviada");
//   2. o ATENDIMENTO do dia (evento contato_manual, detalhes.de = "copiar_msg");
//   3. a marca de uso "Copiou mensagem" (evento mensagem_copiada, que alimenta o Desempenho).
//
// Desfazer só a mensagem deixaria o cliente atendido sem motivo — que é o efeito mais caro pro
// trabalho dele. Este teste roda a rota DE VERDADE contra um banco simulado e trava as regras.

const HOJE = new Date();
const isoHoje = (h, m) => {
  const d = new Date(HOJE); d.setUTCHours(h, m, 0, 0); return d.toISOString();
};
const ONTEM = new Date(HOJE); ONTEM.setUTCDate(ONTEM.getUTCDate() - 1);
const isoOntem = (h) => { const d = new Date(ONTEM); d.setUTCHours(h, 0, 0, 0); return d.toISOString(); };

// ── estado do "banco" ──────────────────────────────────────────────────────────────────────
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
  const { default: handler } = await import(`../api/reanalisar-lead.js?v1197=${Date.now()}`);

  async function chamar(body) {
    let statusCode = 0, response = "";
    const res = { status(n) { statusCode = n; return this; }, setHeader() { return this; }, end(v = "") { response += v; return this; } };
    await handler({ method: "POST", headers: {}, body }, res);
    return { statusCode, payload: response ? JSON.parse(response) : null };
  }

  const msgDoCliente = { iso: isoHoje(12, 0), author: "Bocorni", text: "bom dia", type: "mensagem", source: "whatsapp" };
  const copiaDeHoje = { iso: isoHoje(14, 30), author: "Mensagem enviada (você)", text: "Bom dia Bocorni, tudo bem?", type: "mensagem_enviada", source: "manual" };
  const copiaDeOntem = { iso: isoOntem(15), author: "Mensagem enviada (você)", text: "mensagem de ontem", type: "mensagem_enviada", source: "manual" };

  const estadoBase = () => ({
    timeline_json: [msgDoCliente, copiaDeOntem, copiaDeHoje],
    resultado_analise: {
      aprendizado: {
        eventos: [
          { evento: "contato_manual", detalhes: { tipo: "Mensagem enviada", de: "copiar_msg" }, quando: isoOntem(15) },
          { evento: "contato_manual", detalhes: { tipo: "Mensagem enviada", de: "copiar_msg" }, quando: isoHoje(14, 30) },
          { evento: "mensagem_copiada", detalhes: { de: "fazer_agora" }, quando: isoHoje(14, 30) },
          { evento: "contato_manual", detalhes: { tipo: "Observação", de: "observacao" }, quando: isoHoje(9, 0) }
        ]
      },
      lembrete: null
    },
    nome_arquivo: "Conversa do WhatsApp com Bocorni.zip",
    etapa: "Novo"
  });

  // ── 1. desfazer a única cópia de hoje: some do histórico E o atendimento de hoje é desfeito ──
  linha = estadoBase(); ultimoPatch = null;
  {
    const { statusCode, payload } = await chamar({ action: "desfazer-mensagem-enviada", id: "lead-1", iso: copiaDeHoje.iso });
    assert.equal(statusCode, 200, "desfazer deveria responder 200");
    assert.equal(payload?.ok, true, "desfazer deveria responder ok:true");
    assert.equal(payload?.atendimentoDesfeito, true, "era a única cópia de hoje: o atendimento de hoje precisa ser desfeito");

    const tl = ultimoPatch?.timeline_json || [];
    assert.ok(!tl.some(m => m.iso === copiaDeHoje.iso), "a mensagem copiada precisa sair do histórico");
    assert.ok(tl.some(m => m.iso === msgDoCliente.iso), "a fala do cliente NÃO pode ser apagada junto");
    assert.ok(tl.some(m => m.iso === copiaDeOntem.iso), "a cópia de ONTEM não pode ser apagada junto");

    const evs = ultimoPatch?.resultado_analise?.aprendizado?.eventos || [];
    assert.ok(!evs.some(e => e.evento === "contato_manual" && e.detalhes?.de === "copiar_msg" && e.quando === copiaDeHoje.iso),
      "o atendimento gerado pela cópia de hoje precisa sair — senão o cliente segue fora da fila sem motivo");
    assert.ok(!evs.some(e => e.evento === "mensagem_copiada" && e.quando === isoHoje(14, 30)),
      'a marca de uso "Copiou mensagem" do dia também precisa sair (ela conta no Desempenho)');
    assert.ok(evs.some(e => e.evento === "contato_manual" && e.detalhes?.de === "copiar_msg" && e.quando === isoOntem(15)),
      "o atendimento de ONTEM não pode ser tocado");
    assert.ok(evs.some(e => e.detalhes?.de === "observacao"),
      "uma observação feita hoje NÃO é da cópia e precisa continuar (ela é trabalho de verdade do corretor)");
  }

  // ── 2. duas cópias no mesmo dia: apagar uma NÃO desfaz o atendimento do dia ─────────────────
  linha = estadoBase();
  const segundaCopiaHoje = { iso: isoHoje(16, 0), author: "Mensagem enviada (você)", text: "outra mensagem de hoje", type: "mensagem_enviada", source: "manual" };
  linha.timeline_json = [...linha.timeline_json, segundaCopiaHoje];
  ultimoPatch = null;
  {
    const { payload } = await chamar({ action: "desfazer-mensagem-enviada", id: "lead-1", iso: copiaDeHoje.iso });
    assert.equal(payload?.ok, true);
    assert.equal(payload?.atendimentoDesfeito, false,
      "ainda há outra mensagem copiada hoje: o atendimento do dia continua valendo");
    const evs = ultimoPatch?.resultado_analise?.aprendizado?.eventos || [];
    assert.ok(evs.some(e => e.evento === "contato_manual" && e.detalhes?.de === "copiar_msg" && e.quando === copiaDeHoje.iso),
      "com outra cópia no mesmo dia, os eventos do dia ficam intactos");
    assert.ok((ultimoPatch?.timeline_json || []).some(m => m.iso === segundaCopiaHoje.iso),
      "a outra mensagem copiada hoje continua no histórico");
  }

  // ── 3. TRAVA: não dá pra apagar por aqui uma fala vinda do WhatsApp ─────────────────────────
  linha = estadoBase(); ultimoPatch = null;
  {
    const { statusCode, payload } = await chamar({ action: "desfazer-mensagem-enviada", id: "lead-1", iso: msgDoCliente.iso });
    assert.equal(statusCode, 400, "apagar fala do cliente por este caminho precisa ser recusado");
    assert.equal(payload?.ok, false);
    assert.equal(ultimoPatch, null, "nada pode ser gravado numa tentativa recusada");
  }

  // ── 4. item que não existe mais ─────────────────────────────────────────────────────────────
  linha = estadoBase(); ultimoPatch = null;
  {
    const { statusCode } = await chamar({ action: "desfazer-mensagem-enviada", id: "lead-1", iso: "2020-01-01T00:00:00.000Z" });
    assert.equal(statusCode, 404, "mensagem inexistente precisa responder 404, não apagar nada");
    assert.equal(ultimoPatch, null);
  }

  // ── 5. sem informar qual mensagem ───────────────────────────────────────────────────────────
  linha = estadoBase(); ultimoPatch = null;
  {
    const { statusCode } = await chamar({ action: "desfazer-mensagem-enviada", id: "lead-1" });
    assert.equal(statusCode, 400, "sem o identificador da mensagem, precisa recusar");
    assert.equal(ultimoPatch, null);
  }

  console.log("v1197-desfazer-mensagem-copiada: rota ok (some do histórico, desfaz o atendimento só quando deve, e não apaga fala do cliente)");
} finally {
  await new Promise(r => server.close(r));
}

// ── 6. a tela: o X só aparece na mensagem que o app registrou ─────────────────────────────────
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
// v1237 — o mesmo ✕ passou a valer também pra OBSERVAÇÃO escrita pelo corretor. A intenção
// original deste assert não mudou e continua travada: o botão só aparece no que o APP registrou
// (mensagem copiada ou observação) e que tenha identificador — fala vinda da conversa exportada do
// WhatsApp nunca ganha ✕.
assert.match(app, /const podeDesfazer = \(ehEnviada \|\| ehObsApagavel\) && String\(m\?\.iso \|\| ''\)/,
  'o botão de desfazer só pode aparecer no que o app registrou (mensagem copiada ou observação) e que tenha identificador');
assert.match(app, /ehObsApagavel = tipo==='observacao_manual'/,
  'a observação apagável é só a que o corretor registrou pelo app');
assert.match(app, /cp704DesfazerMensagemEnviada\(/, "o X precisa chamar o desfazer");
assert.match(app, /action:'desfazer-mensagem-enviada'/, "a tela precisa chamar a ação certa do servidor");
assert.match(app, /event\.stopPropagation\(\)/,
  "o X não pode disparar o clique do balão (proposta salva abre ao tocar no balão)");
// Confirmação obrigatória: é uma remoção, e o dono pediu, desde a v1186, que apagar sempre pergunte.
// v1237 — o fim do bloco é a função nova de apagar observação, que passou a morar entre as duas.
const bloco = app.slice(app.indexOf("window.cp704DesfazerMensagemEnviada"), app.indexOf("window.cp704ApagarObservacao"));
assert.match(bloco, /cp903Confirm/, "desfazer precisa perguntar antes");
assert.match(bloco, /atendimento de hoje também é desfeito/,
  "a pergunta precisa avisar, em português de gente, que o atendimento pode ser desfeito junto");
assert.match(bloco, /recarregarLeadFoco/, "a tela do cliente precisa se redesenhar depois de desfazer");

// ── 7. o X precisa aparecer NOS DOIS TEMAS ────────────────────────────────────────────────────
// O botão nasce com borda e fundo em branco transparente — ótimo no tema escuro, invisível no
// fundo branco do tema claro. Foi flagrado em print antes de publicar; a regra abaixo é o
// conserto, e este assert impede que ela suma numa faxina de CSS futura.
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
assert.match(css, /html\[data-theme="light"\]\s*\.cp704-tmsg-undo\s*\{/,
  'o X precisa de regra própria no tema claro — sem ela ele some no fundo branco');
assert.match(css, /html\[data-theme="light"\]\s*\.cp704-tmsg-undo:hover\s*\{/,
  'no tema claro, passar o dedo/mouse no X precisa mostrar que aquilo remove algo');

console.log("v1197-desfazer-mensagem-copiada: tela ok (X só na mensagem certa, pergunta antes, redesenha depois, visível nos dois temas)");
