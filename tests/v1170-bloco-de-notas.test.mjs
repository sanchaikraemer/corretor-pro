import http from "node:http";
import fs from "node:fs";
import assert from "node:assert/strict";
import handler from "../api/cerebro-config.js";

// v1170 — bloco de notas administrativas. Pedido do dono: um lugar fácil de achar, no topo da
// Home, pra anotar tarefa que NÃO é atendimento de cliente ("verificar pagamento de entrada de
// tal cliente", "matrículas atualizadas no registro de imóveis").
//
// Decisão de arquitetura que este arquivo protege: a nota mora numa chave PRÓPRIA do banco
// (NOTAS_KEY = "notas-rapidas"), separada da chave do Cérebro Comercial (CONFIG_KEY =
// "direciona-cerebro"). O Cérebro vira contexto que a IA lê pra montar sugestão de mensagem pro
// cliente — se uma nota administrativa fosse guardada ali dentro, "verificar pagamento da Maria"
// podia um dia vazar pra uma sugestão de mensagem PRA a própria Maria. As duas chaves nunca podem
// virar uma só.
//
// Sincroniza pelo servidor (mesmo padrão do Cérebro): sem login (caminho de teste/chave
// compartilhada), cai na conta original — é assim que os outros testes de rota já operam.

function fakeRes() {
  return {
    statusCode: 200,
    payload: null,
    status(codigo) { this.statusCode = codigo; return this; },
    setHeader() {},
    end(corpo) { this.payload = corpo ? JSON.parse(corpo) : null; }
  };
}
function fakeReq(corpo) {
  return { method: "POST", headers: {}, body: corpo };
}
function fakeReqGet() {
  return { method: "GET", headers: {}, body: null };
}

// ── Supabase de mentira: um servidor HTTP de verdade respondendo como o REST do Supabase ───────
// Mesmo padrão já usado em tests/v1110-planos-pro-e-pro-master.test.mjs — direciona_config guarda
// linhas em memória, indexadas por (chave, organization_id).
function montarServidorFake() {
  const tabela = new Map(); // `${chave}::${organizationId}` -> valor
  const chamadas = { gets: [], posts: [] };
  const chaveDe = (q) => {
    // URLSearchParams.get() já devolve o valor decodificado — decodificar de novo quebra em
    // valores que contenham "%" de verdade (URIError: URI malformed).
    const chave = String(q.get("chave") || "").replace(/^eq\./, "");
    const org = String(q.get("organization_id") || "").replace(/^eq\./, "");
    return `${chave}::${org}`;
  };
  const server = http.createServer(async (req, res) => {
    let body = ""; for await (const c of req) body += c;
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/rest/v1/direciona_config" && req.method === "GET") {
      const k = chaveDe(url.searchParams);
      chamadas.gets.push(k);
      const valor = tabela.get(k);
      return res.end(valor === undefined ? "null" : JSON.stringify({ valor }));
    }
    if (url.pathname === "/rest/v1/direciona_config" && (req.method === "POST" || req.method === "PATCH")) {
      let payload; try { payload = JSON.parse(body); } catch (_) { payload = {}; }
      const linhas = Array.isArray(payload) ? payload : [payload];
      for (const linha of linhas) {
        const k = `${linha.chave}::${linha.organization_id}`;
        tabela.set(k, linha.valor);
        chamadas.posts.push({ chave: linha.chave, organization_id: linha.organization_id, valor: linha.valor });
      }
      return res.end("{}");
    }
    res.statusCode = 404;
    res.end("{}");
  });
  return { server, tabela, chamadas };
}

async function comServidor(fn) {
  const { server, tabela, chamadas } = montarServidorFake();
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const antes = { url: process.env.SUPABASE_URL, chave: process.env.SUPABASE_SERVICE_ROLE_KEY };
  try {
    process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
    return await fn({ tabela, chamadas });
  } finally {
    process.env.SUPABASE_URL = antes.url;
    process.env.SUPABASE_SERVICE_ROLE_KEY = antes.chave;
    await new Promise(r => server.close(r));
  }
}

const EMPRESA_PRINCIPAL = "00000000-0000-0000-0000-000000000001";

// ── 1. Sem texto: recusa, nada é gravado ────────────────────────────────────────────────────────
await comServidor(async ({ chamadas }) => {
  const res = fakeRes();
  await handler(fakeReq({ action: "nota-adicionar", texto: "   " }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.payload?.ok, false);
  assert.equal(chamadas.posts.length, 0, "nota vazia não pode gravar nada");
});

// ── 2. Adicionar duas notas: a mais nova vem primeiro ──────────────────────────────────────────
await comServidor(async () => {
  const r1 = fakeRes();
  await handler(fakeReq({ action: "nota-adicionar", texto: "Verificar pagamento de entrada da Maria" }), r1);
  assert.equal(r1.statusCode, 200);
  assert.equal(r1.payload.notas.length, 1);
  const nota1 = r1.payload.notas[0];
  assert.equal(nota1.texto, "Verificar pagamento de entrada da Maria");
  assert.equal(nota1.feita, false);
  assert.ok(nota1.id, "a nota precisa de um id");
  assert.ok(nota1.criadoEm, "a nota precisa de um carimbo de quando foi criada");

  const r2 = fakeRes();
  await handler(fakeReq({ action: "nota-adicionar", texto: "Matrícula atualizada no registro de imóveis" }), r2);
  assert.equal(r2.payload.notas.length, 2);
  assert.equal(r2.payload.notas[0].texto, "Matrícula atualizada no registro de imóveis", "a mais recente aparece primeiro");
  assert.equal(r2.payload.notas[1].id, nota1.id, "a nota antiga continua na lista");
});

// ── 3. Concluir marca feita + concluidaEm; desmarcar limpa concluidaEm ─────────────────────────
await comServidor(async () => {
  const add = fakeRes();
  await handler(fakeReq({ action: "nota-adicionar", texto: "Ligar pro cartório" }), add);
  const id = add.payload.notas[0].id;

  const concluir = fakeRes();
  await handler(fakeReq({ action: "nota-concluir", id, feita: true }), concluir);
  assert.equal(concluir.statusCode, 200);
  const feita = concluir.payload.notas.find(n => n.id === id);
  assert.equal(feita.feita, true);
  assert.ok(feita.concluidaEm, "precisa carimbar quando foi concluída");

  const desmarcar = fakeRes();
  await handler(fakeReq({ action: "nota-concluir", id, feita: false }), desmarcar);
  const pendenteDeNovo = desmarcar.payload.notas.find(n => n.id === id);
  assert.equal(pendenteDeNovo.feita, false);
  assert.equal(pendenteDeNovo.concluidaEm, null, "desmarcar precisa limpar o carimbo de conclusão");
});

// ── 4. Remover apaga de vez ──────────────────────────────────────────────────────────────────────
await comServidor(async () => {
  const add = fakeRes();
  await handler(fakeReq({ action: "nota-adicionar", texto: "Descartável" }), add);
  const id = add.payload.notas[0].id;
  const remover = fakeRes();
  await handler(fakeReq({ action: "nota-remover", id }), remover);
  assert.equal(remover.statusCode, 200);
  assert.deepEqual(remover.payload.notas, []);
});

// ── 5. Teto de 200 notas ────────────────────────────────────────────────────────────────────────
await comServidor(async ({ tabela }) => {
  const itens = Array.from({ length: 200 }, (_, i) => ({ id: `n${i}`, texto: `Nota ${i}`, feita: false, criadoEm: new Date().toISOString(), concluidaEm: null }));
  tabela.set(`notas-rapidas::${EMPRESA_PRINCIPAL}`, { itens });
  const res = fakeRes();
  await handler(fakeReq({ action: "nota-adicionar", texto: "Nota 201" }), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /200/, "a mensagem precisa avisar o limite");
});

// ── 6. GET devolve as notas junto do resto (mesma leitura que a tela já faz ao abrir) ──────────
await comServidor(async ({ tabela }) => {
  tabela.set(`notas-rapidas::${EMPRESA_PRINCIPAL}`, { itens: [{ id: "x", texto: "Já existia", feita: false, criadoEm: new Date().toISOString(), concluidaEm: null }] });
  const res = fakeRes();
  await handler(fakeReqGet(), res);
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.payload.notas), "a resposta padrão da tela precisa trazer as notas");
  assert.equal(res.payload.notas[0].texto, "Já existia");
});

// ── 7. Isolamento: a chave das notas nunca é a mesma do Cérebro Comercial ───────────────────────
await comServidor(async ({ chamadas }) => {
  const add = fakeRes();
  await handler(fakeReq({ action: "nota-adicionar", texto: "Teste de isolamento" }), add);
  const chavesGravadas = new Set(chamadas.posts.map(p => p.chave));
  assert.ok(chavesGravadas.has("notas-rapidas"), "a nota precisa gravar na chave notas-rapidas");
  assert.ok(!chavesGravadas.has("direciona-cerebro"), "adicionar nota NUNCA pode escrever na chave do Cérebro");
});

// ── 8. O texto sempre passa por sanitizeNota (nunca cru do banco) ──────────────────────────────
await comServidor(async ({ tabela }) => {
  tabela.set(`notas-rapidas::${EMPRESA_PRINCIPAL}`, { itens: [{ id: "y", texto: "  espaços nas pontas  ", feita: "sim", criadoEm: 123, extra: "campo desconhecido" }] });
  const res = fakeRes();
  await handler(fakeReqGet(), res);
  const nota = res.payload.notas[0];
  assert.equal(nota.texto, "espaços nas pontas", "precisa aparar espaço nas pontas");
  assert.equal(nota.feita, false, "\"sim\" não é boolean — precisa virar false, nunca dado sujo do banco");
  assert.equal(Object.keys(nota).sort().join(","), "concluidaEm,criadoEm,feita,id,texto", "campo desconhecido do banco não pode vazar pra tela");
});

console.log("v1170-bloco-de-notas (servidor): ok");

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Front-end (app.js) — funções puras extraídas de verdade, com um DOM/fetch mínimo de mentira.
// ══════════════════════════════════════════════════════════════════════════════════════════════
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function extrairFn(nome, assinatura) {
  const alvo = `function ${nome}(${assinatura ?? ""}`;
  let ini = app.indexOf(alvo);
  assert.ok(ini >= 0, `${nome} não encontrada em app.js`);
  // "async function nome(...)" — sem isto, o "async" ficava de fora e o "await" lá dentro
  // virava erro de sintaxe (a função extraída deixava de ser assíncrona).
  if (app.slice(Math.max(0, ini - 6), ini) === "async ") ini -= 6;
  let i = app.indexOf("{", ini), prof = 0;
  for (; i < app.length; i++) {
    if (app[i] === "{") prof++;
    else if (app[i] === "}") { prof--; if (!prof) break; }
  }
  return app.slice(ini, i + 1);
}

// ── 9. v1171 — o bloco virou um card na fileira de números (não mais a faixa acima da busca) ────
{
  assert.doesNotMatch(app, /cp1170BlocoHTML/, "a função antiga (bloco fixo no topo) foi substituída pelo painel — não pode sobrar referência a ela");
  assert.match(app, /id="kpiNotas"[^>]*onclick="cp1170AbrirPainel\(\)"/,
    'precisa existir um card "Bloco de notas" na fileira de números que abre o painel flutuante ao tocar');
  const posKpiNotas = app.indexOf('id="kpiNotas"');
  const posArquivados = app.indexOf("show('arquivados')");
  assert.ok(posKpiNotas > 0 && posArquivados > 0 && posArquivados < posKpiNotas,
    "o card de notas fica na mesma fileira dos outros números, depois de Arquivados");
  assert.match(app, /if\(typeof cp1170Carregar === 'function'\) cp1170Carregar\(\);/,
    "a Home precisa disparar o carregamento das notas sozinha (sem esperar o corretor abrir o painel) pra a contagem já vir pronta");
}

// ── 10-14. Funções puras, num sandbox mínimo ────────────────────────────────────────────────────
{
  const chamadasFetch = [];
  const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toasts = [];
  const inputFake = { value: "", disabled: false, focus() {} };
  const qs = (sel) => sel === "#cp1170Input" ? inputFake : null;
  const fetchComTimeout = async (url, opts) => {
    chamadasFetch.push({ url, body: opts?.body ? JSON.parse(opts.body) : null });
    const acao = opts?.body ? JSON.parse(opts.body).action : null;
    if (acao === "nota-adicionar") return { ok: true, json: async () => ({ ok: true, notas: [{ id: "novo", texto: "x", feita: false, criadoEm: "now", concluidaEm: null }] }) };
    if (acao === "nota-concluir") return { ok: true, json: async () => ({ ok: true, notas: [] }) };
    if (acao === "nota-remover") return { ok: true, json: async () => ({ ok: true, notas: [] }) };
    return { ok: true, json: async () => ({ ok: true, notas: [] }) };
  };
  const toast = (msg) => toasts.push(msg);

  const corpo = [
    extrairFn("cp1170PendCount"),
    extrairFn("cp1170ItemHTML"),
    extrairFn("cp1170PainelConteudoHTML"),
    extrairFn("cp1170Adicionar"),
    extrairFn("cp1170Concluir"),
    extrairFn("cp1170Remover")
  ].join("\n");

  const sandbox = new Function("escapeHtml", "qs", "fetchComTimeout", "toast", `
    let _cp1170Notas = null;
    let _rerenders = 0;
    function cp1170Rerender(){ _rerenders++; }
    ${corpo}
    return {
      estado: () => ({ notas: _cp1170Notas, rerenders: _rerenders }),
      set: (n) => { _cp1170Notas = n; },
      cp1170PendCount, cp1170ItemHTML, cp1170PainelConteudoHTML, cp1170Adicionar, cp1170Concluir, cp1170Remover
    };
  `)(escapeHtml, qs, fetchComTimeout, toast);

  // 10. Contagem só considera pendente — a feita não entra no selo do card.
  sandbox.set([{ id: "1", texto: "Pendente", feita: false }, { id: "2", texto: "Feita", feita: true }]);
  assert.equal(sandbox.cp1170PendCount(), 1, "só a nota PENDENTE conta — a feita não");

  // 11. Painel ainda não carregou: mostra "Carregando…", não "Nada anotado ainda." (evita o
  //     corretor achar que está tudo em dia quando na verdade a lista nem chegou do servidor).
  sandbox.set(null);
  let html = sandbox.cp1170PainelConteudoHTML();
  assert.match(html, />📝 Bloco de notas</);
  assert.match(html, /Carregando…/);
  assert.match(html, /id="cp1170Input"/, "a caixa de adicionar sempre aparece dentro do painel");

  // 12. Lista vazia (carregou e não tem nada) x com notas — e escapa HTML do texto (segurança:
  //     texto veio do próprio corretor, mas precisa ser tratado como qualquer entrada de usuário).
  sandbox.set([]);
  html = sandbox.cp1170PainelConteudoHTML();
  assert.match(html, /Nada anotado ainda\./);

  sandbox.set([{ id: "3", texto: '<img src=x onerror=alert(1)>', feita: false }]);
  html = sandbox.cp1170PainelConteudoHTML();
  assert.doesNotMatch(html, /<img src=x/, "texto da nota precisa ser escapado, nunca virar HTML de verdade");
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);

  // 13. Adicionar chama a ação certa e absorve a lista que o servidor devolveu.
  inputFake.value = "  Conferir contrato assinado  ";
  await sandbox.cp1170Adicionar();
  const chamadaAdd = chamadasFetch.find(c => c.body?.action === "nota-adicionar");
  assert.ok(chamadaAdd, "precisa chamar a ação nota-adicionar");
  assert.equal(chamadaAdd.body.texto, "Conferir contrato assinado", "manda o texto já sem espaço nas pontas");
  assert.equal(sandbox.estado().notas[0].id, "novo", "absorve a lista que o servidor devolveu");

  // 14. Concluir/Remover mandam id e ação certos.
  await sandbox.cp1170Concluir("abc", true);
  const chamadaConcluir = chamadasFetch.find(c => c.body?.action === "nota-concluir");
  assert.deepEqual(chamadaConcluir.body, { action: "nota-concluir", id: "abc", feita: true });

  await sandbox.cp1170Remover("abc");
  const chamadaRemover = chamadasFetch.find(c => c.body?.action === "nota-remover");
  assert.deepEqual(chamadaRemover.body, { action: "nota-remover", id: "abc" });
}

console.log("v1170-bloco-de-notas (front-end): ok");
