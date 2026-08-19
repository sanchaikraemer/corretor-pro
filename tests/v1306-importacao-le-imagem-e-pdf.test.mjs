import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import {
  prepararConversaDoZip, montarPlanoVisuais, lerArquivosVisuais, finalizarAnaliseDaConversa,
  arquivoVisualLegivel, tipoDoArquivoVisual, encontrarArquivoCitado, maxVisuaisPorImportacao
} from "../api/_pipeline.js";

// v1306 — A IMPORTAÇÃO PASSA A LER IMAGEM E PDF (vídeo não, por decisão do dono).
//
// Até aqui o ZIP entrava só com texto e áudio. Imagem, vídeo e documento iam para uma lista de
// "ignorados" e a conversa que chegava na IA trazia só "[Arquivo enviado nesta mensagem: imagem —
// conteúdo não analisado pela IA]".
//
// O preço disso apareceu em 19/08/2026: numa conversa em que o corretor mandou a ARTE do anúncio
// com o preço atual, a IA não viu a arte e respondeu com o único número que enxergava — um preço
// de dez meses antes, em texto. O ChatGPT, com a mesma conversa exportada (com as imagens),
// acertou o preço de hoje.

// ── 1. Quem é legível e quem não é ────────────────────────────────────────────────────────────
{
  for (const bom of ["IMG-20251030-WA0001.jpg", "foto.jpeg", "arte.PNG", "banner.webp", "FOLDER EVOLUTTI (2).pdf"]) {
    assert.ok(arquivoVisualLegivel(bom), `${bom} precisa ser lido`);
  }
  for (const nao of ["VID-20251030-WA0002.mp4", "audio.opus", "conversa.txt", "planilha.xlsx", "foto.heic"]) {
    assert.ok(!arquivoVisualLegivel(nao), `${nao} NÃO pode entrar na leitura (vídeo é decisão do dono)`);
  }
  assert.equal(tipoDoArquivoVisual("folder.pdf"), "documento");
  assert.equal(tipoDoArquivoVisual("arte.jpg"), "imagem");
  assert.equal(encontrarArquivoCitado("IMG-20251030-WA0001.jpg (arquivo anexado)", ["IMG-20251030-WA0001.jpg"]), "IMG-20251030-WA0001.jpg");
  assert.equal(encontrarArquivoCitado("bom dia", ["IMG-20251030-WA0001.jpg"]), null);
}

// ── 2. Só o que a conversa cita, e só os mais recentes ────────────────────────────────────────
{
  const messages = [
    { text: "IMG-01.jpg (arquivo anexado)" },
    { text: "oi" },
    { text: "IMG-02.jpg (arquivo anexado)" },
    { text: "FOLDER.pdf (arquivo anexado)" }
  ];
  const arquivos = ["IMG-01.jpg", "IMG-02.jpg", "FOLDER.pdf", "IMG-99.jpg"];
  const plano = montarPlanoVisuais(messages, arquivos, 2);
  assert.deepEqual(plano.citados, ["IMG-01.jpg", "IMG-02.jpg", "FOLDER.pdf"], "arquivo que ninguém citou não entra");
  assert.deepEqual(plano.paraLer, ["IMG-02.jpg", "FOLDER.pdf"], "com teto 2, ficam os DOIS MAIS RECENTES");
  assert.deepEqual(montarPlanoVisuais(messages, arquivos, 0).paraLer, [], "teto zero desliga a leitura");
  assert.ok(maxVisuaisPorImportacao() > 0, "existe um teto por importação");
}

// ── 3. A leitura em si: imagem vai como imagem, PDF vai como arquivo ──────────────────────────
{
  const pedidos = [];
  const openaiMock = { chat: { completions: { create: async (args) => {
    pedidos.push(args);
    const partes = args.messages[0].content;
    const ehPdf = partes.some(p => p.type === "file");
    return { model: "mock-visao", choices: [{ message: { content: ehPdf
      ? "Folder do empreendimento. 2 dormitórios com 1 suíte a partir de R$ 640.000. Entrada 30% e saldo em até 30x."
      : "Anúncio. De R$ 390.000 por R$ 350.000. Apto novo, 2 dormitórios, semimobiliado, 1 box de garagem, piscina e academia." } }] };
  } } } };

  const { leituras, leituraHabilitada } = await lerArquivosVisuais([
    { name: "ARTE.jpg", buffer: Buffer.from("imagem-de-mentira") },
    { name: "FOLDER.pdf", buffer: Buffer.from("pdf-de-mentira") }
  ], "org-teste", { openai: openaiMock });

  assert.equal(leituraHabilitada, true);
  assert.equal(leituras["ARTE.jpg"].status, "lido");
  assert.match(leituras["ARTE.jpg"].text, /R\$ 350\.000/, "o preço da arte precisa sair como texto");
  assert.match(leituras["FOLDER.pdf"].text, /640\.000/, "o PDF também é lido");

  const pedidoImagem = pedidos.find(p => p.messages[0].content.some(c => c.type === "image_url"));
  const pedidoPdf = pedidos.find(p => p.messages[0].content.some(c => c.type === "file"));
  assert.ok(pedidoImagem, "imagem vai pelo canal de imagem");
  assert.ok(pedidoPdf?.messages[0].content.find(c => c.type === "file")?.file?.file_data?.startsWith("data:application/pdf;base64,"),
    "PDF vai como arquivo PDF de verdade, não como imagem");
  for (const p of pedidos) {
    assert.equal(p.temperature, undefined, "nenhuma chamada de IA fixa temperatura (regra do projeto desde a v855)");
    const instrucao = p.messages[0].content.find(c => c.type === "text").text;
    assert.match(instrucao, /não invente/i, "o pedido de leitura tem que proibir invenção, como todo o resto do app");
  }
}

// ── 4. Imagem sem nada comercial não polui a conversa ─────────────────────────────────────────
{
  const openaiMock = { chat: { completions: { create: async () => ({ model: "m", choices: [{ message: { content: "SEM CONTEUDO COMERCIAL" } }] }) } } };
  const { leituras } = await lerArquivosVisuais([{ name: "selfie.jpg", buffer: Buffer.from("x") }], "org-teste", { openai: openaiMock });
  assert.equal(leituras["selfie.jpg"].status, "sem_conteudo_comercial");
  assert.equal(leituras["selfie.jpg"].text, "", "figurinha/selfie não vira linha na conversa");
}

// ── 5. Erro e falta de tempo não quebram a importação ─────────────────────────────────────────
{
  const openaiMock = { chat: { completions: { create: async () => { throw new Error("falhou"); } } } };
  const { leituras } = await lerArquivosVisuais([{ name: "a.jpg", buffer: Buffer.from("x") }], "org-teste", { openai: openaiMock });
  assert.equal(leituras["a.jpg"].status, "erro_leitura", "erro vira status, não exceção");

  const semTempo = await lerArquivosVisuais([{ name: "b.jpg", buffer: Buffer.from("x") }], "org-teste",
    { openai: openaiMock, deadlineTs: Date.now() - 1 });
  assert.equal(semTempo.leituras["b.jpg"].status, "sem_tempo_nesta_importacao", "sem tempo, a leitura é pulada e a importação segue");
}

// ── 6. ZIP de verdade: imagem e PDF saem da lista de ignorados e entram para leitura ──────────
{
  const zip = new JSZip();
  zip.file("_chat.txt", [
    "[22/07/2025 08:49] Construtora: temos no Quality a partir de R$ 390.000",
    "[30/10/2025 15:01] Construtora: ARTE-PROMO.jpg (arquivo anexado)",
    "[30/10/2025 15:02] Construtora: FOLDER.pdf (arquivo anexado)",
    "[30/10/2025 15:03] Construtora: VIDEO-TOUR.mp4 (arquivo anexado)",
    "[18/08/2026 22:59] Ingriede: Olá! Posso ter mais informações sobre isso?"
  ].join("\n"));
  zip.file("ARTE-PROMO.jpg", Buffer.from("conteudo-da-arte"));
  zip.file("FOLDER.pdf", Buffer.from("conteudo-do-folder"));
  zip.file("VIDEO-TOUR.mp4", Buffer.from("conteudo-do-video"));
  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  const prep = await prepararConversaDoZip(buffer, { includeExtractedFiles: true, audioWindowDays: "90" });
  assert.deepEqual(prep.visuaisCitados, ["ARTE-PROMO.jpg", "FOLDER.pdf"], "imagem e PDF citados entram; vídeo não");
  assert.deepEqual(prep.visuaisParaLer, ["ARTE-PROMO.jpg", "FOLDER.pdf"]);
  assert.ok(!prep.ignoredFiles.includes("ARTE-PROMO.jpg"), "o que vai ser lido não pode mais ser contado como ignorado");
  assert.ok(prep.ignoredFiles.includes("VIDEO-TOUR.mp4"), "vídeo continua ignorado");
  assert.ok(Buffer.isBuffer(prep._extractedVisuals["ARTE-PROMO.jpg"]), "o arquivo sai do ZIP na mesma descompactação");
  assert.ok(!prep._extractedVisuals["VIDEO-TOUR.mp4"], "vídeo nem é descompactado");

  // E o texto lido vira mensagem da conversa, no lugar do anexo.
  const resultado = await finalizarAnaliseDaConversa({
    txtFile: "_chat.txt",
    messages: prep.messages,
    audioFilesRelevantes: [],
    audioFilesForaDaJanela: [],
    transcriptionMap: {},
    leiturasVisuais: {
      "ARTE-PROMO.jpg": { status: "lido", text: "Anúncio.\nDe R$ 390.000 por R$ 350.000.\n2 dormitórios, semimobiliado." },
      "FOLDER.pdf": { status: "lido", text: "Folder do empreendimento. Entrada 30% e saldo em até 30x." }
    },
    janelaConversa: prep.janelaConversa,
    ignoredFilesCount: prep.ignoredFilesCount,
    ignoredFiles: prep.ignoredFiles,
    metricsBase: prep.metricsBase,
    existingTimeline: [], previousAnalysis: null, existingLeadId: null
  });

  const linhaArte = resultado.timeline.find(m => m.mediaFile === "ARTE-PROMO.jpg");
  assert.ok(linhaArte, "a mensagem do anexo continua existindo na conversa");
  assert.match(linhaArte.text, /^\[Imagem lida pela IA\]/, "e agora carrega o que estava escrito na imagem");
  assert.match(linhaArte.text, /R\$ 350\.000/, "o preço da arte entra na conversa");
  assert.equal(linhaArte.source, "visual");
  const linhaFolder = resultado.timeline.find(m => m.mediaFile === "FOLDER.pdf");
  assert.match(linhaFolder.text, /^\[Documento lido pela IA\]/, "PDF entra com o rótulo de documento");
  assert.equal(resultado.visuaisLidos, 2, "o resultado conta quantos viraram texto");
  assert.match(resultado.ignoredRule, /V[íi]deos/, "a frase da tela precisa refletir o comportamento novo");
  assert.doesNotMatch(resultado.ignoredRule, /Imagens, v[íi]deos, documentos.*n[ãa]o alimentam/, "a frase velha não pode continuar");

  // Vídeo continua fora, sem leitura nenhuma: a linha dele segue sendo só o aviso de que existiu.
  const linhaVideo = resultado.timeline.find(m => String(m.text || "").includes("vídeo — conteúdo não analisado"));
  assert.ok(linhaVideo, "a mensagem do vídeo continua na conversa, como aviso de envio");
  assert.notEqual(linhaVideo.source, "visual", "vídeo não é lido");
  assert.equal(resultado.timeline.filter(m => m.source === "visual").length, 2, "só a imagem e o PDF viraram texto");
}

// ── 7. As pontas ligadas (rota e app) ─────────────────────────────────────────────────────────
{
  const rota = fs.readFileSync(new URL("../api/processar-storage.js", import.meta.url), "utf8");
  assert.ok(rota.includes("lerArquivosVisuais"), "a importação precisa chamar a leitura");
  assert.ok(rota.includes("verificarLimiteLeituraVisual"), "com teto diário conferido ANTES de gastar");
  assert.ok(rota.includes("registrarConsumoLeituraVisual"), "e consumo registrado só do que virou texto");
  assert.ok(rota.includes("leiturasVisuais: body?.leiturasVisuais"), "a análise precisa receber as leituras de volta");
  const app = fs.readFileSync(new URL("../js/importacao.js", import.meta.url), "utf8");
  assert.ok(app.includes("leiturasVisuais:prep.leiturasVisuais"), "o app precisa repassar as leituras para a análise");
  assert.ok(app.includes("Imagens/PDFs lidos:"), "e mostrar quantos foram lidos no resultado da importação");
}

console.log("v1306-importacao-le-imagem-e-pdf: ok");
