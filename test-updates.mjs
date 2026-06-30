import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import handler from "./server.js";

const appSource = fs.readFileSync(new URL("./app.js", import.meta.url), "utf8");
const htmlSource = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const dbSource = fs.readFileSync(new URL("./db.js", import.meta.url), "utf8");
const serverSource = fs.readFileSync(new URL("./server.js", import.meta.url), "utf8");
const workerSource = fs.readFileSync(new URL("./service-worker.js", import.meta.url), "utf8");
const stylesSource = fs.readFileSync(new URL("./styles.css", import.meta.url), "utf8");

function makeResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = value || ""; }
  };
}

async function invoke({ method, url, body }) {
  const req = { method, url, body, headers: { host: "localhost" } };
  const res = makeResponse();
  await handler(req, res);
  return { status: res.statusCode, payload: JSON.parse(res.body || "{}") };
}

const sampleAnalysis = {
  resumo: "O cliente demonstrou preferência pela unidade 1301 e já recebeu uma primeira simulação.",
  produtoPrincipal: "Renaissance 1301",
  produtosParalelos: ["Personalité", "Prime 303"],
  etapa: "análise financeira",
  nivelInteresse: "alto",
  sinaisInteresse: ["Indicou a unidade específica", "Pediu condição parcelada"],
  objecaoPrincipal: "Composição do pagamento durante a construção",
  ultimaPessoaAFalar: "Sanchai",
  ultimaSolicitacaoCliente: "Receber uma condição parcelada para analisar com o filho",
  ultimoCompromissoCliente: "Analisar a simulação com o filho",
  ultimoCompromissoCorretor: "Enviar opções de pagamento",
  participantesDecisao: "Jamil e o filho",
  propostaResumo: "Primeira simulação do apartamento 1301 já enviada",
  pendenciaFinanceira: "Definir se o ajuste deve ocorrer na entrada ou nas parcelas",
  pendenciaReal: "Entender qual parte da primeira simulação precisa ser ajustada",
  quemDeveProximoPasso: "Corretor",
  proximoPasso: "Perguntar se o cliente prefere ajustar a entrada ou as parcelas",
  alertaInformacaoIncompleta: "",
  mensagensSugeridas: [
    { titulo: "Direta", mensagem: "Jamil, na primeira simulação, qual ponto você prefere ajustar: a entrada ou as parcelas?" },
    { titulo: "Comparativa", mensagem: "Jamil, posso montar duas alternativas para comparar com a primeira. Você prefere reduzir a entrada ou o valor das parcelas?" },
    { titulo: "Planejamento", mensagem: "Jamil, considerando a simulação enviada, qual parte precisa ficar mais confortável para vocês: entrada ou parcelas?" }
  ]
};

test("v040 mantém atualização automática e evita mistura de arquivos em cache", () => {
  const versionSource = fs.readFileSync(new URL("./version.js", import.meta.url), "utf8");
  assert.match(versionSource, /app: "v088"/);
  assert.match(appSource, /const APP_VERSION = VERSION_INFO\.app/);
  assert.match(appSource, /const CLOUD_WORKSPACE = \(localStorage\.getItem\("corretorProWorkspace"\) \|\| "corretor-pro-site"\)\.trim\(\)/);
  assert.match(appSource, /AUTO_SYNC_INTERVAL_MS = 15000/);
  assert.match(appSource, /startAutomaticSync\(\)/);
  assert.doesNotMatch(htmlSource, /sync-dialog/);
  assert.doesNotMatch(appSource, /data-sync-open/);
  assert.match(workerSource, /BUILD_ID = `corretor-pro-\$\{VERSION_INFO\.app\}`/);
  assert.match(htmlSource, /app\.js\?v=088/);
  assert.match(htmlSource, /styles\.css\?v=088/);
  assert.match(appSource, /db\.js\?v=088/);
  assert.match(appSource, /whatsapp\.js\?v=088/);
  assert.match(workerSource, /networkFirstPaths/);
  assert.match(appSource, /controllerchange/);
});

test("carregamento inicial mostra dados locais antes de consultar a nuvem", () => {
  const start = appSource.indexOf("async function init()");
  const source = appSource.slice(start);
  const localRead = source.indexOf("await refreshRecords()");
  const firstRender = source.indexOf("await renderRoute()");
  const remoteRefresh = source.indexOf("refreshFromCloud().catch");
  assert.ok(localRead >= 0);
  assert.ok(firstRender > localRead);
  assert.ok(remoteRefresh > firstRender);
  assert.doesNotMatch(source, /syncLocalRecordsToCloud\(\)/);
  assert.doesNotMatch(appSource, /async function syncLocalRecordsToCloud/);
});

test("áudios têm novas tentativas e aviso persistente de informação incompleta", () => {
  assert.match(appSource, /MAX_TRANSCRIPTION_ATTEMPTS = 3/);
  assert.match(appSource, /transcribeAudioWithRetry/);
  assert.match(appSource, /Tentando novamente/);
  assert.match(appSource, /Informação incompleta/);
  assert.match(appSource, /audiosNaoTranscritos/);
});

test("exclusão de lead existe localmente e na API", () => {
  assert.match(appSource, /data-delete-lead/);
  assert.match(appSource, /deleteCurrentLead/);
  assert.match(dbSource, /export async function deleteAtendimento/);
  assert.match(serverSource, /method === "DELETE"/);
  assert.match(serverSource, /deletedAt/);
});

test("API ignora uma cópia antiga para não desfazer exclusões ou atualizações", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oldFetch = globalThis.fetch;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      async json() {
        return [{
          id: "existing-id",
          device_id: "corretor-pro-site",
          conversation_key: "lead-1",
          nome_lead: "Lead 1",
          arquivo_origem: null,
          ultima_mensagem_at: "2026-06-26T12:00:00.000Z",
          ultima_mensagem_resumo: "Atual",
          timeline: [],
          metadata: { deletedAt: "2026-06-26T12:00:00.000Z" },
          created_at: "2026-06-25T12:00:00.000Z",
          updated_at: "2026-06-26T12:00:00.000Z"
        }];
      }
    };
  };

  try {
    const result = await invoke({
      method: "POST",
      url: "/api/atendimentos",
      body: {
        id: "old-id",
        deviceId: "corretor-pro-site",
        conversationKey: "lead-1",
        nomeLead: "Lead 1",
        timeline: [],
        metadata: { lastReceivedAt: "2026-06-26T11:00:00.000Z" },
        createdAt: "2026-06-24T12:00:00.000Z",
        updatedAt: "2026-06-26T13:00:00.000Z"
      }
    });
    assert.equal(result.status, 200);
    assert.equal(result.payload.ignoredStale, true);
    assert.equal(calls, 1, "não deve sobrescrever o registro mais novo");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});

test("DELETE grava marca de exclusão para atualizar os outros aparelhos", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oldFetch = globalThis.fetch;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const calls = [];
  globalThis.fetch = async (_url, options = {}) => {
    calls.push(options);
    if (!options.method) {
      return {
        ok: true,
        async json() {
          return [{
            id: "existing-id",
            device_id: "corretor-pro-site",
            conversation_key: "lead-1",
            nome_lead: "Lead 1",
            arquivo_origem: null,
            ultima_mensagem_at: "2026-06-26T12:00:00.000Z",
            ultima_mensagem_resumo: "Mensagem",
            timeline: [{ type: "text", text: "Mensagem" }],
            metadata: {},
            created_at: "2026-06-25T12:00:00.000Z",
            updated_at: "2026-06-26T12:00:00.000Z"
          }];
        }
      };
    }
    return { ok: true, async json() { return []; } };
  };

  try {
    const result = await invoke({
      method: "DELETE",
      url: "/api/atendimentos?device_id=corretor-pro-site&conversation_key=lead-1"
    });
    assert.equal(result.status, 200);
    assert.equal(result.payload.deleted, true);
    assert.equal(calls.length, 2);
    const tombstone = JSON.parse(calls[1].body);
    assert.equal(tombstone.timeline.length, 0);
    assert.ok(tombstone.metadata.deletedAt);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});

test("versão v040 aparece no cabeçalho superior", () => {
  assert.match(htmlSource, /id="header-version"[^>]*>v088<\/span>/);
  assert.match(appSource, /headerVersion\.textContent = APP_VERSION/);
  assert.doesNotMatch(appSource, /class="build-tag">Corretor Pro/);
});

test("detalhe começa em 30 dias e permite 60, 90 ou todo o período", () => {
  assert.match(appSource, /detailPeriod: "30"/);
  assert.match(appSource, /\{ value: "30", label: "30 dias" \}/);
  assert.match(appSource, /\{ value: "60", label: "60 dias" \}/);
  assert.match(appSource, /\{ value: "90", label: "90 dias" \}/);
  assert.match(appSource, /\{ value: "all", label: "Todo período" \}/);
  assert.match(appSource, /filterTimelineByPeriod/);
  assert.match(appSource, /data-detail-period/);
});

test("botão Copiar usa somente as mensagens do período selecionado", () => {
  assert.match(appSource, /data-copy-messages/);
  assert.match(appSource, /copySelectedMessages/);
  assert.match(appSource, /formatTimelineForCopy/);
  assert.match(appSource, /navigator\.clipboard\.writeText/);
  assert.match(appSource, /const timeline = filterTimelineByPeriod\(record\.timeline\)/);
});

test("exclusão retira o lead da tela antes de aguardar banco e nuvem", () => {
  const start = appSource.indexOf("async function deleteCurrentLead()");
  const end = appSource.indexOf("function bindEvents()", start);
  const source = appSource.slice(start, end);
  const removeFromState = source.indexOf("state.records = state.records.filter");
  const renderImmediately = source.indexOf("renderList()");
  const waitLocalDelete = source.indexOf("await deleteAtendimento");
  assert.ok(removeFromState >= 0);
  assert.ok(renderImmediately > removeFromState);
  assert.ok(waitLocalDelete > renderImmediately);
  assert.match(source, /O lead foi restaurado/);
});

test("proposta pode ser anexada como print e substitui a anterior", () => {
  assert.match(appSource, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(appSource, /prepareProposalImage/);
  assert.match(appSource, /MAX_PROPOSAL_SOURCE_BYTES/);
  assert.match(appSource, /propostaImagem: proposal/);
  assert.match(appSource, /delete metadata\.analiseComercial/);
  assert.match(appSource, /A última imagem anexada substitui a anterior/);
  assert.match(stylesSource, /\.proposal-card/);
});

test("análise comercial usa período selecionado, áudio e proposta já enviada", () => {
  assert.match(appSource, /data-analyze-attendance/);
  assert.match(appSource, /fetch\("\/api\/analisar"/);
  assert.match(appSource, /incompleteAudioCount/);
  assert.match(appSource, /proposalImage/);
  assert.match(serverSource, /já foi enviada ao contato desta conversa/);
  assert.match(serverSource, /detail: "high"/);
  assert.match(serverSource, /gpt-5\.4-mini/);
  assert.match(serverSource, /type: "json_schema"/);
  assert.match(serverSource, /mensagensSugeridas/);
  assert.match(appSource, /data-copy-suggestion/);
});

test("inteligência comercial parte da proposta já enviada e não reinicia a negociação", () => {
  assert.match(serverSource, /ação comercial mais recente/i);
  assert.match(serverSource, /STATUS DO COMPROMISSO DE ENVIAR CONDIÇÕES/);
  assert.match(serverSource, /CUMPRIDO EM RELAÇÃO AO/);
  assert.match(serverSource, /Nunca use como próximo passo/);
  assert.match(serverSource, /reconhecendo a primeira já enviada/);
  assert.match(serverSource, /O mesmo imóvel não pode aparecer ao mesmo tempo como produto principal e produto paralelo/);
  assert.match(serverSource, /não prova que o cliente final já a recebeu/);
  assert.match(serverSource, /Pode oferecer NOVAS composições/);
  assert.match(serverSource, /nenhum campo ou sugestão pode tratá-la como ainda não enviada/);
});

test("revisão automática corrige análise que ignora a proposta já enviada", async () => {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  let calls = 0;

  const invalidAnalysis = {
    ...sampleAnalysis,
    produtosParalelos: ["Personalité", "Lançamento da Venâncio - unidade 1301"],
    proximoPasso: "Enviar as opções de pagamento e mostrar como ficam entrada e parcelas",
    mensagensSugeridas: [
      { titulo: "Retomar", mensagem: "Jamil, posso te organizar a condição do 1301 e te mostrar os números?" },
      { titulo: "Com o filho", mensagem: "Posso te mandar uma visão direta da proposta para conversar com seu filho?" },
      { titulo: "Comparar", mensagem: "Quer que eu compare o 1301 com alternativas próximas?" }
    ]
  };

  globalThis.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      async json() {
        return { output_text: JSON.stringify(calls === 1 ? invalidAnalysis : sampleAnalysis) };
      }
    };
  };

  try {
    const result = await invoke({
      method: "POST",
      url: "/api/analisar",
      body: {
        leadName: "Jamil Contalex",
        contactType: "cliente",
        period: "60 dias",
        messages: "25/06/2026 09:06 - Jamil: Me passa o plano para eu olhar com meu filho.\n25/06/2026 09:07 - Sanchai: Já te mando opções.",
        messageCount: 2,
        incompleteAudioCount: 0,
        proposalImage: "data:image/png;base64,iVBORw0KGgo=",
        proposalAttachedAt: "2026-06-26T12:00:00.000Z"
      }
    });

    assert.equal(result.status, 200);
    assert.equal(calls, 2);
    assert.equal(result.payload.qualityReviewApplied, true);
    assert.match(result.payload.analysis.proximoPasso, /ajustar a entrada ou as parcelas/i);
    assert.doesNotMatch(result.payload.analysis.mensagensSugeridas.map(item => item.mensagem).join(" "), /posso te organizar a condição|alternativas próximas/i);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  }
});

test("rota /api/analisar envia texto e imagem à OpenAI e devolve JSON estruturado", async () => {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldModel = process.env.OPENAI_ANALYSIS_MODEL;
  const oldFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  delete process.env.OPENAI_ANALYSIS_MODEL;
  let captured;

  globalThis.fetch = async (url, options = {}) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    captured = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      async json() {
        return { output_text: JSON.stringify(sampleAnalysis) };
      }
    };
  };

  try {
    const result = await invoke({
      method: "POST",
      url: "/api/analisar",
      body: {
        leadName: "Jamil Contalex",
        contactType: "cliente",
        period: "30 dias",
        messages: "25/06/2026 09:06 - Jamil: Vou analisar com meu filho.\n\n25/06/2026 09:07 - Sanchai: Certo, já te mando opções.",
        messageCount: 2,
        incompleteAudioCount: 0,
        proposalImage: "data:image/png;base64,iVBORw0KGgo=",
        proposalAttachedAt: "2026-06-26T12:00:00.000Z"
      }
    });

    assert.equal(result.status, 200);
    assert.equal(result.payload.analysis.produtoPrincipal, "Renaissance 1301");
    assert.equal(result.payload.analysis.mensagensSugeridas.length, 3);
    assert.equal(captured.model, "gpt-5.4-mini");
    assert.equal(captured.store, false);
    assert.equal(captured.input[0].content[1].type, "input_image");
    assert.equal(captured.input[0].content[1].detail, "high");
    assert.match(captured.input[0].content[0].text, /PROPOSTA EM IMAGEM: sim/);
    assert.match(captured.input[0].content[0].text, /ÚLTIMA AÇÃO COMERCIAL APÓS A CONVERSA: proposta efetivamente enviada ao cliente direto/);
    assert.match(captured.input[0].content[0].text, /STATUS DO COMPROMISSO DE ENVIAR CONDIÇÕES: CUMPRIDO EM RELAÇÃO AO CLIENTE DIRETO/);
    assert.match(captured.instructions, /Nunca use como próximo passo/);
    assert.match(captured.instructions, /não pode aparecer ao mesmo tempo como produto principal e produto paralelo/);
    assert.equal(captured.text.format.type, "json_schema");
    assert.equal(captured.text.format.strict, true);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.OPENAI_ANALYSIS_MODEL;
    else process.env.OPENAI_ANALYSIS_MODEL = oldModel;
  }
});

test("v040 mantém análise objetiva, visual e detalhes recolhidos", () => {
  assert.match(appSource, /analysis-feature-grid/);
  assert.match(appSource, /analysis-feature-card/);
  assert.match(appSource, /analysis-point-list/);
  assert.match(appSource, /Leitura atual/);
  assert.match(appSource, /O que falta definir/);
  assert.match(appSource, /Próximo passo/);
  assert.match(appSource, /<details class="analysis-details">/);
  assert.match(appSource, /Ver análise completa/);
  assert.match(stylesSource, /\.analysis-feature-grid/);
  assert.match(stylesSource, /\.analysis-details summary/);
});

test("v040 substitui aviso genérico por confirmação discreta e só mostra alerta acionável", () => {
  assert.match(appSource, /getActionableAnalysisAlert/);
  assert.match(appSource, /Proposta analisada com sucesso/);
  assert.match(appSource, /analysis-status-success/);
  assert.match(appSource, /actionableAlert \? `<div class="analysis-alert"/);
  assert.match(serverSource, /alertaInformacaoIncompleta: string vazia/);
  assert.match(serverSource, /salvo quando houver áudio sem transcrição/);
  assert.match(stylesSource, /\.analysis-status-success/);
});

test("v040 mantém sugestões completas, visíveis e numeradas", () => {
  assert.match(appSource, /suggestions-panel-grid/);
  assert.match(appSource, /class="suggestion-number"/);
  assert.match(appSource, /suggestion-message-full/);
  assert.match(appSource, /data-copy-suggestion/);
  assert.doesNotMatch(appSource, /Ver sugestão/);
  assert.match(stylesSource, /\.suggestions-grid/);
  assert.match(stylesSource, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
});


test("v040 registra Atendido agora sem timer ou bloqueio por tempo", () => {
  assert.match(appSource, /data-attended-now/);
  assert.match(appSource, /async function markAttendedNow/);
  assert.match(appSource, /async function registerLeadAttended/);
  assert.match(appSource, /statusAtendimento: "aguardando_resposta"/);
  assert.match(appSource, /atendidoAgoraAt: now/);
  assert.match(appSource, /delete metadata\.reanaliseDisponivelEm/);
  assert.doesNotMatch(appSource, /REANALYSIS_WAIT_MS/);
  assert.doesNotMatch(appSource, /Nova retomada em/);
  assert.doesNotMatch(appSource, /48 horas sem resposta/);
  assert.match(appSource, /Aguardando resposta do cliente/);
  assert.match(appSource, /attendance-urgency/);

  const start = appSource.indexOf("async function registerLeadAttended(");
  const end = appSource.indexOf("async function markAttendedNow()", start);
  const source = appSource.slice(start, end);
  const localSave = source.indexOf("await saveAtendimento(updated)");
  const renderImmediate = source.indexOf("renderDetail(updated)");
  const cloudPush = source.indexOf("pushRemoteRecord(updated)");
  assert.ok(localSave >= 0);
  assert.ok(renderImmediate > localSave);
  assert.ok(cloudPush > renderImmediate);
});

test("copiar sugestão também registra o lead como atendido", () => {
  const start = appSource.indexOf("async function copySuggestedMessage");
  const end = appSource.indexOf("async function copySelectedMessages", start);
  const source = appSource.slice(start, end);
  assert.match(source, /await writeToClipboard/);
  assert.match(source, /registerLeadAttended\(record, "sugestao_copiada"/);
  assert.match(source, /Mensagem copiada e atendimento registrado/);
});

test("v040 mantém análise sempre disponível e remove bloqueios por timer", () => {
  assert.doesNotMatch(appSource, /formatWaitRemaining/);
  assert.doesNotMatch(appSource, /followup_due/);
  assert.doesNotMatch(appSource, /startWaitingStatusTimer/);
  const analyzeStart = appSource.indexOf("async function analyzeCurrentAttendance()");
  const analyzeEnd = appSource.indexOf("async function copySuggestedMessage", analyzeStart);
  const analyzeSource = appSource.slice(analyzeStart, analyzeEnd);
  assert.doesNotMatch(analyzeSource, /workflow\.mode === "waiting"/);
  assert.doesNotMatch(analyzeSource, /Aguarde a resposta do cliente/);
  const renderStart = appSource.indexOf("function renderAnalysisSection(record)");
  const renderEnd = appSource.indexOf("function renderContactTypeSelector(record)", renderStart);
  const renderSource = appSource.slice(renderStart, renderEnd);
  assert.match(renderSource, /Analisar atendimento/);
  assert.match(renderSource, /Atualizar análise/);
});

test("v040 usa o seletor como período da análise, cópia e histórico", () => {
  assert.match(appSource, /Período da análise:/);
  assert.match(appSource, /serão consideradas.*na análise/);
  assert.match(appSource, /filterTimelineByPeriod\(record\.timeline\)/);
  assert.match(appSource, /formatTimelineForCopy\(timeline\)/);
  assert.match(appSource, /class="history-panel"/);
});

test("reimportação diferencia mensagem do corretor e resposta do contato usando o horário real", () => {
  assert.match(appSource, /const addedWithTime = merged\.addedItems/);
  assert.match(appSource, /timelineItemTimestamp\(latestAddedItem\)/);
  assert.match(appSource, /isClientTimelineItem\(latestAddedItem\)/);
  assert.match(appSource, /statusAtendimento = "nova_resposta_cliente"/);
  assert.match(appSource, /novaRespostaClienteAt = movementAt/);
  assert.match(appSource, /statusAtendimento = "aguardando_resposta"/);
  assert.match(appSource, /origemUltimaMovimentacao = "mensagem_cliente"/);
  assert.match(appSource, /origemUltimaMovimentacao = "mensagem_corretor"/);
});

test("tipo de contato aparece uma única vez enquanto não foi classificado", () => {
  assert.match(appSource, /function renderContactTypeSelector/);
  assert.match(appSource, /if \(getContactType\(record\)\) return ""/);
  assert.match(appSource, /data-contact-type="cliente"/);
  assert.match(appSource, /data-contact-type="corretor"/);
  assert.match(appSource, /async function setContactType/);
  assert.match(appSource, /tipoContato: type/);
  assert.match(appSource, /tipoContatoDefinidoEm: now/);
  assert.match(appSource, /delete metadata\.analiseComercial/);
  assert.match(stylesSource, /\.contact-type-card/);
  assert.match(stylesSource, /\.contact-type-options/);
});

test("análise diferencia cliente direto de corretor parceiro", () => {
  assert.match(appSource, /contactType: getContactType\(record\)/);
  assert.match(appSource, /Selecione primeiro se este contato é cliente ou corretor/);
  assert.match(serverSource, /TIPO DE CONTATO:/);
  assert.match(serverSource, /CORRETOR PARCEIRO — intermediário/);
  assert.match(serverSource, /Não é comprador; trate como parceria/);
  assert.match(serverSource, /ajude-o a conduzir o cliente final dele/);
  assert.match(serverSource, /body\.contactType !== "cliente"/);
});

test("nova resposta mostra o horário real da mensagem, não o horário da importação", () => {
  assert.match(appSource, /function latestContactMessageDate/);
  assert.match(appSource, /const responseDate = latestContactMessageDate\(record\)/);
  assert.match(appSource, /activityDate: responseDate/);
  assert.match(appSource, /novaRespostaClienteAt/);
  assert.doesNotMatch(appSource, /Recebida .*lastReceivedAt/);
});

test("lista usa a última movimentação, não apenas a última mensagem", () => {
  assert.match(appSource, /function getLatestActivityDate/);
  assert.match(appSource, /formatCardDate\(workflow\.activityDate\.toISOString\(\)\)/);
  assert.match(dbSource, /metadata\?\.ultimaMovimentacaoAt/);
  assert.match(dbSource, /metadata\?\.atendidoAgoraAt/);
});

test("v041 organiza lista por urgência com grupos Chamar agora e Aguardar", () => {
  const renderListStart = appSource.indexOf("function renderList()");
  const renderListEnd = appSource.indexOf("function groupTimelineByDate", renderListStart);
  const renderListSource = appSource.slice(renderListStart, renderListEnd);
  // Horário da última atividade presente no card
  assert.match(renderListSource, /attendance-time/);
  // Seções da tela Bom dia
  assert.match(renderListSource, /Atender agora/);
  assert.match(renderListSource, /Aguardando/);
  // Rótulo de urgência em texto nos cards de ação
  assert.match(renderListSource, /attendance-urgency/);
  // Sem duplicação de horário via formatAttendedNowLabel
  assert.doesNotMatch(renderListSource, /formatAttendedNowLabel/);
  assert.doesNotMatch(renderListSource, /Retomada disponível · 48h sem resposta/);
});



test("v041 classifica urgência por status e tempo, não por tipo de contato", () => {
  // classifyLead unifica a urgência em rótulos de texto
  assert.match(appSource, /function classifyLead\(record\)/);
  assert.match(appSource, /status !== "aguardando_resposta"/);
  // getContactRoleText ainda existe para o painel de detalhe
  assert.match(appSource, /if \(form === "new"\) return broker \? "Última interação do corretor parceiro" : "Última interação do lead"/);
  // Cards da lista não diferenciam tipo de contato para urgência
  const renderListStart = appSource.indexOf("function renderList()");
  const renderListEnd = appSource.indexOf("function groupTimelineByDate", renderListStart);
  const renderListSource = appSource.slice(renderListStart, renderListEnd);
  assert.doesNotMatch(renderListSource, /getContactType\(record\) === "corretor"/);
});

test("v040 mostra inteligência comercial antes do contexto financeiro", () => {
  const renderStart = appSource.indexOf("function renderDetail(record)");
  const renderEnd = appSource.indexOf("async function renderRoute", renderStart);
  const renderSource = appSource.slice(renderStart, renderEnd);
  const analysisPosition = renderSource.indexOf("${renderAnalysisSection(record)}");
  const proposalPosition = renderSource.indexOf("${renderProposalSection(record)}");
  assert.ok(analysisPosition >= 0);
  assert.ok(proposalPosition > analysisPosition);
});

test("v040 aumenta a fonte das sugestões de resposta", () => {
  assert.match(stylesSource, /\.suggestion-body strong \{[\s\S]*font-size: 13px;/);
  assert.match(stylesSource, /\.suggestions-panel \.suggestion-card p \{[\s\S]*font-size: 14px;[\s\S]*line-height: 1\.65;/);
});

test("v040 permite escolher o período dos áudios com 90 dias pré-selecionado", () => {
  assert.match(appSource, /const AUDIO_IMPORT_PERIODS = \[/);
  assert.match(appSource, /\{ value: "30", label: "30 dias" \}/);
  assert.match(appSource, /\{ value: "60", label: "60 dias" \}/);
  assert.match(appSource, /\{ value: "90", label: "90 dias" \}/);
  assert.match(appSource, /\{ value: "all", label: "Todo o período" \}/);
  assert.match(appSource, /audioPeriodSelection: "90"/);
  assert.match(htmlSource, /data-audio-import-period="90"[^>]*aria-pressed="true"/);
  assert.match(htmlSource, /Todas as mensagens escritas serão importadas/);
  assert.match(appSource, /waitForAudioPeriodSelection/);
});

test("v040 transcreve áudios novos e tenta novamente os que falharam", () => {
  assert.match(appSource, /function shouldRetryAudio/);
  assert.match(appSource, /const audioItemsToProcess = audioItems\.filter/);
  assert.match(appSource, /!previous \|\| shouldRetryAudio\(previous\)/);
  assert.match(appSource, /transcriptionStatus = "outside_period"/);
  assert.match(appSource, /Não transcrito por estar fora do período selecionado/);
  assert.match(appSource, /Áudio fora do período/);
  assert.match(appSource, /audiosForaPeriodo/);
  assert.match(appSource, /const failedAudios = \(record\.timeline \|\| \[\]\)\.filter\(isAudioFailure\)/);
});

test("v040 mostra progresso real, atividade contínua e tempo decorrido", () => {
  assert.match(appSource, /1 \+ \(completedAudios \/ Math\.max\(totalToTranscribe, 1\)\) \* 91/);
  assert.doesNotMatch(appSource, /32 \+ \(completedAudios/);
  assert.match(appSource, /setProcessingTelemetry/);
  assert.match(appSource, /Tempo decorrido:/);
  assert.match(htmlSource, /id="processing-spinner"|class="processing-spinner"/);
  assert.match(htmlSource, /id="processing-current"/);
  assert.match(htmlSource, /id="processing-count"/);
  assert.match(htmlSource, /id="processing-elapsed"/);
  assert.match(stylesSource, /@keyframes processing-spin/);
  assert.match(stylesSource, /@keyframes progress-shimmer/);
});

test("v040 permite cancelar sem salvar atendimento parcial", () => {
  assert.match(htmlSource, /id="cancel-import-button"/);
  assert.match(appSource, /async function cancelCurrentImport/);
  assert.match(appSource, /new AbortController\(\)/);
  assert.match(appSource, /state\.importAbortController\?\.abort\(\)/);
  assert.match(appSource, /Importação cancelada\. Nenhum atendimento parcial foi salvo/);
  const processStart = appSource.indexOf("async function processIncomingZip");
  const saveAt = appSource.indexOf("await saveAtendimento(record)", processStart);
  const finalizingAt = appSource.indexOf('cancelImportButton.textContent = "Finalizando..."', processStart);
  assert.ok(finalizingAt >= 0 && finalizingAt < saveAt);
});

test("v040 aumenta os textos da análise sem alterar as sugestões já aprovadas", () => {
  assert.match(stylesSource, /\.analysis-summary p \{[\s\S]*font-size: 12px;/);
  assert.match(stylesSource, /\.analysis-compact-item p \{[\s\S]*font-size: 12px;/);
  assert.match(stylesSource, /\.analysis-block p,[\s\S]*font-size: 11px;/);
  assert.match(stylesSource, /\.analysis-status strong \{[\s\S]*font-size: 12px;/);
  assert.match(stylesSource, /\.suggestions-panel \.suggestion-card p \{[\s\S]*font-size: 14px;/);
});

test("v040 não repete aguardando resposta dentro da inteligência comercial", () => {
  const start = appSource.indexOf("function renderAnalysisSection(record)");
  const end = appSource.indexOf("function renderContactTypeSelector(record)", start);
  const source = appSource.slice(start, end);
  assert.doesNotMatch(source, /Aguardando resposta do cliente/);
  assert.doesNotMatch(source, /Aguardando cliente/);
  assert.match(appSource, /workflowTitle = waitingForClient/);
});



test("v040 usa DNA da conversa e sobreposição de mensagens para separar homônimos", () => {
  assert.match(appSource, /function makeConversationDna/);
  assert.match(appSource, /function timelineOverlap/);
  assert.match(appSource, /resolveConversationIdentity/);
  assert.match(appSource, /conversationDna: identity\.dna/);
  assert.match(appSource, /keyAlreadyUsed \? `\$\{baseKey\}-\$\{dna\}` : baseKey/);
});

test("v040 identifica Sanchai como usuário do app e os demais autores como contato", () => {
  assert.match(appSource, /const APP_USER_NAME = \(localStorage\.getItem\("corretorProUserName"\) \|\| "Sanchai"\)\.trim\(\)/);
  assert.match(appSource, /APP_USER_ALIASES = new Set\(\[normalizeComparable\(APP_USER_NAME\), "sanchai", "voce", "você"\]\)/);
  assert.match(appSource, /function isOwnTimelineItem/);
  assert.match(appSource, /!\s*isOwnTimelineItem\(item\)/);
  assert.match(appSource, /usuarioApp: APP_USER_NAME/);
  assert.match(serverSource, /CORRETOR\/USUÁRIO DO APP:/);
});

test("v040 sincroniza resumos e baixa o histórico completo somente ao abrir", () => {
  assert.match(appSource, /summary: "1"/);
  assert.match(appSource, /remoteSummaries: new Map\(\)/);
  assert.match(appSource, /function mergeLocalAndRemoteSummaries/);
  assert.match(appSource, /async function fetchRemoteRecord/);
  assert.match(appSource, /async function ensureFullRecord/);
  assert.match(serverSource, /function toSummaryRecord/);
  assert.match(serverSource, /const summaryOnly = String\(query\.summary/);
  assert.match(serverSource, /record: row \? fromDatabaseRow\(row\) : null/);
});

test("v088 usa uma fonte central de versão em app, servidor, build e cache", () => {
  const versionSource = fs.readFileSync(new URL("./version.js", import.meta.url), "utf8");
  const buildSource = fs.readFileSync(new URL("./build.js", import.meta.url), "utf8");
  const pkg = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"));
  assert.match(versionSource, /app: "v088"/);
  assert.match(versionSource, /package: "0\.88\.0"/);
  assert.match(serverSource, /VERSION_INFO\.app/);
  assert.match(workerSource, /CORRETOR_PRO_VERSION/);
  assert.match(buildSource, /VERSION_INFO\.app/);
  assert.equal(pkg.version, "0.88.0");
});

test("v075 lê o print da conversa e mescla as mensagens na linha do tempo", () => {
  // O texto lido do print é convertido em itens de timeline e mesclado no histórico.
  assert.match(appSource, /function parsePrintTranscript/);
  assert.match(appSource, /origem: "print"/);
  assert.match(appSource, /fingerprint: `print-\$\{stableHash\(base\)\}-\$\{occ\}`/);
  // processarPrintsENota mescla na timeline em vez de salvar como nota separada.
  const start = appSource.indexOf("async function processarPrintsENota");
  const end = appSource.indexOf("\n}", start);
  const fn = appSource.slice(start, end);
  assert.match(fn, /parsePrintTranscript\(textoIA, fresh\.nomeLead, fresh\.timeline\)/);
  assert.match(fn, /mergeTimeline\(fresh\.timeline \|\| \[\], printItems\)/);
  assert.doesNotMatch(fn, /saveNota\(fresh, conteudoFinal, "print"\)/);
  // Indicador fixo de prints anexados (sobrevive ao re-render automático).
  assert.match(appSource, /class="notas-pending"/);
  assert.match(appSource, /data-clear-prints/);
});

test("v075 unifica identidade do corretor e corrige plural de mensagens", () => {
  // Print e análise reaproveitam o nome real do corretor na conversa.
  assert.match(appSource, /function resolveConversationAuthors/);
  assert.match(appSource, /author = lado\.startsWith\("voc"\) \? brokerAuthor : clientAuthor/);
  assert.match(appSource, /const \{ brokerAuthor \} = resolveConversationAuthors\(timeline, record\.nomeLead\)/);
  // Não pode mais existir o plural errado "mensagems".
  assert.doesNotMatch(appSource, /mensagem\$\{[^}]*\? '' : 's'\}/);
  assert.doesNotMatch(appSource, /mensagem\$\{[^}]*\? " será considerada"/);
  // Cards de pendência e próximo passo não repetem o texto em "Ver detalhes".
  const secStart = appSource.indexOf("O que falta definir");
  const secEnd = appSource.indexOf("renderFullAnalysisDetails", secStart);
  const sec = appSource.slice(secStart, secEnd);
  assert.doesNotMatch(sec, /analysis\.pendenciaReal \|\| analysis\.pendenciaFinanceira \|\| 'Não identificado'/);
  assert.doesNotMatch(sec, /analysis\.proximoPasso \|\| 'Não identificado'/);
});

test("v040 trata corretamente Todo o período nas mensagens de interface", () => {
  assert.match(appSource, /function periodSentenceLabel/);
  assert.match(appSource, /function selectedPeriodSentenceLabel/);
  assert.doesNotMatch(appSource, /nos últimos \$\{label\.toLowerCase\(\)\}/);
});

test("API de sincronização retorna cards leves e detalhe completo sob demanda", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oldFetch = globalThis.fetch;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

  const row = {
    id: "lead-id",
    device_id: "corretor-pro-site",
    conversation_key: "lead-1",
    nome_lead: "Lead 1",
    arquivo_origem: "Conversa.zip",
    ultima_mensagem_at: "2026-06-26T12:00:00.000Z",
    ultima_mensagem_resumo: "Mensagem recente",
    timeline: [{ fingerprint: "x", text: "Histórico completo" }],
    metadata: {
      statusAtendimento: "aguardando_resposta",
      conversationDna: "abc123",
      propostaImagem: { dataUrl: "data:image/jpeg;base64,AAAA" },
      analiseComercial: { resumo: "pesado" }
    },
    created_at: "2026-06-25T12:00:00.000Z",
    updated_at: "2026-06-26T12:00:00.000Z"
  };
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    return { ok: true, async json() { return [row]; } };
  };

  try {
    const summary = await invoke({
      method: "GET",
      url: "/api/atendimentos?device_id=corretor-pro-site&summary=1"
    });
    assert.equal(summary.status, 200);
    assert.equal(summary.payload.records[0]._summaryOnly, true);
    assert.equal(summary.payload.records[0].timeline, undefined);
    assert.equal(summary.payload.records[0].metadata.propostaImagem, undefined);
    assert.match(urls[0], /select=id%2Cdevice_id%2Cconversation_key/);
    assert.doesNotMatch(urls[0], /timeline/);

    const detail = await invoke({
      method: "GET",
      url: "/api/atendimentos?device_id=corretor-pro-site&conversation_key=lead-1"
    });
    assert.equal(detail.status, 200);
    assert.equal(detail.payload.record.timeline.length, 1);
    assert.equal(detail.payload.record.metadata.propostaImagem.dataUrl, "data:image/jpeg;base64,AAAA");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});
