import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { finalizarAnaliseDaConversa, prepararConversaDoZip } from "../api/_pipeline.js";
import { _nomeIdentity } from "../api/_persistence.js";

// v1141 — "temos que achar um jeito de reimportar ou reanalisar SOMENTE o que já não foi feito,
// senão vou perder MUITO DINHEIRO desnecessariamente com tokens de api de retrabalho que já está
// salvo no sistema" (dono, 05/08/2026). Este arquivo tranca as três economias desta versão:
//
//   1. a análise já salva é reaproveitada quando a reimportação não trouxe NADA novo (zero IA);
//   2. o áudio que já tem transcrição salva deste cliente nem é extraído/subido de novo;
//   3. o nome do arquivo passa a gerar a MESMA chave nas duas formas em que ele chega ao servidor
//      — era esse desencontro que fazia o cache de transcrição do cliente nunca ser encontrado
//      ("0 reaproveitados" pra sempre, retranscrevendo e pagando tudo a cada reimportação).

// ── 1. Mesma conversa, zero novidade → nenhuma análise nova ────────────────────────────────────
const MSGS = [
  { date: "2026-07-01", time: "09:10", author: "Cliente", text: "bom dia, ainda tem unidade?", iso: "2026-07-01T09:10:00.000Z", order: 1 },
  { date: "2026-07-01", time: "09:14", author: "Corretor", text: "bom dia! tenho sim, te mando as opcoes", iso: "2026-07-01T09:14:00.000Z", order: 2 }
];
const ANALISE_SALVA = {
  summary: "Cliente perguntou por unidade disponível.",
  clientName: "Cliente",
  // v1177 — a análise salva só pode ser reaproveitada se a TELA ainda a aceitar como atual, e o
  // carimbo de arquitetura é o que ela confere (ver analiseAtualValida752 em app.js). Sem isso, a
  // reimportação reaproveitava justamente o texto que o cadastro recusa e ficava pedindo
  // "Reanalise…" pra sempre, mesmo depois de o corretor exportar a conversa de novo.
  arquiteturaMensagens: "v852-cerebro-unico-obrigatorio",
  messages: {
    a: "Oi! Passando pra confirmar se ainda faz sentido olharmos as opções que te mandei.",
    b: "Oi, tudo bem? Fico à disposição se quiser retomar a conversa das unidades.",
    c: "Consegue me dizer hoje se seguimos com a unidade que você viu?",
    aLabel: "Recomendada", bLabel: "Mais suave", cLabel: "Mais direta", recomendada: "a"
  },
  _importacaoPendente: { status: "conversa-consolidada-aguardando-reanalise" }
};

const semNovidade = await finalizarAnaliseDaConversa({
  txtFile: "Conversa do WhatsApp com Cliente.txt",
  messages: MSGS,
  audioFilesRelevantes: [],
  transcriptionMap: {},
  existingLeadId: "lead-1",
  existingTimeline: MSGS.map(m => ({ ...m, type: "text", source: "txt" })),
  previousAnalysis: ANALISE_SALVA
});

assert.equal(semNovidade.incrementalMeta.reimportacao, true, "com id do cliente e conversa salva, é reimportação");
assert.equal(semNovidade.incrementalMeta.mensagensNovas, 0, "a mesma conversa não tem mensagem nova");
assert.equal(semNovidade.incrementalMeta.analiseReutilizada, true, "sem novidade, a análise salva é reaproveitada");
assert.equal(semNovidade.analysis.messages.a, ANALISE_SALVA.messages.a, "as três mensagens vêm da análise que já estava salva");
assert.equal(semNovidade.analysis.analiseReutilizadaDeImportacaoAnterior, true, "fica marcado que foi reaproveitada");
assert.equal(semNovidade.analysis._importacaoPendente, undefined, "estado intermediário de importação antiga não é ressuscitado");
// Sem OPENAI_API_KEY neste ambiente, uma análise NOVA sairia em modo "sem_api": provar que o modo
// não é esse é a prova de que a IA não foi chamada.
assert.notEqual(semNovidade.analysis.mode, "sem_api", "nenhuma chamada de análise aconteceu");

// ── 2. Uma mensagem nova → a análise roda (novidade real merece IA) ────────────────────────────
const comNovidade = await finalizarAnaliseDaConversa({
  txtFile: "Conversa do WhatsApp com Cliente.txt",
  messages: [...MSGS, { date: "2026-07-02", time: "08:00", author: "Cliente", text: "consegue me mandar o valor final?", iso: "2026-07-02T08:00:00.000Z", order: 3 }],
  audioFilesRelevantes: [],
  transcriptionMap: {},
  existingLeadId: "lead-1",
  existingTimeline: MSGS.map(m => ({ ...m, type: "text", source: "txt" })),
  previousAnalysis: ANALISE_SALVA
});
assert.equal(comNovidade.incrementalMeta.mensagensNovas, 1, "a mensagem nova é reconhecida");
assert.equal(comNovidade.incrementalMeta.analiseReutilizada, false, "com novidade, NÃO reaproveita — analisa de novo");
assert.equal(comNovidade.analysis.mode, "sem_api", "a análise foi de fato chamada (aqui sem chave, então modo sem_api)");

// ── 3. Análise salva incompleta nunca é reaproveitada ──────────────────────────────────────────
for (const ruim of [
  null,
  { messages: { a: "curta", b: "", c: "" } },
  { sugestoesPendentes: true, messages: ANALISE_SALVA.messages },
  { mode: "erro_api", messages: ANALISE_SALVA.messages }
]) {
  const r = await finalizarAnaliseDaConversa({
    txtFile: "x.txt", messages: MSGS, audioFilesRelevantes: [], transcriptionMap: {},
    existingLeadId: "lead-1", existingTimeline: MSGS.map(m => ({ ...m, type: "text", source: "txt" })),
    previousAnalysis: ruim
  });
  assert.equal(r.incrementalMeta.analiseReutilizada, false, "análise salva incompleta ou com falha nunca é reaproveitada");
}

// ── 4. Áudio já transcrito deste cliente não é extraído do ZIP de novo ─────────────────────────
const zip = new JSZip();
zip.file("_chat.txt", [
  "01/07/2026 09:10 - Cliente: bom dia",
  "01/07/2026 09:11 - Cliente: AUD-20260701-WA0001.opus (arquivo anexado)",
  "01/07/2026 09:12 - Cliente: AUD-20260701-WA0002.opus (arquivo anexado)"
].join("\n"));
zip.file("AUD-20260701-WA0001.opus", Buffer.from("audio-um"));
zip.file("AUD-20260701-WA0002.opus", Buffer.from("audio-dois"));
const buffer = await zip.generateAsync({ type: "nodebuffer" });

const semCache = await prepararConversaDoZip(buffer, { audioWindowDays: "all", includeExtractedFiles: true });
assert.deepEqual(
  Object.keys(semCache._extractedFiles).sort(),
  ["AUD-20260701-WA0001.opus", "AUD-20260701-WA0002.opus"],
  "sem cache, os dois áudios são extraídos"
);

const comCache = await prepararConversaDoZip(buffer, {
  audioWindowDays: "all",
  includeExtractedFiles: true,
  audiosJaTranscritos: { "AUD-20260701-WA0001.opus": "texto que já estava salvo" }
});
assert.deepEqual(
  Object.keys(comCache._extractedFiles),
  ["AUD-20260701-WA0002.opus"],
  "o áudio que já tem transcrição salva não é extraído (nem sobe pro Storage) de novo"
);
assert.deepEqual(
  comCache.audiosParaTranscrever.sort(),
  ["AUD-20260701-WA0001.opus", "AUD-20260701-WA0002.opus"],
  "a lista da janela continua completa — é ela que diz quantos foram reaproveitados"
);

// ── 5. O mesmo arquivo, nas duas formas em que chega, gera a MESMA chave ───────────────────────
// No aparelho o nome tem espaços; no Storage ele passa por sanitização e vira traços. Enquanto as
// duas formas geravam chaves diferentes, a busca pelo cliente já salvo (que é o que reaproveita as
// transcrições) falhava exatamente na etapa de preparar a importação.
const comEspacos = _nomeIdentity("Conversa do WhatsApp com Nasser-enxuto.zip");
const sanitizado = _nomeIdentity("Conversa-do-WhatsApp-com-Nasser-enxuto.zip");
const comUnderscore = _nomeIdentity("Conversa_do_WhatsApp_com_Nasser-enxuto.zip");
assert.equal(comEspacos, "nasser", "nome com espaços vira a chave do cliente");
assert.equal(sanitizado, comEspacos, "nome sanitizado do Storage gera a MESMA chave");
assert.equal(comUnderscore, comEspacos, "nome com underscore gera a MESMA chave");
assert.equal(_nomeIdentity("Conversa do WhatsApp com Nasser (1).zip"), "nasser", "cópia numerada do WhatsApp também");
assert.equal(_nomeIdentity("Conversa-do-WhatsApp-com-Nasser-enxuto-(2).zip"), "nasser", "sufixos técnicos em qualquer ordem");

// ── 6. Contrato no código: o id do cliente já salvo circula entre as etapas ────────────────────
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const storage = fs.readFileSync(new URL("../api/processar-storage.js", import.meta.url), "utf8");
assert.match(app, /existingLeadId: prep\?\.leadAnterior\?\.id \|\| ""/, "o app manda pra análise o cliente que o servidor já identificou");
assert.match(storage, /leadAnterior/, "a etapa preparar devolve o cliente já identificado");
assert.match(storage, /select\("timeline_json,resultado_analise"\)/, "a etapa analisar lê a conversa E a análise já salvas");

console.log("v1141-reimportacao-nao-paga-retrabalho: ok");
