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

// v1221 — A ECONOMIA Nº 3 DESTA VERSÃO ACABOU, POR DECISÃO DO DONO.
//
// "a regra é sempre que fizer uma importação, tem que fazer a reanálise" (11/08/2026). O atalho
// que este trecho guardava — reimportação sem mensagem nova não chamava a IA — é o que devolvia
// texto velho como se fosse novo, inclusive texto escrito sob regras que já tinham sido
// corrigidas. As economias 2 e 4 (áudio já transcrito, chave do nome do arquivo) continuam de pé e
// seguem guardadas mais abaixo — elas são o dinheiro grande.
assert.equal(semNovidade.incrementalMeta.analiseNovaTentada, true, "importou, analisa: a IA é chamada mesmo sem mensagem nova");

// Neste ambiente não há chave da OpenAI, então a análise nova sai em modo "sem_api" — inaproveitável.
// Aí entra a rede de segurança: mantém a análise anterior pra o corretor não ficar sem nada.
assert.equal(semNovidade.incrementalMeta.analiseReutilizada, true, "análise nova imprestável → mantém a anterior");
assert.equal(semNovidade.analysis.messages.a, ANALISE_SALVA.messages.a, "o que fica na tela é a análise que já estava salva");
assert.equal(semNovidade.analysis.analiseReutilizadaDeImportacaoAnterior, true, "fica marcado que foi mantida, não recém-feita");
assert.equal(semNovidade.analysis._importacaoPendente, undefined, "estado intermediário de importação antiga não é ressuscitado");

// ── 2. Uma mensagem nova → a análise roda igual (não existe mais caminho que pule a IA) ────────
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
assert.equal(comNovidade.incrementalMeta.analiseNovaTentada, true, "com novidade também analisa");

// ── 3. Sem análise anterior aproveitável, a falha da IA aparece como falha (não inventa nada) ──
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
  assert.equal(r.incrementalMeta.analiseReutilizada, false, "análise salva incompleta ou com falha nunca volta pra tela");
  assert.equal(r.analysis.mode, "sem_api", "a IA foi chamada de verdade (sem chave neste ambiente, sai sem_api)");
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
// v1195 — o processamento da conversa importada saiu do app.js para o pedaço js/importacao.js,
// baixado só na hora em que o corretor importa. Este teste confere esse código como texto, então
// lê os dois arquivos juntos: os asserts abaixo valem exatamente sobre o mesmo código de antes.
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8")
  + '\n' + fs.readFileSync(new URL('../js/importacao.js', import.meta.url), 'utf8');
const storage = fs.readFileSync(new URL("../api/processar-storage.js", import.meta.url), "utf8");
assert.match(app, /existingLeadId: prep\?\.leadAnterior\?\.id \|\| ""/, "o app manda pra análise o cliente que o servidor já identificou");
assert.match(storage, /leadAnterior/, "a etapa preparar devolve o cliente já identificado");
assert.match(storage, /select\("timeline_json,resultado_analise"\)/, "a etapa analisar lê a conversa E a análise já salvas");

console.log("v1141-reimportacao-nao-paga-retrabalho: ok");
