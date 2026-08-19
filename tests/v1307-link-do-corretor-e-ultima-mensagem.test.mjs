import fs from "node:fs";
import assert from "node:assert/strict";
import {
  linkPodeSerLido, linksDoCorretorNaConversa, textoVisivelDaPagina, lerLinksDaConversa,
  finalizarAnaliseDaConversa
} from "../api/_pipeline.js";

// v1307 — DUAS COISAS PEDIDAS PELO DONO EM 19/08/2026.
//
// 1) "e um link enviado, como fica?" — ficava como texto puro. No print dele o link levava a uma
//    seleção de 8 apartamentos com fotos, plantas e VALORES; a IA via o endereço e nunca abria a
//    página. Mesmo buraco da imagem antes da v1306.
// 2) "quero que coloque aqui — última mensagem (minha ou do cliente, tanto faz)", com o lugar
//    marcado no print: embaixo de "Última análise" e "Último atendimento", no cartão do cliente.

// ── 1. Que endereço o servidor pode abrir ────────────────────────────────────────────────────
{
  assert.ok(linkPodeSerLido("https://exemplo.com.br/material/boulevard"), "https público pode");
  for (const proibido of [
    "http://exemplo.com.br/material",           // sem https
    "https://localhost/admin",
    "https://127.0.0.1/",
    "https://192.168.0.10/painel",
    "https://servidor.local/",
    "https://intranet/",
    "não é link"
  ]) {
    assert.ok(!linkPodeSerLido(proibido), `não pode abrir: ${proibido}`);
  }
}

// ── 2. Só link do CORRETOR, e só os mais recentes ────────────────────────────────────────────
{
  const timeline = [
    { author: "Construtora Senger", text: "Segue o material https://exemplo.com.br/a" },
    { author: "Leonardo Cliente", text: "vi num site https://site-do-cliente.com/x" },
    { author: "Construtora Senger", text: "e este também https://exemplo.com.br/b" },
    { author: "Construtora Senger", text: "o mais novo https://exemplo.com.br/c" }
  ];
  const links = linksDoCorretorNaConversa(timeline, "Construtora Senger", { clientName: "Leonardo Cliente" });
  assert.deepEqual(links, ["https://exemplo.com.br/c", "https://exemplo.com.br/b"],
    "abre os 2 mais recentes do corretor, do mais novo pro mais antigo");
  assert.ok(!links.includes("https://site-do-cliente.com/x"),
    "link mandado pelo CLIENTE nunca é aberto pelo servidor");
}

// ── 3. Texto visível da página ───────────────────────────────────────────────────────────────
{
  const html = `<html><head><style>.x{color:red}</style><script>var v=1</script></head>
    <body><nav>Menu</nav><h1>Boulevard Residence</h1><p>Apto 501 &mdash; R$ 1.200.000</p></body></html>`;
  const texto = textoVisivelDaPagina(html);
  assert.match(texto, /Boulevard Residence/);
  assert.match(texto, /R\$ 1\.200\.000/);
  assert.doesNotMatch(texto, /var v=1/, "script não entra");
  assert.doesNotMatch(texto, /color:red/, "estilo não entra");
}

// ── 4. Leitura de verdade, com página de mentira ─────────────────────────────────────────────
{
  const paginaCheia = "<html><body>" + "<p>Boulevard Residence — Apto 501 — R$ 1.200.000 — 3 suítes — 145 m²</p>".repeat(6) + "</body></html>";
  const fetchOk = async () => ({ ok: true, status: 200, headers: { get: () => "text/html; charset=utf-8" }, text: async () => paginaCheia });
  const openaiMock = { chat: { completions: { create: async (args) => {
    const pedido = args.messages[0].content;
    assert.match(pedido, /não invente/i, "o pedido de leitura precisa proibir invenção");
    assert.match(pedido, /Boulevard Residence/, "o texto da página precisa chegar na leitura");
    return { model: "mock", choices: [{ message: { content: "Seleção de imóveis. Boulevard Residence — Apto 501 — R$ 1.200.000 — 3 suítes — 145 m²." } }] };
  } } } };

  const { leituras } = await lerLinksDaConversa(["https://exemplo.com.br/boulevard"], "org-teste", { openai: openaiMock, fetchImpl: fetchOk });
  assert.equal(leituras["https://exemplo.com.br/boulevard"].status, "lido");
  assert.match(leituras["https://exemplo.com.br/boulevard"].text, /R\$ 1\.200\.000/);
}

// ── 5. Página que monta tudo por JavaScript: NÃO inventa nada ─────────────────────────────────
// É o risco que o dono precisa enxergar: se a página vier vazia, o app diz que não deu pra ler.
{
  const cascaVazia = "<html><head><title>Material</title></head><body><div id='app'></div><script>montar()</script></body></html>";
  const fetchVazio = async () => ({ ok: true, status: 200, headers: { get: () => "text/html" }, text: async () => cascaVazia });
  const { leituras } = await lerLinksDaConversa(["https://exemplo.com.br/vazio"], "org-teste", { openai: null, fetchImpl: fetchVazio });
  assert.equal(leituras["https://exemplo.com.br/vazio"].status, "pagina_sem_texto_legivel");
  assert.equal(leituras["https://exemplo.com.br/vazio"].text, "", "sem texto na página, nada é inventado");

  const fetch404 = async () => ({ ok: false, status: 404, headers: { get: () => "text/html" }, text: async () => "" });
  const r404 = await lerLinksDaConversa(["https://exemplo.com.br/sumiu"], "org-teste", { openai: null, fetchImpl: fetch404 });
  assert.equal(r404.leituras["https://exemplo.com.br/sumiu"].status, "pagina_respondeu_404");

  const fetchQuebrado = async () => { throw new Error("rede caiu"); };
  const rErro = await lerLinksDaConversa(["https://exemplo.com.br/erro"], "org-teste", { openai: null, fetchImpl: fetchQuebrado });
  assert.equal(rErro.leituras["https://exemplo.com.br/erro"].status, "erro_leitura", "erro vira status, não exceção");
}

// ── 6. O que foi lido entra na conversa, na mensagem do link ─────────────────────────────────
{
  const messages = [
    { id: 1, date: "18/08/2026", time: "21:37", author: "Construtora Senger", text: "Seleção de imóveis\nhttps://exemplo.com.br/boulevard", order: 1, iso: "2026-08-19T00:37:00.000Z" },
    { id: 2, date: "18/08/2026", time: "21:40", author: "Leonardo Cliente", text: "Olá! Posso ter mais informações sobre isso?", order: 2, iso: "2026-08-19T00:40:00.000Z" }
  ];
  const resultado = await finalizarAnaliseDaConversa({
    txtFile: "_chat.txt", messages,
    audioFilesRelevantes: [], audioFilesForaDaJanela: [], transcriptionMap: {},
    leiturasLinks: { "https://exemplo.com.br/boulevard": { status: "lido", text: "Boulevard Residence — Apto 501 — R$ 1.200.000\n3 suítes, 145 m²." } },
    existingTimeline: [], previousAnalysis: null, existingLeadId: null
  });
  const linha = resultado.timeline.find(m => m.linkLido);
  assert.ok(linha, "a mensagem que tinha o link precisa carregar a leitura");
  assert.match(linha.text, /\[Link lido pela IA\]/);
  assert.match(linha.text, /R\$ 1\.200\.000/, "o valor que estava atrás do link entra na conversa");
  assert.match(linha.text, /Seleção de imóveis/, "e o texto original da mensagem continua lá");
  assert.equal(resultado.linksLidos, 1, "o resultado conta quantos links viraram texto");
}

// ── 7. As pontas ligadas, e a linha nova no cartão do cliente ────────────────────────────────
{
  const rota = fs.readFileSync(new URL("../api/processar-storage.js", import.meta.url), "utf8");
  assert.ok(rota.includes("lerLinksDaConversa"), "a importação precisa abrir os links");
  assert.ok(rota.includes("leiturasLinks: body?.leiturasLinks"), "e a análise precisa recebê-los de volta");
  const imp = fs.readFileSync(new URL("../js/importacao.js", import.meta.url), "utf8");
  assert.ok(imp.includes("leiturasLinks:prep.leiturasLinks"), "o app repassa as leituras de link");
  assert.ok(imp.includes("links lidos:"), "e mostra quantos foram lidos no resultado da importação");

  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.ok(app.includes("Última mensagem — ${ultimaMsgConversaEm}"),
    "o cartão do cliente precisa mostrar a data da última mensagem da conversa");
  assert.ok(app.includes("const mostrarLinhaMensagem=!!(ultimoAtTs && ultimaMsgConversaEm)"),
    "sem atendimento registrado a linha de cima já é a da mensagem — não pode repetir");
}

console.log("v1307-link-do-corretor-e-ultima-mensagem: ok");
