import fs from "node:fs";
import assert from "node:assert/strict";
import {
  linkPodeSerLido, ipEhPrivadoOuReservado, hostApontaPraRedePrivada,
  baixarPaginaComSeguranca, lerLinksDaConversa
} from "../api/_pipeline.js";

// v1322 — A LEITURA DE LINK DEIXA DE PODER SER USADA COMO PONTE PRA REDE INTERNA.
//
// A auditoria de 20/08/2026 mostrou três caminhos abertos na leitura criada na v1307:
//   1) o site respondia "vá para outro endereço" e esse destino não era conferido;
//   2) um domínio comum podia APONTAR pra um endereço interno (o código só olhava o nome escrito);
//   3) o teto de 700 KB só era aplicado depois de baixar a página inteira, e o relógio parava antes
//      de o corpo terminar de chegar.
// Este teste tranca os três.

const dnsPublico = async () => [{ address: "93.184.216.34", family: 4 }];
const dnsInterno = async () => [{ address: "169.254.169.254", family: 4 }];

// ── 1. Endereço numérico interno é sempre recusado ───────────────────────────────────────────
{
  for (const interno of [
    "127.0.0.1", "10.1.2.3", "172.16.0.9", "172.31.255.254", "192.168.0.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1"
  ]) {
    assert.ok(ipEhPrivadoOuReservado(interno), `precisa recusar ${interno}`);
  }
  for (const publico of ["93.184.216.34", "8.8.8.8", "200.147.67.142", "2606:4700::1111"]) {
    assert.ok(!ipEhPrivadoOuReservado(publico), `endereço público pode: ${publico}`);
  }
}

// ── 2. O nome escrito também não pode trazer porta estranha nem senha embutida ────────────────
{
  assert.ok(linkPodeSerLido("https://exemplo.com.br/material"), "https público continua podendo");
  assert.ok(linkPodeSerLido("https://exemplo.com.br:443/material"), "porta padrão continua podendo");
  for (const proibido of [
    "https://exemplo.com.br:22/",          // porta de serviço interno
    "https://exemplo.com.br:8080/painel",
    "https://usuario:senha@exemplo.com.br/",
    "https://api.localhost/",
    "https://servidor.home.arpa/"
  ]) {
    assert.ok(!linkPodeSerLido(proibido), `não pode abrir: ${proibido}`);
  }
}

// ── 3. Domínio comum que APONTA pra endereço interno não é aberto ────────────────────────────
{
  assert.equal(await hostApontaPraRedePrivada("qualquer.com.br", dnsInterno), true);
  assert.equal(await hostApontaPraRedePrivada("qualquer.com.br", dnsPublico), false);
  assert.equal(await hostApontaPraRedePrivada("qualquer.com.br", async () => { throw new Error("nxdomain"); }), true,
    "nome que não resolve é tratado como perigoso — não abre");

  let chamouFetch = false;
  const fetchEspiao = async () => { chamouFetch = true; return { ok: true, status: 200, headers: { get: () => "text/html" }, text: async () => "" }; };
  const r = await baixarPaginaComSeguranca("https://parece-normal.com.br/x", { fetchImpl: fetchEspiao, lookupImpl: dnsInterno });
  assert.equal(r.status, "endereco_bloqueado");
  assert.equal(chamouFetch, false, "nem chega a bater na porta do endereço interno");
}

// ── 4. Redirecionamento é conferido a cada parada ────────────────────────────────────────────
{
  const visitados = [];
  const fetchDesvio = async (url) => {
    visitados.push(url);
    if (visitados.length === 1) {
      return { ok: false, status: 302, headers: { get: (h) => (String(h).toLowerCase() === "location" ? "https://interno.exemplo.com.br/segredo" : "") } };
    }
    return { ok: true, status: 200, headers: { get: () => "text/html" }, text: async () => "<p>nunca deveria chegar aqui</p>" };
  };
  const lookupPorHost = async (host) => (host === "interno.exemplo.com.br" ? [{ address: "10.0.0.7" }] : [{ address: "93.184.216.34" }]);
  const r = await baixarPaginaComSeguranca("https://exemplo.com.br/material", { fetchImpl: fetchDesvio, lookupImpl: lookupPorHost });
  assert.equal(r.status, "endereco_bloqueado", "o destino do desvio é conferido de novo");
  assert.equal(visitados.length, 1, "o servidor não busca o endereço interno para onde foi desviado");

  // Desvio para outro endereço público continua funcionando normalmente.
  const fetchDesvioBom = async (url) => {
    if (url.endsWith("/material")) return { ok: false, status: 301, headers: { get: (h) => (String(h).toLowerCase() === "location" ? "/material/final" : "") } };
    return { ok: true, status: 200, headers: { get: () => "text/html" }, text: async () => "<p>Boulevard Residence — Apto 501 — R$ 1.200.000</p>" };
  };
  const bom = await baixarPaginaComSeguranca("https://exemplo.com.br/material", { fetchImpl: fetchDesvioBom, lookupImpl: dnsPublico });
  assert.equal(bom.status, "ok");
  assert.match(bom.html, /Boulevard Residence/);

  // Corrente infinita de desvios para em algum lugar.
  const fetchLoop = async () => ({ ok: false, status: 302, headers: { get: (h) => (String(h).toLowerCase() === "location" ? "https://exemplo.com.br/roda" : "") } });
  const loop = await baixarPaginaComSeguranca("https://exemplo.com.br/roda", { fetchImpl: fetchLoop, lookupImpl: dnsPublico });
  assert.equal(loop.status, "redirecionou_demais");
}

// ── 5. Página gigante não é baixada inteira ──────────────────────────────────────────────────
{
  const anunciaGigante = async () => ({
    ok: true, status: 200,
    headers: { get: (h) => (String(h).toLowerCase() === "content-length" ? String(50 * 1024 * 1024) : "text/html") },
    text: async () => { throw new Error("não pode nem tentar ler"); }
  });
  const grande = await baixarPaginaComSeguranca("https://exemplo.com.br/pesado", { fetchImpl: anunciaGigante, lookupImpl: dnsPublico });
  assert.equal(grande.status, "pagina_grande_demais");

  // Sem anunciar tamanho: o corte acontece durante o download, pedaço a pedaço.
  const pedaco = new TextEncoder().encode("<p>" + "a".repeat(100 * 1024) + "</p>");
  let entregues = 0;
  const corpoInfinito = {
    getReader: () => ({
      read: async () => { entregues += 1; return { done: false, value: pedaco }; },
      cancel: async () => {}
    })
  };
  const fetchInfinito = async () => ({ ok: true, status: 200, headers: { get: () => "text/html" }, body: corpoInfinito, text: async () => { throw new Error("deveria ler em pedaços"); } });
  const cortada = await baixarPaginaComSeguranca("https://exemplo.com.br/infinita", { fetchImpl: fetchInfinito, lookupImpl: dnsPublico });
  assert.equal(cortada.status, "ok");
  assert.ok(cortada.html.length <= 700 * 1024, "o texto guardado para no teto");
  assert.ok(entregues <= 10, `parou de baixar depois do teto (pedaços lidos: ${entregues})`);
}

// ── 6. A leitura de verdade usa esse caminho — e link bloqueado vira status, não análise perdida ─
{
  const fetchNunca = async () => { throw new Error("não pode buscar"); };
  const { leituras } = await lerLinksDaConversa(["https://parece-normal.com.br/x"], "org-teste",
    { openai: null, fetchImpl: fetchNunca, lookupImpl: dnsInterno });
  assert.equal(leituras["https://parece-normal.com.br/x"].status, "endereco_bloqueado");
  assert.equal(leituras["https://parece-normal.com.br/x"].text, "");
}

// ── 7. O caminho antigo não pode voltar ──────────────────────────────────────────────────────
{
  const fonte = fs.readFileSync(new URL("../api/_pipeline.js", import.meta.url), "utf8");
  const codigo = fonte.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
  assert.ok(!/redirect:\s*"follow"/.test(codigo), 'nenhuma busca de link pode voltar a usar redirect: "follow"');
  assert.ok(fonte.includes("baixarPaginaComSeguranca"), "a leitura de link passa pela porta única");
}

console.log("v1322-leitura-de-link-blindada: ok");
