import http from "node:http";
import fs from "node:fs";
import assert from "node:assert/strict";

// v1199 — pedido do dono: "crie no menu Planos onde apresenta e explica os valores e
// usabilidades de cada plano". Reaproveita a MESMA leitura que a tela do Cérebro já faz
// (api/cerebro-config, GET) — sem rota nova (o projeto está perto do teto de 12 da Vercel).
// obterPlanoAtual é só leitura (organizations.status / plano-contratado): nunca reserva nem
// gasta uma análise só de a tela ser aberta — diferente de verificarLimiteAnalises, que é
// usado na hora de analisar de verdade.

const appSrc = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const indexSrc = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

// 0. A tela existe: item no menu lateral, seção própria, e está ligada ao roteamento.
{
  assert.match(indexSrc, /data-target="planos" data-nav-key="planos"/, 'precisa existir o item "Planos" no menu lateral');
  assert.match(indexSrc, /<section id="planos" class="screen">/, 'precisa existir a seção da tela Planos');
  assert.match(appSrc, /else if\(t === "planos"\) await carregarPlanos\(\);/, 'a troca de tela precisa carregar os planos');
  assert.match(appSrc, /const escondidas = \[.*"planos"\]/, 'no desktop, "planos" precisa entrar na lista de telas que se escondem ao trocar');

  // Guarda contra a MESMA armadilha da v1077→v1078 (registrada no CLAUDE.md): no desktop
  // (@media min-width:900px), styles.css tem uma lista fechada de #id.screen que decide quem
  // aparece — uma tela nova ausente dessa lista fica visível O TEMPO TODO, por baixo de
  // qualquer outra (achado nesta própria rodada, corrigido antes de publicar).
  const stylesSrc = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(stylesSrc, /#carteira\.screen,#planos\.screen\{display:none\}|#carteira\.screen,#planos\.screen \{display:none\}|#planos\.screen\{display:none\}/,
    '"#planos" precisa estar na lista fechada de telas escondidas por padrão no desktop (styles.css)');
  assert.match(stylesSrc, /#carteira\.screen\.active,#planos\.screen\.active\{display:block\}|#planos\.screen\.active\{display:block\}/,
    '"#planos.active" precisa estar na lista fechada de telas visíveis quando ativas no desktop (styles.css)');
}

// 1. obterPlanoAtual é só leitura — nunca chama a função que reserva/gasta análise.
{
  const pipeline = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  const ini = pipeline.indexOf("export async function obterPlanoAtual(organizationId) {");
  assert.ok(ini > -1, "obterPlanoAtual precisa existir");
  const fn = pipeline.slice(ini, pipeline.indexOf("\n}", ini) + 2);
  assert.ok(!/reservarAnaliseViaRPC|reservar_analise_ia/.test(fn), "obterPlanoAtual não pode reservar/gastar análise só de mostrar o plano");
}

// 2. api/cerebro-config.js devolve planoAtual + catalogoPlanos na mesma leitura de sempre.
{
  const cerebroConfig = fs.readFileSync(new URL("../api/cerebro-config.js", import.meta.url), "utf8");
  assert.match(cerebroConfig, /planoAtual, catalogoPlanos \}\);/, 'a leitura (GET) precisa devolver planoAtual e catalogoPlanos junto do resto');
}

// 3. Handler de verdade: conta principal, conta em teste e conta com plano contratado — os três
// cenários mostram a coisa certa, sem nenhum gasto de análise.
{
  const registros = [];
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/rest/v1/organizations" && req.method === "GET") {
      res.statusCode = 200;
      res.end(JSON.stringify(global.__orgStatusFake ?? null));
      return;
    }
    if (url.pathname === "/rest/v1/direciona_config" && req.method === "GET") {
      registros.push({ method: req.method, search: url.search });
      const chave = url.search.includes("plano-contratado") ? { valor: global.__planoContratadoFake ?? null } : { valor: { itens: [] } };
      res.statusCode = 200;
      res.end(JSON.stringify(chave));
      return;
    }
    res.statusCode = 200;
    res.end(JSON.stringify({}));
  });

  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    process.env.NODE_ENV = "test";
    process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake";
    const { obterPlanoAtual, EMPRESA_PRINCIPAL_ID } = await (async () => {
      const pipeline = await import(`../api/_pipeline.js?v1199planos=${Date.now()}`);
      const persistence = await import("../api/_persistence.js");
      return { obterPlanoAtual: pipeline.obterPlanoAtual, EMPRESA_PRINCIPAL_ID: persistence.EMPRESA_PRINCIPAL_ID };
    })();

    // conta principal
    let r = await obterPlanoAtual(EMPRESA_PRINCIPAL_ID);
    assert.deepEqual(r, { principal: true, emTeste: false, plano: null }, "conta principal precisa vir marcada, sem plano");

    // conta em teste
    global.__orgStatusFake = { status: "teste" };
    r = await obterPlanoAtual("outra-conta");
    assert.equal(r.emTeste, true, "conta em teste precisa vir marcada como emTeste");
    assert.equal(r.plano, null, "conta em teste não tem plano comercial ainda");

    // conta com Pro Master contratado
    global.__orgStatusFake = { status: "ativo" };
    global.__planoContratadoFake = { tipo: "pro-master" };
    r = await obterPlanoAtual("outra-conta");
    assert.equal(r.principal, false);
    assert.equal(r.emTeste, false);
    assert.equal(r.plano?.tipo, "pro-master", "precisa reconhecer o plano contratado de verdade");
    assert.equal(r.plano?.dia, 30);
    assert.equal(r.plano?.mes, 300);

    console.log("v1199-tela-planos: ok");
  } finally {
    await new Promise(resolve => server.close(resolve));
    delete global.__orgStatusFake;
    delete global.__planoContratadoFake;
  }
}
