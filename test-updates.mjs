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

test("v030 mantém atualização automática e evita mistura de arquivos em cache", () => {
  assert.match(appSource, /const APP_VERSION = "v030"/);
  assert.match(appSource, /const CLOUD_WORKSPACE = "corretor-pro-site"/);
  assert.match(appSource, /AUTO_SYNC_INTERVAL_MS = 15000/);
  assert.match(appSource, /startAutomaticSync\(\)/);
  assert.doesNotMatch(htmlSource, /sync-dialog/);
  assert.doesNotMatch(appSource, /data-sync-open/);
  assert.match(workerSource, /corretor-pro-v030/);
  assert.match(htmlSource, /app\.js\?v=030/);
  assert.match(htmlSource, /styles\.css\?v=030/);
  assert.match(appSource, /db\.js\?v=030/);
  assert.match(appSource, /whatsapp\.js\?v=030/);
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

test("versão v030 aparece no cabeçalho superior", () => {
  assert.match(htmlSource, /id="header-version"[^>]*>v030<\/span>/);
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
  assert.match(serverSource, /efetivamente ENVIADA ao contato desta conversa/);
  assert.match(serverSource, /detail: "high"/);
  assert.match(serverSource, /gpt-5\.4-mini/);
  assert.match(serverSource, /type: "json_schema"/);
  assert.match(serverSource, /mensagensSugeridas/);
  assert.match(appSource, /data-copy-suggestion/);
});

test("inteligência comercial parte da proposta já enviada e não reinicia a negociação", () => {
  assert.match(serverSource, /AÇÃO COMERCIAL MAIS RECENTE/);
  assert.match(serverSource, /STATUS DO COMPROMISSO DE ENVIAR CONDIÇÕES/);
  assert.match(serverSource, /CUMPRIDO EM RELAÇÃO AO/);
  assert.match(serverSource, /Nunca use como próximo passo/);
  assert.match(serverSource, /Na primeira simulação que te enviei/);
  assert.match(serverSource, /O mesmo imóvel não pode aparecer ao mesmo tempo como produto principal e produto paralelo/);
  assert.match(serverSource, /Não reabra comparação com outros imóveis/);
  assert.match(serverSource, /Não transforme confusão de preço sobre outro imóvel/);
  assert.match(serverSource, /nenhum campo nem sugestão trata a proposta como ainda não enviada/);
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

test("v030 reduz a análise visível e mantém detalhes recolhidos", () => {
  assert.match(appSource, /analysis-compact-grid/);
  assert.match(appSource, /Leitura atual/);
  assert.match(appSource, /O que falta definir/);
  assert.match(appSource, /Próximo passo/);
  assert.match(appSource, /<details class="analysis-details">/);
  assert.match(appSource, /Ver análise completa/);
  assert.match(stylesSource, /\.analysis-compact-grid/);
  assert.match(stylesSource, /\.analysis-details summary/);
});

test("v030 substitui aviso genérico por confirmação discreta e só mostra alerta acionável", () => {
  assert.match(appSource, /getActionableAnalysisAlert/);
  assert.match(appSource, /Proposta analisada com sucesso/);
  assert.match(appSource, /analysis-status-success/);
  assert.match(appSource, /actionableAlert \? `<div class="analysis-alert"/);
  assert.match(serverSource, /retorne uma string vazia quando não houver falta de informação/);
  assert.match(serverSource, /Não use esse campo para confirmar que a proposta foi lida/);
  assert.match(stylesSource, /\.analysis-status-success/);
});

test("v030 mantém sugestões visíveis e numeradas fora da análise completa", () => {
  assert.match(appSource, /class="suggestions-panel"/);
  assert.match(appSource, /class="suggestion-number"/);
  assert.match(appSource, /data-copy-suggestion/);
  assert.match(stylesSource, /\.suggestions-panel/);
  assert.match(stylesSource, /grid-template-columns: 25px minmax\(0, 1fr\) auto/);
});


test("v030 registra Atendido agora imediatamente e inicia espera de 48 horas", () => {
  assert.match(appSource, /data-attended-now/);
  assert.match(appSource, /async function markAttendedNow/);
  assert.match(appSource, /async function registerLeadAttended/);
  assert.match(appSource, /statusAtendimento: "aguardando_resposta"/);
  assert.match(appSource, /atendidoAgoraAt: now/);
  assert.match(appSource, /reanaliseDisponivelEm: reanalysisAvailableAt/);
  assert.match(appSource, /REANALYSIS_WAIT_MS = 48 \* 60 \* 60 \* 1000/);
  assert.match(appSource, /Aguardando resposta do cliente/);
  assert.match(appSource, /class="attendance-status"/);
  assert.match(stylesSource, /\.attended-now-button/);
  assert.match(stylesSource, /\.attendance-card\.waiting-client/);

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

test("durante 48 horas o sistema não oferece nova análise", () => {
  assert.match(appSource, /workflow\.mode === "waiting"/);
  assert.match(appSource, /analysis-waiting-badge/);
  assert.match(appSource, /Aguarde a resposta do cliente/);
  assert.match(appSource, /Reanalisar para retomada/);
  assert.match(appSource, /startWaitingStatusTimer/);
  assert.match(stylesSource, /\.analysis-waiting-badge/);
});

test("reimportação diferencia mensagem do corretor e resposta do contato usando o horário real", () => {
  assert.match(appSource, /const addedWithTime = merged\.addedItems/);
  assert.match(appSource, /timelineItemTimestamp\(latestAddedItem\)/);
  assert.match(appSource, /isClientTimelineItem\(latestAddedItem, originalLeadName\)/);
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
  assert.match(serverSource, /Não trate o corretor parceiro como comprador/);
  assert.match(serverSource, /As mensagens sugeridas devem ser dirigidas ao corretor parceiro/);
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

test("v030 mostra o horário da movimentação uma única vez no card", () => {
  const renderListStart = appSource.indexOf("function renderList()");
  const renderListEnd = appSource.indexOf("function groupTimelineByDate", renderListStart);
  const renderListSource = appSource.slice(renderListStart, renderListEnd);
  const statusStart = renderListSource.indexOf("const statusText");
  const statusEnd = renderListSource.indexOf("const statusClass", statusStart);
  const statusSource = renderListSource.slice(statusStart, statusEnd);
  assert.match(statusSource, /\? getContactRoleText\(record, "waiting"\)/);
  assert.match(statusSource, /getContactType\(record\) === "corretor" \? "" : getContactRoleText\(record, "new"\)/);
  assert.match(renderListSource, /<span class="attendance-time">/);
  assert.doesNotMatch(statusSource, /moment\.date|moment\.time|formatAttendedNowLabel/);
  assert.doesNotMatch(statusSource, /Retomada disponível · 48h sem resposta/);
});



test("v030 remove apenas o status de nova mensagem do corretor parceiro no card", () => {
  const renderListStart = appSource.indexOf("function renderList()");
  const renderListEnd = appSource.indexOf("function groupTimelineByDate", renderListStart);
  const renderListSource = appSource.slice(renderListStart, renderListEnd);
  assert.match(renderListSource, /getContactType\(record\) === "corretor" \? "" : getContactRoleText\(record, "new"\)/);
  assert.match(appSource, /if \(form === "new"\) return broker \? "Nova mensagem do corretor parceiro" : "Nova resposta do cliente"/);
});

test("v030 mostra inteligência comercial antes do contexto financeiro", () => {
  const renderStart = appSource.indexOf("function renderDetail(record)");
  const renderEnd = appSource.indexOf("async function renderRoute", renderStart);
  const renderSource = appSource.slice(renderStart, renderEnd);
  const analysisPosition = renderSource.indexOf("${renderAnalysisSection(record)}");
  const proposalPosition = renderSource.indexOf("${renderProposalSection(record)}");
  assert.ok(analysisPosition >= 0);
  assert.ok(proposalPosition > analysisPosition);
});

test("v030 aumenta a fonte das sugestões de resposta", () => {
  assert.match(stylesSource, /\.suggestion-body strong \{[\s\S]*font-size: 13px;/);
  assert.match(stylesSource, /\.suggestions-panel \.suggestion-card p \{[\s\S]*font-size: 14px;[\s\S]*line-height: 1\.65;/);
});
