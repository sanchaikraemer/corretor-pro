import {
  deleteAtendimento,
  getAtendimento,
  getCachedTranscription,
  getPendingShare,
  listAtendimentos,
  removePendingShare,
  saveAtendimento,
  saveCachedTranscription
} from "./db.js?v=083";
import {
  inferLeadName,
  initials,
  makeConversationKey,
  normalizeFileName,
  parseWhatsappTxt
} from "./whatsapp.js?v=083";

const app = document.querySelector("#app");
const backButton = document.querySelector("#back-button");
const brandButton = document.querySelector("#brand-button");
const installButton = document.querySelector("#install-button");
const headerVersion = document.querySelector("#header-version");
const editNameButton = document.querySelector("#edit-name-button");
const detailHeader = document.querySelector("#detail-header");
const detailHeaderTitle = document.querySelector("#detail-header-title");
const detailHeaderSubtitle = document.querySelector("#detail-header-subtitle");
const processingOverlay = document.querySelector("#processing-overlay");
const processingTitle = document.querySelector("#processing-title");
const processingDescription = document.querySelector("#processing-description");
const progressBar = document.querySelector("#progress-bar");
const progressLabel = document.querySelector("#progress-label");
const processingLive = document.querySelector("#processing-live");
const processingCurrent = document.querySelector("#processing-current");
const processingCount = document.querySelector("#processing-count");
const processingElapsed = document.querySelector("#processing-elapsed");
const audioPeriodPanel = document.querySelector("#audio-period-panel");
const audioPeriodSummary = document.querySelector("#audio-period-summary");
const audioPeriodContinueButton = document.querySelector("#audio-period-continue");
const cancelImportButton = document.querySelector("#cancel-import-button");
const toast = document.querySelector("#toast");
const renameDialog = document.querySelector("#rename-dialog");
const renameForm = document.querySelector("#rename-form");
const renameInput = document.querySelector("#rename-input");
const addLeadDialog = document.querySelector("#add-lead-dialog");
const addLeadForm = document.querySelector("#add-lead-form");
const leadCount = document.querySelector("#lead-count");

const VERSION_INFO = globalThis.CORRETOR_PRO_VERSION || { app: "v083", package: "0.83.0" };
const APP_VERSION = VERSION_INFO.app;
const APP_USER_NAME = (localStorage.getItem("corretorProUserName") || "Sanchai").trim();
const APP_USER_ALIASES = new Set([normalizeComparable(APP_USER_NAME), "sanchai", "voce", "você"]);
const CLOUD_WORKSPACE = (localStorage.getItem("corretorProWorkspace") || "corretor-pro-site").trim();
const AUTO_SYNC_INTERVAL_MS = 15000;
const MAX_TRANSCRIPTION_ATTEMPTS = 3;
const TRANSCRIPTION_RETRY_DELAY_MS = 1200;
const MAX_PROPOSAL_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_PROPOSAL_DATA_URL_LENGTH = 1_800_000;
const MAX_PROPOSAL_DIMENSION = 2000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const AUDIO_MAX_BYTES = 12 * 1024 * 1024;
const PROCESSING_STEPS = ["read", "audio", "transcribe", "timeline", "save"];
const AUDIO_IMPORT_PERIODS = [
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
  { value: "all", label: "Todo o período" }
];
const state = {
  records: [],
  remoteSummaries: new Map(),
  currentKey: null,
  installPrompt: null,
  processing: false,
  toastTimer: null,
  syncing: false,
  syncTimer: null,
  cloudAvailable: null,
  detailPeriod: "30",
  deletingKeys: new Set(),
  analyzingKey: null,
  proposalBusy: false,
  processingStartedAt: null,
  processingElapsedTimer: null,
  importAbortController: null,
  importCancelled: false,
  audioPeriodSelection: "90",
  audioPeriodResolver: null,
  audioPeriodCandidates: [],
  audioPeriodReferenceTimestamp: null,
  notaMediaRecorder: null,
  notaRecordingKey: null,
  notaRecordingChunks: [],
  _notaRecog: null,
  notaPrintsPendentes: []
};

const dateOnlyFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});
const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit"
});
const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit"
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeComparable(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isOwnTimelineItem(item) {
  const author = normalizeComparable(item?.author);
  return Boolean(author && APP_USER_ALIASES.has(author));
}

function isClientTimelineItem(item) {
  const author = normalizeComparable(item?.author);
  // Em conversa individual do WhatsApp, todo autor que não seja o usuário do
  // app é o contato atendido — não há terceiros na exportação.
  return Boolean(author) && !isOwnTimelineItem(item);
}

// Descobre como o corretor e o cliente já aparecem nomeados na conversa (ex.: o
// corretor pode estar como "Construtora Senger" no export). Serve para que itens
// vindos do print reusem exatamente os mesmos nomes, sem criar identidade dupla.
function resolveConversationAuthors(timeline, leadName) {
  const counts = new Map();
  for (const item of timeline || []) {
    const author = String(item?.author || "").trim();
    if (author) counts.set(author, (counts.get(author) || 0) + 1);
  }
  const leadNorm = normalizeComparable(leadName);
  let clientAuthor = null;
  let brokerAuthor = null;
  for (const author of counts.keys()) {
    if (isOwnTimelineItem({ author })) { brokerAuthor = author; break; }
  }
  for (const author of counts.keys()) {
    if (normalizeComparable(author) === leadNorm) { clientAuthor = author; break; }
  }
  // O corretor é o autor que não é o cliente (conversa 1:1 tem só dois lados).
  if (!brokerAuthor) {
    for (const author of counts.keys()) {
      if (author !== clientAuthor) { brokerAuthor = author; break; }
    }
  }
  if (!clientAuthor) {
    for (const author of counts.keys()) {
      if (author !== brokerAuthor) { clientAuthor = author; break; }
    }
  }
  return {
    clientAuthor: clientAuthor || leadName || "Cliente",
    brokerAuthor: brokerAuthor || "Você"
  };
}

function stableHash(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function makeConversationDna(timeline) {
  const items = Array.isArray(timeline) ? timeline.filter(Boolean) : [];
  const anchors = items.slice(0, 12).map(item => {
    const content = item.type === "audio" ? item.audioFile : item.text;
    return [
      item.timestamp || "",
      normalizeComparable(item.author),
      item.type || "message",
      normalizeComparable(content)
    ].join("|");
  });
  return stableHash(anchors.join("||"));
}

function timelineOverlap(existingTimeline, incomingTimeline) {
  const existing = new Set((existingTimeline || []).map(item => item?.fingerprint).filter(Boolean));
  if (!existing.size) return 0;
  let overlap = 0;
  for (const item of incomingTimeline || []) {
    if (item?.fingerprint && existing.has(item.fingerprint)) overlap += 1;
  }
  return overlap;
}

function sameOriginalContact(record, originalLeadName) {
  const savedName = record?.metadata?.originalLeadName || record?.nomeLead;
  return normalizeComparable(savedName) === normalizeComparable(originalLeadName);
}

async function resolveConversationIdentity(originalLeadName, parsedTimeline) {
  const dna = makeConversationDna(parsedTimeline);
  const baseKey = makeConversationKey(originalLeadName);
  const localRecords = await listAtendimentos();
  const allCandidates = [...localRecords];

  for (const summary of state.remoteSummaries.values()) {
    if (summary?.metadata?.deletedAt) continue;
    if (!allCandidates.some(item => item.conversationKey === summary.conversationKey)) {
      allCandidates.push(summary);
    }
  }

  const sameName = allCandidates.filter(record => !record?.metadata?.deletedAt && sameOriginalContact(record, originalLeadName));
  let matched = sameName.find(record => record?.metadata?.conversationDna === dna) || null;

  if (!matched) {
    const withTimeline = sameName.filter(candidate => Array.isArray(candidate.timeline));
    const summaryOnly = sameName.filter(candidate => candidate?._summaryOnly);
    const fetched = await Promise.all(
      summaryOnly.map(candidate => fetchRemoteRecord(candidate.conversationKey))
    );
    const detailedCandidates = [...withTimeline, ...fetched.filter(Boolean)];
    const scored = detailedCandidates
      .map(record => ({ record, overlap: timelineOverlap(record.timeline, parsedTimeline) }))
      .sort((a, b) => b.overlap - a.overlap);
    const best = scored[0];
    const minimumOverlap = Math.min(3, Math.max(1, Math.ceil(parsedTimeline.length * 0.05)));
    if (best?.overlap >= minimumOverlap) matched = best.record;
  }

  if (matched?._summaryOnly) {
    matched = await fetchRemoteRecord(matched.conversationKey) || matched;
  }

  if (matched && Array.isArray(matched.timeline)) {
    return { conversationKey: matched.conversationKey, existing: matched, dna };
  }

  const legacy = await getAtendimento(baseKey);
  if (legacy && timelineOverlap(legacy.timeline, parsedTimeline) > 0) {
    return { conversationKey: legacy.conversationKey, existing: legacy, dna };
  }

  const keyAlreadyUsed = allCandidates.some(record => record.conversationKey === baseKey);
  return {
    conversationKey: keyAlreadyUsed ? `${baseKey}-${dna}` : baseKey,
    existing: null,
    dna
  };
}

function getContactType(record) {
  const type = record?.metadata?.tipoContato;
  return type === "cliente" || type === "corretor" ? type : null;
}

function getContactRoleText(record, form = "response") {
  const broker = getContactType(record) === "corretor";
  if (form === "waiting") return broker ? "Aguardando resposta do corretor parceiro" : "Aguardando resposta do cliente";
  if (form === "new") return broker ? "Última interação do corretor parceiro" : "Última interação do lead";
  if (form === "target") return broker ? "ao corretor parceiro" : "ao cliente";
  return broker ? "corretor parceiro" : "cliente";
}

function latestContactMessageDate(record) {
  const originalLeadName = record?.metadata?.originalLeadName || record?.nomeLead;
  const timestamps = (record?.timeline || [])
    .filter(item => isClientTimelineItem(item))
    .map(timelineItemTimestamp)
    .filter(Number.isFinite);
  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps));
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function getRouteKey() {
  const match = location.hash.match(/^#\/atendimento\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function navigateToList() {
  if (location.hash) {
    location.hash = "#/";
  } else {
    renderRoute();
  }
}

function navigateToAttendance(key) {
  location.hash = `#/atendimento/${encodeURIComponent(key)}`;
}

function cleanShareQuery() {
  const url = new URL(location.href);
  url.searchParams.delete("recebido");
  url.searchParams.delete("share_error");
  history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function showToast(message, type = "normal", duration = 4200) {
  clearTimeout(state.toastTimer);
  toast.textContent = message;
  toast.className = `toast${type === "error" ? " error" : ""}`;
  toast.hidden = false;
  state.toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, duration);
}

function formatElapsedTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateProcessingElapsed() {
  if (!processingElapsed || !state.processingStartedAt) return;
  processingElapsed.textContent = `Tempo decorrido: ${formatElapsedTime(Date.now() - state.processingStartedAt)}`;
}

function setProcessingTelemetry(current, count = "") {
  if (processingLive) processingLive.hidden = false;
  if (processingCurrent) processingCurrent.textContent = current || "Processando...";
  if (processingCount) processingCount.textContent = count;
}

function setProcessing(step, percent, description, title = "Processando conversa") {
  processingTitle.textContent = title;
  processingDescription.textContent = description;
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  progressBar.style.width = `${safePercent}%`;
  progressBar.parentElement?.setAttribute("aria-valuenow", String(safePercent));
  progressLabel.textContent = `${safePercent}%`;

  const activeIndex = PROCESSING_STEPS.indexOf(step);
  document.querySelectorAll(".processing-steps li").forEach((item, index) => {
    item.classList.toggle("done", index < activeIndex || safePercent === 100);
    item.classList.toggle("active", index === activeIndex && safePercent < 100);
  });
}

function setAudioPeriodSelection(value) {
  if (!AUDIO_IMPORT_PERIODS.some(option => option.value === value)) return;
  state.audioPeriodSelection = value;
  audioPeriodPanel?.querySelectorAll("[data-audio-import-period]").forEach(button => {
    const active = button.dataset.audioImportPeriod === value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  updateAudioPeriodSummary();
}

function getLatestTimelineTimestamp(timeline) {
  const timestamps = (timeline || []).map(timelineItemTimestamp).filter(Number.isFinite);
  return timestamps.length ? Math.max(...timestamps) : Date.now();
}

function isAudioWithinSelectedPeriod(item, period = state.audioPeriodSelection, referenceTimestamp = state.audioPeriodReferenceTimestamp) {
  if (period === "all") return true;
  const timestamp = timelineItemTimestamp(item);
  if (!Number.isFinite(timestamp)) return true;
  const reference = Number.isFinite(referenceTimestamp) ? referenceTimestamp : Date.now();
  const cutoff = reference - (Number(period) * 24 * 60 * 60 * 1000);
  return timestamp >= cutoff;
}

function periodSentenceLabel(value) {
  if (value === "all" || value === "Todo o período") return "todo o período";
  const label = AUDIO_IMPORT_PERIODS.find(option => option.value === value)?.label || String(value || "90 dias");
  return `os últimos ${label.toLowerCase()}`;
}

function selectedPeriodSentenceLabel() {
  return state.detailPeriod === "all" ? "todo o período" : `os últimos ${selectedPeriodLabel().toLowerCase()}`;
}

function updateAudioPeriodSummary() {
  if (!audioPeriodSummary) return;
  const total = state.audioPeriodCandidates.length;
  const selected = state.audioPeriodCandidates.filter(item => isAudioWithinSelectedPeriod(item)).length;
  const periodLabel = periodSentenceLabel(state.audioPeriodSelection);
  audioPeriodSummary.textContent = total
    ? `${selected} de ${total} áudio${total === 1 ? "" : "s"} novo${total === 1 ? "" : "s"} serão transcritos considerando ${periodLabel}.`
    : "Nenhum áudio novo ou com falha precisa ser transcrito.";
}

function waitForAudioPeriodSelection(candidates, referenceTimestamp) {
  state.audioPeriodCandidates = candidates;
  state.audioPeriodReferenceTimestamp = referenceTimestamp;
  setAudioPeriodSelection("90");
  if (audioPeriodPanel) audioPeriodPanel.hidden = false;
  if (processingLive) processingLive.hidden = true;
  setProcessing("audio", 1, "Escolha o período dos áudios. Todas as mensagens escritas serão importadas.", "Selecionar período dos áudios");
  return new Promise(resolve => {
    state.audioPeriodResolver = resolve;
  });
}

function createImportCancelledError() {
  const error = new Error("Importação cancelada.");
  error.code = "IMPORT_CANCELLED";
  return error;
}

function throwIfImportCancelled() {
  if (state.importCancelled) throw createImportCancelledError();
}

function showProcessing() {
  state.processing = true;
  state.importCancelled = false;
  state.importAbortController = new AbortController();
  state.processingStartedAt = Date.now();
  state.audioPeriodSelection = "90";
  state.audioPeriodCandidates = [];
  state.audioPeriodReferenceTimestamp = null;
  processingOverlay.hidden = false;
  if (audioPeriodPanel) audioPeriodPanel.hidden = true;
  if (processingLive) processingLive.hidden = false;
  if (cancelImportButton) {
    cancelImportButton.disabled = false;
    cancelImportButton.textContent = "Cancelar importação";
  }
  document.body.style.overflow = "hidden";
  clearInterval(state.processingElapsedTimer);
  state.processingElapsedTimer = setInterval(updateProcessingElapsed, 1000);
  updateProcessingElapsed();
  setProcessingTelemetry("Abrindo o arquivo recebido", "Preparando a conversa");
  setProcessing("read", 0, "Abrindo o arquivo enviado pelo WhatsApp.", "Processando conversa");
}

function hideProcessing() {
  state.processing = false;
  clearInterval(state.processingElapsedTimer);
  state.processingElapsedTimer = null;
  state.processingStartedAt = null;
  state.importAbortController = null;
  state.audioPeriodResolver = null;
  state.audioPeriodCandidates = [];
  processingOverlay.hidden = true;
  if (audioPeriodPanel) audioPeriodPanel.hidden = true;
  document.body.style.overflow = "";
}

async function cancelCurrentImport() {
  if (!state.processing || state.importCancelled || cancelImportButton?.disabled) return;
  state.importCancelled = true;
  state.importAbortController?.abort();
  state.audioPeriodResolver?.(null);
  state.audioPeriodResolver = null;
  if (cancelImportButton) {
    cancelImportButton.disabled = true;
    cancelImportButton.textContent = "Cancelando...";
  }
  setProcessingTelemetry("Interrompendo o processamento", "Nenhum atendimento parcial será salvo");
  processingTitle.textContent = "Cancelando importação";
  processingDescription.textContent = "Aguarde enquanto encerramos a leitura com segurança.";
}

function formatCardDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const dateLabel = sameDay
    ? "Hoje"
    : date.toDateString() === yesterday.toDateString()
      ? "Ontem"
      : shortDateFormatter.format(date);
  return { date: dateLabel, time: timeFormatter.format(date) };
}

function getAttendedNowDate(record) {
  if (record?.metadata?.statusAtendimento !== "aguardando_resposta") return null;
  const date = new Date(record.metadata?.atendidoAgoraAt || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function getValidDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLatestActivityDate(record) {
  const candidates = [
    record?.metadata?.ultimaMovimentacaoAt,
    record?.metadata?.atendidoAgoraAt,
    record?.ultimaMensagemAt,
    record?.createdAt
  ]
    .map(getValidDate)
    .filter(Boolean);

  if (!candidates.length) return new Date();
  return candidates.reduce((latest, current) => current.getTime() > latest.getTime() ? current : latest);
}

function getLeadWorkflowState(record) {
  const status = record?.metadata?.statusAtendimento;
  const activityDate = getLatestActivityDate(record);

  if (status === "nova_resposta_cliente") {
    const responseDate = latestContactMessageDate(record)
      || getValidDate(record?.metadata?.novaRespostaClienteAt)
      || getValidDate(record?.ultimaMensagemAt)
      || activityDate;
    return { mode: "client_response", activityDate: responseDate, responseDate };
  }

  if (status === "aguardando_resposta") {
    const waitingDate = getAttendedNowDate(record) || activityDate;
    return { mode: "waiting", activityDate: waitingDate };
  }

  return { mode: "idle", activityDate };
}

function classifyLead(record) {
  const status = record?.metadata?.statusAtendimento;
  if (status !== "aguardando_resposta") return "responder";
  const refDate = getValidDate(record?.metadata?.atendidoAgoraAt) || getLatestActivityDate(record);
  return Date.now() - refDate.getTime() >= SEVEN_DAYS_MS ? "esfriando" : "aguardar";
}
function daysSince(date) {
  const valid = date instanceof Date ? date : getValidDate(date);
  if (!valid) return 0;
  return Math.max(0, Math.floor((Date.now() - valid.getTime()) / (24 * 60 * 60 * 1000)));
}

function getCommercialTemperature(record) {
  const analysis = record?.metadata?.analiseComercial || {};
  const workflow = getLeadWorkflowState(record);
  let score = 36;
  const interest = normalizeComparable(analysis.nivelInteresse || analysis.interesse || "");
  const stage = normalizeComparable(analysis.etapa || "");
  const summary = normalizeComparable([
    analysis.resumo,
    analysis.pendenciaReal,
    analysis.pendenciaFinanceira,
    analysis.proximoPasso,
    analysis.ultimaSolicitacaoCliente,
    analysis.ultimoCompromissoCliente,
    analysis.ultimoCompromissoCorretor,
    analysis.porqueNaoComprou,
    analysis.oQueFaltaParaFechar,
    ...(Array.isArray(analysis.sinaisInteresse) ? analysis.sinaisInteresse : [])
  ].filter(Boolean).join(" "));
  const age = daysSince(workflow.activityDate);

  if (workflow.mode === "client_response") score += 18;
  if (workflow.mode === "waiting") score -= Math.min(24, age * 2.5);
  if (classifyLead(record) === "esfriando") score += 6;
  if (interest.includes("muito alto")) score += 18;
  else if (interest.includes("alto")) score += 14;
  if (interest.includes("medio")) score += 8;
  if (interest.includes("baixo")) score -= 16;
  if (/negociacao|proposta|analise financeira|decisao|fechamento|visita/.test(stage)) score += 10;
  if (/entrada|financiamento|fgts|parcela|valor|proposta|contrato|visita|cafe|reuniao|simulacao|chaves/.test(summary)) score += 8;
  if (/comprar|fechar|gostei|queremos|reserva|documento|aprovacao/.test(summary)) score += 6;
  if (record?.metadata?.propostaImagem) score += 5;
  if (!analysis.generatedAt) score -= 18;

  const hasHardClosingSignal = /reserva|contrato|documento|aprovacao|fechar|comprar|visita marcada|cafe marcado/.test(summary);
  const cap = hasHardClosingSignal ? 92 : workflow.mode === "client_response" ? 86 : 82;
  return Math.max(0, Math.min(cap, Math.round(score)));
}

function getTemperatureLabel(record) {
  const workflow = getLeadWorkflowState(record);
  if (!record?.metadata?.analiseComercial) return "Sem análise";
  if (workflow.mode === "client_response") return "Responder";
  const score = getCommercialTemperature(record);
  if (score >= 78) return "Alta";
  if (score >= 58) return "Média";
  return "Baixa";
}

function getCommercialPriority(record) {
  const workflow = getLeadWorkflowState(record);
  const score = getCommercialTemperature(record);
  if (workflow.mode === "client_response") return { label: "Responder agora", className: "hot" };
  if (!record?.metadata?.analiseComercial) return { label: "Analisar primeiro", className: "warm" };
  if (classifyLead(record) === "esfriando") return { label: "Retomar hoje", className: "warm" };
  if (score >= 78) return { label: "Oportunidade forte", className: "hot" };
  if (score >= 58) return { label: "Acompanhar", className: "warm" };
  return { label: "Organizado", className: "cool" };
}

function getActionRank(record) {
  const workflow = getLeadWorkflowState(record);
  if (workflow.mode === "client_response") return 4000 + getCommercialTemperature(record);
  if (!record?.metadata?.analiseComercial) return 3000 + daysSince(getLatestActivityDate(record));
  if (classifyLead(record) === "esfriando") return 2000 + getCommercialTemperature(record);
  return getCommercialTemperature(record);
}

function getCommercialReason(record) {
  const analysis = record?.metadata?.analiseComercial;
  const workflow = getLeadWorkflowState(record);
  if (!analysis) return "Sem análise: abra o atendimento e gere a leitura comercial.";
  if (workflow.mode === "client_response") return "O cliente respondeu depois da última movimentação. A prioridade é continuar exatamente do ponto em que ele parou.";
  if (classifyLead(record) === "esfriando") return "Você já movimentou esse atendimento, mas ele está parado há dias. Retomar com gancho específico evita perder timing.";
  if (record?.metadata?.propostaImagem) return "Existe proposta anexada. A retomada deve medir reação e ajustar a composição, não reenviar os mesmos números.";
  const gatilho = String(analysis.gatilhoPrincipal || "").trim();
  if (gatilho && !/não identificado/i.test(gatilho)) return `Gatilho de decisão: ${gatilho}.`;
  const pending = String(analysis.pendenciaReal || analysis.pendenciaFinanceira || analysis.proximoPasso || "").trim();
  if (pending) return pending;
  return String(analysis.resumo || "Atendimento organizado para acompanhamento.").trim();
}

function getNextActionLabel(record) {
  const analysis = record?.metadata?.analiseComercial;
  const workflow = getLeadWorkflowState(record);
  if (!analysis) return "Gerar análise";
  if (workflow.mode === "client_response") return "Responder";
  if (classifyLead(record) === "esfriando") return "Retomar";
  if (getCommercialTemperature(record) >= 75) return "Conduzir";
  return "Abrir";
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getLeadActionText(record) {
  const analysis = record?.metadata?.analiseComercial || {};
  if (!record?.metadata?.analiseComercial) return "Gerar análise comercial";
  const action = String(analysis.proximoPasso || analysis.pendenciaReal || analysis.pendenciaFinanceira || "Abrir atendimento").trim();
  return action.length > 92 ? `${action.slice(0, 89).trim()}...` : action;
}

function renderDashboard(records) {
  const actionQueue = [...records]
    .filter(record => getLeadWorkflowState(record).mode === "client_response" || classifyLead(record) === "esfriando" || !record?.metadata?.analiseComercial)
    .sort((a, b) => getActionRank(b) - getActionRank(a));
  const totalAction = actionQueue.length;
  const top = actionQueue.slice(0, 2);
  const leadWord = totalAction === 1 ? "cliente" : "clientes";
  const actionWord = totalAction === 1 ? "merece" : "merecem";

  const cards = top.map(record => {
    const priority = getCommercialPriority(record);
    const action = getLeadActionText(record);
    const suggestion = record?.metadata?.analiseComercial?.mensagensSugeridas?.[0]?.mensagem || "";
    return `<article class="cp-opportunity cp-opportunity--${escapeHtml(priority.className)}">
      <button class="cp-opportunity-open" type="button" data-attendance="${escapeHtml(record.conversationKey)}" aria-label="Abrir ${escapeHtml(record.nomeLead)}">
        <span class="cp-status-line">${escapeHtml(priority.label || getNextActionLabel(record))}</span>
        <strong>${escapeHtml(record.nomeLead)}</strong>
        <small>${escapeHtml(action)}</small>
      </button>
      ${suggestion ? `<button class="cp-copy-mini" type="button" data-copy-home-suggestion="${escapeHtml(record.conversationKey)}">Copiar</button>` : `<button class="cp-copy-mini" type="button" data-attendance="${escapeHtml(record.conversationKey)}">Abrir</button>`}
    </article>`;
  }).join("");

  return `
    <section class="cp-home-hero v2-home-command" aria-label="Central de decisão">
      <p class="cp-kicker">Central de decisão</p>
      <h1>${totalAction ? `${totalAction} ${leadWord} ${actionWord} atenção agora.` : "A fila está sob controle."}</h1>
      <p class="cp-hero-subtitle">Entre no primeiro atendimento, copie a mensagem e movimente. O restante fica em segundo plano.</p>
      ${cards ? `<div class="cp-opportunity-list v2-action-queue">${cards}</div>` : `<div class="cp-empty-focus">Nenhuma ação urgente detectada. Importe uma conversa ou analise os atendimentos sem leitura.</div>`}
      <button class="cp-link-button v2-show-all" type="button" data-show-all-leads>Mostrar todos os atendimentos</button>
    </section>`;
}

function formatAttendedNowLabel(record, compact = false) {
  const date = getAttendedNowDate(record);
  if (!date) return "";
  const moment = formatCardDate(date.toISOString());
  if (compact) return `${moment.date.toLowerCase()} às ${moment.time}`;
  return `Atendido ${moment.date.toLowerCase()} às ${moment.time}`;
}

const DETAIL_PERIODS = [
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
  { value: "all", label: "Todo período" }
];

function timelineItemTimestamp(item) {
  const direct = Date.parse(item?.timestamp || "");
  if (Number.isFinite(direct)) return direct;

  const match = String(item?.date || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  const [, dayText, monthText, yearText] = match;
  const [hourText = "0", minuteText = "0"] = String(item?.time || "00:00").split(":");
  const rawYear = Number(yearText);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const parsed = new Date(
    year,
    Number(monthText) - 1,
    Number(dayText),
    Number(hourText),
    Number(minuteText),
    0,
    0
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function filterTimelineByPeriod(timeline, period = state.detailPeriod) {
  const items = Array.isArray(timeline) ? timeline : [];
  if (period === "all") return items;

  const days = Number(period);
  if (![30, 60, 90].includes(days)) return items;

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffTime = cutoff.getTime();

  return items.filter(item => {
    const timestamp = timelineItemTimestamp(item);
    return timestamp !== null && timestamp >= cutoffTime;
  });
}

function selectedPeriodLabel() {
  return DETAIL_PERIODS.find(option => option.value === state.detailPeriod)?.label || "30 dias";
}

function formatTimelineForCopy(timeline) {
  return timeline.map(item => {
    const timestamp = timelineItemTimestamp(item);
    const date = item.date || (timestamp !== null ? dateOnlyFormatter.format(new Date(timestamp)) : "Sem data");
    const time = item.time || (timestamp !== null ? timeFormatter.format(new Date(timestamp)) : "");
    const author = String(item.author || "Sem identificação").trim();
    const audioLabel = item.type === "audio"
      ? item.transcriptionStatus === "done"
        ? "[Áudio transcrito] "
        : item.transcriptionStatus === "outside_period"
          ? "[Áudio fora do período] "
          : "[Áudio não transcrito] "
      : "";
    const text = String(item.text || "").trim();
    return `${date}${time ? ` ${time}` : ""} - ${author}: ${audioLabel}${text}`.trim();
  }).join("\n\n");
}

async function writeToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}


function isSafeProposalDataUrl(value) {
  return /^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(String(value || ""));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem da proposta."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A imagem selecionada não pôde ser aberta."));
    image.src = source;
  });
}

function proposalCanvasDataUrl(image, maxDimension, quality) {
  const largestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const scale = Math.min(1, maxDimension / Math.max(largestSide, 1));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Não foi possível preparar a imagem da proposta.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", quality),
    width,
    height
  };
}

async function prepareProposalImage(file) {
  if (!(file instanceof File)) throw new Error("Selecione uma imagem da proposta.");
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type || "")) {
    throw new Error("Use uma imagem JPG, PNG ou WebP.");
  }
  if (file.size > MAX_PROPOSAL_SOURCE_BYTES) {
    throw new Error("A imagem ultrapassa 12 MB. Faça um print menor e tente novamente.");
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImageElement(source);
  const dimensions = [MAX_PROPOSAL_DIMENSION, 1700, 1400, 1150];
  const qualities = [0.92, 0.84, 0.76, 0.68];
  let prepared = null;

  for (const dimension of dimensions) {
    for (const quality of qualities) {
      prepared = proposalCanvasDataUrl(image, dimension, quality);
      if (prepared.dataUrl.length <= MAX_PROPOSAL_DATA_URL_LENGTH) break;
    }
    if (prepared?.dataUrl.length <= MAX_PROPOSAL_DATA_URL_LENGTH) break;
  }

  if (!prepared || prepared.dataUrl.length > MAX_PROPOSAL_DATA_URL_LENGTH) {
    throw new Error("Não foi possível reduzir o print sem perder legibilidade. Recorte apenas a proposta e tente novamente.");
  }

  return {
    name: String(file.name || "proposta.jpg").slice(0, 160),
    type: "image/jpeg",
    dataUrl: prepared.dataUrl,
    width: prepared.width,
    height: prepared.height,
    attachedAt: new Date().toISOString(),
    consideredSent: true
  };
}

function updateRecordInState(record) {
  const index = state.records.findIndex(item => item.conversationKey === record.conversationKey);
  if (index >= 0) state.records[index] = record;
  else state.records.unshift(record);
  state.records.sort((a, b) => getLatestActivityDate(b).getTime() - getLatestActivityDate(a).getTime());
}

function isSummaryOnly(record) {
  return Boolean(record?._summaryOnly || !Array.isArray(record?.timeline));
}

function recordUpdatedTime(record) {
  return Date.parse(record?.updatedAt || 0) || 0;
}

async function fetchRemoteRecord(conversationKey) {
  if (!conversationKey) return null;
  try {
    const query = new URLSearchParams({
      device_id: CLOUD_WORKSPACE,
      conversation_key: conversationKey
    });
    const response = await fetch(`/api/atendimentos?${query}`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({}));
    return payload.record || null;
  } catch {
    return null;
  }
}

async function ensureFullRecord(conversationKey) {
  if (!conversationKey) return null;
  const local = await getAtendimento(conversationKey);
  const summary = state.remoteSummaries.get(conversationKey);
  const localIsCurrent = local && (!summary || recordUpdatedTime(local) >= recordUpdatedTime(summary));
  if (localIsCurrent && Array.isArray(local.timeline)) return local;

  if (summary && !summary.metadata?.deletedAt) {
    const remote = await fetchRemoteRecord(conversationKey);
    if (remote && Array.isArray(remote.timeline)) {
      // Preserva notas locais caso o registro remoto não as tenha (proteção contra overwrite)
      const localNotas = local?.metadata?.notasAtendimento;
      const remoteNotas = remote?.metadata?.notasAtendimento;
      const merged = (!Array.isArray(remoteNotas) || remoteNotas.length === 0) && Array.isArray(localNotas) && localNotas.length > 0
        ? { ...remote, metadata: { ...(remote.metadata || {}), notasAtendimento: localNotas } }
        : remote;
      await saveAtendimento(merged);
      updateRecordInState(merged);
      return merged;
    }
  }

  const inMemory = state.records.find(item => item.conversationKey === conversationKey);
  if (inMemory && !isSummaryOnly(inMemory)) return inMemory;
  return local || null;
}

async function getCurrentRecord() {
  if (!state.currentKey) return null;
  return ensureFullRecord(state.currentKey);
}

async function attachProposalImage(file) {
  if (state.proposalBusy) return;
  const record = await getCurrentRecord();
  if (!record) return;

  state.proposalBusy = true;
  renderDetail(record);
  try {
    const proposal = await prepareProposalImage(file);
    const now = new Date().toISOString();
    const metadata = {
      ...(record.metadata || {}),
      propostaImagem: proposal
    };
    delete metadata.analiseComercial;
    const updated = { ...record, metadata, updatedAt: now };
    await saveAtendimento(updated);
    updateRecordInState(updated);
    renderDetail(updated);
    showToast("Proposta anexada. Ela será considerada como já enviada ao cliente.");
    pushRemoteRecord(updated).then(result => {
      if (!result) showToast("A proposta ficou salva neste aparelho, mas a nuvem não confirmou a atualização.", "error", 7000);
    });
  } catch (error) {
    renderDetail(record);
    showToast(error?.message || "Não foi possível anexar a proposta.", "error", 7000);
  } finally {
    state.proposalBusy = false;
    const latest = await getCurrentRecord();
    if (latest) renderDetail(latest);
  }
}

function buildAnalysisRequest(record, timeline) {
  const proposal = record.metadata?.propostaImagem;
  const notas = Array.isArray(record.metadata?.notasAtendimento)
    ? record.metadata.notasAtendimento
    : [];
  // O corretor pode aparecer na conversa com um nome de perfil (ex.: "Construtora
  // Senger"). Passa esse nome real para a IA não tratar o próprio corretor como
  // um terceiro em "última pessoa a falar".
  const { brokerAuthor } = resolveConversationAuthors(timeline, record.nomeLead);
  const appUserName = brokerAuthor && !APP_USER_ALIASES.has(normalizeComparable(brokerAuthor))
    ? brokerAuthor
    : (record.metadata?.usuarioApp || APP_USER_NAME);
  return {
    leadName: record.nomeLead,
    appUserName,
    contactType: getContactType(record),
    period: selectedPeriodLabel(),
    messages: formatTimelineForCopy(timeline),
    messageCount: timeline.length,
    incompleteAudioCount: (timeline || []).filter(isAudioFailure).length,
    proposalImage: proposal && isSafeProposalDataUrl(proposal.dataUrl) ? proposal.dataUrl : null,
    proposalAttachedAt: proposal?.attachedAt || null,
    notasAtendimento: notas.length ? notas : undefined
  };
}

async function analyzeCurrentAttendance() {
  const record = await getCurrentRecord();
  if (!record || state.analyzingKey) return;
  if (!getContactType(record)) {
    showToast("Selecione primeiro se este contato é cliente ou corretor.", "error", 6500);
    return;
  }
  const timeline = filterTimelineByPeriod(record.timeline);
  const notas = Array.isArray(record.metadata?.notasAtendimento) ? record.metadata.notasAtendimento : [];
  if (!timeline.length && !notas.length) {
    showToast(`Não há mensagens nem notas para analisar.`, "error");
    return;
  }

  state.analyzingKey = record.conversationKey;
  renderDetail(record);
  try {
    const response = await fetch("/api/analisar", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(buildAnalysisRequest(record, timeline))
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.analysis) {
      throw new Error(payload.error || "Não foi possível analisar este atendimento.");
    }

    const now = new Date().toISOString();
    const updated = {
      ...record,
      metadata: {
        ...(record.metadata || {}),
        analiseComercial: {
          ...payload.analysis,
          generatedAt: now,
          period: selectedPeriodLabel(),
          messageCount: timeline.length,
          proposalAttachedAt: record.metadata?.propostaImagem?.attachedAt || null
        }
      },
      updatedAt: now
    };
    await saveAtendimento(updated);
    updateRecordInState(updated);
    renderDetail(updated);
    showToast("Análise concluída.");
    pushRemoteRecord(updated).catch(() => null);
  } catch (error) {
    renderDetail(record);
    showToast(error?.message || "Não foi possível analisar este atendimento.", "error", 8000);
  } finally {
    state.analyzingKey = null;
    const latest = await getCurrentRecord();
    if (latest) renderDetail(latest);
  }
}

async function copySuggestedMessage(index) {
  const record = await getCurrentRecord();
  const suggestions = record?.metadata?.analiseComercial?.mensagensSugeridas;
  const suggestion = Array.isArray(suggestions) ? suggestions[index] : null;
  const text = String(suggestion?.mensagem || "").trim();
  if (!text) return;
  const copied = await writeToClipboard(text);
  if (!copied) {
    showToast("Não foi possível copiar a mensagem.", "error");
    return;
  }

  await registerLeadAttended(record, "sugestao_copiada", `Mensagem copiada e atendimento registrado. ${getContactRoleText(record, "waiting")}.`);
}


async function copyHomeSuggestedMessage(conversationKey) {
  const record = state.records.find(item => item.conversationKey === conversationKey)
    || await getAtendimento(conversationKey);
  const suggestion = record?.metadata?.analiseComercial?.mensagensSugeridas?.[0];
  const text = String(suggestion?.mensagem || "").trim();
  if (!record || !text) {
    if (conversationKey) navigateToAttendance(conversationKey);
    return;
  }
  const copied = await writeToClipboard(text);
  if (!copied) {
    showToast("Não foi possível copiar a mensagem.", "error");
    return;
  }
  await registerLeadAttended(record, "sugestao_copiada_home", `Mensagem copiada. ${getContactRoleText(record, "waiting")}.`);
}

async function copySelectedMessages() {
  if (!state.currentKey) return;
  const record = await getCurrentRecord();
  if (!record) return;

  const timeline = filterTimelineByPeriod(record.timeline);
  if (!timeline.length) {
    showToast(`Não há mensagens em ${selectedPeriodSentenceLabel()}.`, "error");
    return;
  }

  const copied = await writeToClipboard(formatTimelineForCopy(timeline));
  if (!copied) {
    showToast("Não foi possível copiar as mensagens.", "error");
    return;
  }
  showToast(`${timeline.length} ${timeline.length === 1 ? "mensagem copiada" : "mensagens copiadas"}.`);
}

function renderInstallCard() {
  if (isStandalone()) return "";

  if (state.installPrompt) {
    return `
      <section class="install-card">
        <span class="install-card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 21h14"/></svg>
        </span>
        <div class="install-card-copy">
          <strong>Instale o Corretor Pro</strong>
          <span>O ícone ficará na tela inicial e o aplicativo poderá receber o ZIP pelo compartilhamento.</span>
        </div>
        <button type="button" data-install>Instalar</button>
      </section>`;
  }

  if (isIos()) {
    return `
      <section class="install-card">
        <span class="install-card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 16V3m0 0L8 7m4-4 4 4"/><path d="M5 12v8h14v-8"/></svg>
        </span>
        <div class="install-card-copy">
          <strong>Adicionar à Tela de Início</strong>
          <span>No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.</span>
        </div>
      </section>
      <div class="platform-note">O recebimento direto pelo compartilhamento será testado no Android nesta primeira versão.</div>`;
  }

  return "";
}

function renderEmptyState() {
  return `
    <section class="empty-state">
      <div class="empty-state-inner">
        <span class="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 5h16v12H7l-3 3Z"/><path d="M8 9h8M8 13h5"/></svg>
        </span>
        <h2>Nenhum atendimento recebido</h2>
        <p>O primeiro atendimento aparecerá aqui quando o ZIP de uma conversa for enviado ao Corretor Pro.</p>
        <ol class="empty-flow">
          <li><b>1</b><span>No WhatsApp, abra a conversa e escolha <strong>Exportar conversa</strong>.</span></li>
          <li><b>2</b><span>Selecione <strong>Incluir mídias</strong> para enviar também os áudios.</span></li>
          <li><b>3</b><span>Na tela de compartilhamento, escolha <strong>Corretor Pro</strong>.</span></li>
        </ol>
      </div>
    </section>`;
}


function setListHeader() {
  backButton.hidden = true;
  brandButton.hidden = false;
  detailHeader.hidden = true;
  editNameButton.hidden = true;
  installButton.hidden = isStandalone() || !state.installPrompt;
  if (leadCount) {
    const n = state.records.length;
    leadCount.textContent = `${n} lead${n === 1 ? "" : "s"}`;
    leadCount.hidden = n === 0;
  }
}

function setDetailHeader(record) {
  backButton.hidden = false;
  brandButton.hidden = true;
  detailHeader.hidden = false;
  editNameButton.hidden = false;
  installButton.hidden = true;
  if (leadCount) leadCount.hidden = true;

  detailHeaderTitle.textContent = record.nomeLead;
  const last = new Date(record.ultimaMensagemAt || record.updatedAt || Date.now());
  detailHeaderSubtitle.textContent = Number.isNaN(last.getTime())
    ? "Atendimento salvo"
    : `Última mensagem: ${dateOnlyFormatter.format(last)} às ${timeFormatter.format(last)}`;
}

function renderList() {
  state.currentKey = null;
  state.notaPrintsPendentes = [];
  setListHeader();

  const records = [...state.records];
  const actionRecords = records
    .filter(r => getLeadWorkflowState(r).mode === "client_response" || classifyLead(r) === "esfriando" || !r?.metadata?.analiseComercial)
    .sort((a, b) => getActionRank(b) - getActionRank(a));
  const actionKeys = new Set(actionRecords.map(r => r.conversationKey));
  const otherRecords = records
    .filter(r => !actionKeys.has(r.conversationKey))
    .sort((a, b) => getLatestActivityDate(b).getTime() - getLatestActivityDate(a).getTime());

  function buildCard(record, mode = "normal") {
    const workflow = getLeadWorkflowState(record);
    const moment = formatCardDate(workflow.activityDate.toISOString());
    const priority = getCommercialPriority(record);
    const action = getLeadActionText(record);
    const summary = String(record.ultimaMensagemResumo || "Atendimento recebido").trim();
    return `
      <button class="cp-lead-line v2-lead-row cp-lead-line--${escapeHtml(priority.className)}" type="button" data-attendance="${escapeHtml(record.conversationKey)}">
        <span class="cp-lead-line-main">
          <strong>${escapeHtml(record.nomeLead)}</strong>
          <span>${escapeHtml(action)}</span>
          <small>${escapeHtml(summary.length > 92 ? summary.slice(0, 89).trim() + "..." : summary)}</small>
        </span>
        <span class="cp-lead-line-meta v2-lead-side"><b>${escapeHtml(priority.label)}</b><small>${escapeHtml(moment.date)} · ${escapeHtml(moment.time)}</small></span>
      </button>`;
  }

  const actionHtml = actionRecords.slice(0, 8).map(r => buildCard(r, "action")).join("");
  const otherHtml = otherRecords.map(r => buildCard(r, "normal")).join("");

  app.innerHTML = `
    <section class="cp-page cp-home-page v2-home-page">
      <div class="cp-page-actions">
        <button class="cp-secondary-action" type="button" data-add-lead>Novo atendimento</button>
      </div>
      ${renderInstallCard()}
      ${records.length ? renderDashboard(records) : renderEmptyState()}
      ${actionHtml ? `<section class="cp-list-section"><div class="cp-section-title"><h2>Fila de ação</h2><span>${actionRecords.length}</span></div>${actionHtml}</section>` : ""}
      ${otherHtml ? `<details class="cp-list-section cp-all-leads" id="all-leads"><summary>Todos os atendimentos <span>${otherRecords.length}</span></summary>${otherHtml}</details>` : ""}
      <div class="cp-sync-note${state.cloudAvailable === false ? " error" : ""}">
        <span>${state.cloudAvailable === false
          ? "Banco na nuvem não configurado."
          : "Atendimentos sincronizados neste link."}</span>
      </div>
    </section>`;
}


function groupTimelineByDate(timeline) {
  const groups = [];
  let lastKey = null;
  for (const item of timeline || []) {
    const date = item.timestamp ? new Date(item.timestamp) : null;
    const key = date && !Number.isNaN(date.getTime()) ? date.toDateString() : item.date || "Sem data";
    if (key !== lastKey) {
      groups.push({
        key,
        label: date && !Number.isNaN(date.getTime()) ? dateOnlyFormatter.format(date) : item.date || "Sem data",
        items: []
      });
      lastKey = key;
    }
    groups[groups.length - 1].items.push(item);
  }
  return groups;
}

function renderTimelineItem(item, record) {
  const originalLead = record.metadata?.originalLeadName || record.nomeLead;
  const leadClass = normalizeComparable(item.author) === normalizeComparable(originalLead) ? " lead" : "";
  const fallbackText = item.type === "audio"
    ? "Não foi possível transcrever este áudio."
    : "";

  if (item.type === "audio") {
    const outsidePeriod = isAudioOutsidePeriod(item);
    const failed = isAudioFailure(item);
    const label = outsidePeriod ? "Áudio fora do período" : failed ? "Áudio não transcrito" : "Áudio transcrito";
    return `
      <article class="timeline-item${leadClass}">
        <div class="timeline-meta">
          <span class="timeline-author">${escapeHtml(item.author)}</span>
          <time class="timeline-time">${escapeHtml(item.time || "")}</time>
        </div>
        <div class="transcription-block${failed ? " error" : outsidePeriod ? " skipped" : ""}">
          <span class="transcription-label">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M8 6v12M4 9v6M16 5v14M20 8v8"/></svg>
            ${label}
          </span>
          <p class="timeline-text">${escapeHtml(item.text || fallbackText)}</p>
        </div>
      </article>`;
  }

  return `
    <article class="timeline-item${leadClass}">
      <div class="timeline-meta">
        <span class="timeline-author">${escapeHtml(item.author)}</span>
        <time class="timeline-time">${escapeHtml(item.time || "")}</time>
      </div>
      <p class="timeline-text">${escapeHtml(item.text || "")}</p>
    </article>`;
}


function formatSavedDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return `${dateOnlyFormatter.format(date)} às ${timeFormatter.format(date)}`;
}


function renderProposalSection(record) {
  const proposal = record.metadata?.propostaImagem;
  const hasSafeImage = proposal && isSafeProposalDataUrl(proposal.dataUrl);
  const busy = state.proposalBusy;
  const attachedLabel = formatSavedDate(proposal?.attachedAt);
  const proposalTarget = getContactRoleText(record, "target");

  return `
    <section class="v2-compact-section proposal-card">
      <div class="v2-section-head">
        <div>
          <span class="section-eyebrow">Proposta</span>
          <h2>${hasSafeImage ? "Print anexado" : "Anexar proposta"}</h2>
        </div>
        ${hasSafeImage ? `<span class="v2-status-pill">Já enviada</span>` : ""}
      </div>
      <p class="section-description">Use apenas quando a proposta já foi enviada ${escapeHtml(proposalTarget)}. A IA passa a considerar esse contexto.</p>
      <input id="proposal-image-input" type="file" accept="image/jpeg,image/png,image/webp" data-proposal-input hidden>
      ${hasSafeImage ? `
        <div class="v2-proposal-row">
          <img src="${escapeHtml(proposal.dataUrl)}" alt="Print da última proposta enviada">
          <div>
            <strong>${escapeHtml(proposal.name || "Proposta anexada")}</strong>
            <span>${attachedLabel ? `Anexada em ${escapeHtml(attachedLabel)}` : "Proposta atual"}</span>
          </div>
        </div>
        <button class="v2-secondary-button" type="button" data-attach-proposal${busy ? " disabled" : ""}>
          ${busy ? "Preparando imagem..." : "Trocar print"}
        </button>` : `
        <button class="v2-primary-button" type="button" data-attach-proposal${busy ? " disabled" : ""}>
          ${busy ? "Preparando imagem..." : "Anexar print da proposta"}
        </button>`}
    </section>`;
}

function renderTextList(items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return `<span class="analysis-empty-value">Não identificado</span>`;
  return `<ul>${list.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function splitTextIntoPoints(text, limit = 3) {
  const value = String(text || "").trim();
  if (!value) return [];
  const normalized = value
    .replace(/\s+/g, ' ')
    .replace(/\s*[-•]\s*/g, '. ')
    .trim();
  const parts = normalized
    .split(/(?<=[.!?;])\s+|\s{2,}/)
    .map(part => part.trim().replace(/^[•\-]\s*/, '').trim())
    .filter(Boolean);
  if (!parts.length) return [normalized];
  return parts.slice(0, limit);
}

function renderPointList(items, fallback) {
  const list = (Array.isArray(items) ? items : []).filter(Boolean).slice(0, 4);
  const source = list.length ? list : splitTextIntoPoints(fallback, 4);
  if (!source.length) return `<p class="analysis-empty-value">Não identificado</p>`;
  return `<ul class="analysis-point-list">${source.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderInlineIcon(kind) {
  const icons = {
    leitura: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>',
    pendencia: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m15.5 8.5-7 7"/><path d="m8.5 8.5 7 7"/></svg>',
    proximo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h11"/><path d="M4 12h16"/><path d="M4 17h10"/><path d="m15 5 5 7-5 7"/></svg>',
    periodo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>',
    mensagens: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    horario: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    sucesso: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>',
    alvo: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
    risco: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5"/><path d="M12 17h.01"/></svg>'
  };
  return icons[kind] || icons.leitura;
}

function summarizeSuggestionMessage(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  const sentence = splitTextIntoPoints(value, 1)[0] || value;
  return sentence.length > 120 ? `${sentence.slice(0, 117).trim()}...` : sentence;
}

function getActionableAnalysisAlert(record, analysis) {
  const alert = String(analysis?.alertaInformacaoIncompleta || "").trim();
  const incompleteAudioCount = (record.timeline || []).filter(isAudioFailure).length;

  if (incompleteAudioCount > 0) {
    return alert || `${incompleteAudioCount} áudio${incompleteAudioCount === 1 ? " não foi transcrito" : "s não foram transcritos"}. A análise pode estar incompleta.`;
  }
  if (!alert) return "";

  const normalized = normalizeComparable(alert);
  const criticalPatterns = [
    /imagem ilegivel/,
    /proposta ilegivel/,
    /nao foi possivel (?:ler|analisar|identificar)/,
    /informac(?:ao|oes) essencia(?:l|is)/,
    /dados insuficientes/,
    /valor(?:es)? principa(?:l|is) nao (?:foi|foram) identificado/,
    /proposta nao (?:foi )?identificada/
  ];
  return criticalPatterns.some(pattern => pattern.test(normalized)) ? alert : "";
}

function renderFullAnalysisDetails(analysis, record) {
  const clientLabel = getContactType(record) === "corretor" ? "cliente final" : "cliente";
  return `
    <details class="analysis-details">
      <summary>
        <span>Ver análise completa</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
      </summary>
      <div class="analysis-details-content">
        <div class="analysis-facts">
          <div><span>Produto principal</span><strong>${escapeHtml(analysis.produtoPrincipal || "Não identificado")}</strong></div>
          <div><span>Etapa</span><strong>${escapeHtml(analysis.etapa || "Não identificada")}</strong></div>
          <div><span>Interesse</span><strong>${escapeHtml(analysis.nivelInteresse || "Não identificado")}</strong></div>
          <div><span>Gatilho</span><strong>${escapeHtml(analysis.gatilhoPrincipal || "Não identificado")}</strong></div>
          <div><span>Momento emocional</span><strong>${escapeHtml(analysis.momentoEmocional || "Não identificado")}</strong></div>
          <div><span>Tipo de comprador</span><strong>${escapeHtml(analysis.tipoComprador || "Não identificado")}</strong></div>
          <div><span>Risco de perda</span><strong>${escapeHtml(analysis.riscoPerda || "Não identificado")}</strong></div>
          <div><span>Fechamento</span><strong>${Number.isFinite(Number(analysis.probabilidadeFechamento)) ? `${Math.round(Number(analysis.probabilidadeFechamento))}%` : "Não identificado"}</strong></div>
          <div><span>Confiança da IA</span><strong>${Number.isFinite(Number(analysis.confiancaAnalise)) ? `${Math.round(Number(analysis.confiancaAnalise))}%` : "Não identificado"}</strong></div>
        </div>
        <div class="analysis-grid">
          <div class="analysis-block">
            <h3>Sinais de interesse</h3>
            ${renderTextList(analysis.sinaisInteresse)}
          </div>
          <div class="analysis-block">
            <h3>Produtos paralelos</h3>
            ${renderTextList(analysis.produtosParalelos)}
          </div>
          <div class="analysis-block"><h3>Última pessoa a falar</h3><p>${escapeHtml(analysis.ultimaPessoaAFalar || "Não identificada")}</p></div>
          <div class="analysis-block"><h3>Objeção principal</h3><p>${escapeHtml(analysis.objecaoPrincipal || "Não identificada")}</p></div>
          <div class="analysis-block"><h3>Objeções secundárias</h3>${renderTextList(analysis.objecoesSecundarias)}</div>
          <div class="analysis-block"><h3>Pendência documental</h3><p>${escapeHtml(analysis.pendenciaDocumental || "Não identificada")}</p></div>
          <div class="analysis-block"><h3>Última solicitação do ${escapeHtml(clientLabel)}</h3><p>${escapeHtml(analysis.ultimaSolicitacaoCliente || "Não identificada")}</p></div>
          <div class="analysis-block"><h3>Último compromisso do ${escapeHtml(clientLabel)}</h3><p>${escapeHtml(analysis.ultimoCompromissoCliente || "Não identificado")}</p></div>
          <div class="analysis-block"><h3>Último compromisso do corretor</h3><p>${escapeHtml(analysis.ultimoCompromissoCorretor || "Não identificado")}</p></div>
          <div class="analysis-block"><h3>Participantes da decisão</h3><p>${escapeHtml(analysis.participantesDecisao || "Não identificados")}</p></div>
          <div class="analysis-block"><h3>Proposta identificada</h3><p>${escapeHtml(analysis.propostaResumo || "Nenhuma proposta anexada")}</p></div>
          <div class="analysis-block"><h3>Pendência financeira</h3><p>${escapeHtml(analysis.pendenciaFinanceira || "Não identificada")}</p></div>
          <div class="analysis-block"><h3>Quem deve agir agora</h3><p>${escapeHtml(analysis.quemDeveProximoPasso || "Não identificado")}</p></div>
          <div class="analysis-block"><h3>Por que ainda não comprou?</h3><p>${escapeHtml(analysis.porqueNaoComprou || "Não identificado")}</p></div>
          <div class="analysis-block"><h3>O que falta para fechar?</h3><p>${escapeHtml(analysis.oQueFaltaParaFechar || "Não identificado")}</p></div>
          <div class="analysis-block"><h3>Melhor horário para contato</h3><p>${escapeHtml(analysis.melhorHorarioContato || "Não identificado")}</p></div>
        </div>
      </div>
    </details>`;
}


function renderAnalysisSection(record) {
  const analysis = record.metadata?.analiseComercial;
  const analyzing = state.analyzingKey === record.conversationKey;
  const workflow = getLeadWorkflowState(record);
  const actionLabel = analyzing
    ? "Analisando..."
    : workflow.mode === "client_response"
      ? "Analisar nova resposta"
      : analysis
        ? "Atualizar análise"
        : "Analisar atendimento";

  if (!analysis) {
    return `
      <section class="cp-panel analysis-card analysis-card-empty">
        <div class="cp-panel-head">
          <p class="cp-kicker">Inteligência comercial</p>
          <h2>Gerar leitura do atendimento</h2>
        </div>
        <p>Use a IA para encontrar objeção, pendência, próximo passo e mensagem ideal.</p>
        <button class="cp-primary-action v2-primary-button" type="button" data-analyze-attendance${analyzing ? " disabled" : ""}>${escapeHtml(actionLabel)}</button>
      </section>`;
  }

  const suggestions = Array.isArray(analysis.mensagensSugeridas) ? analysis.mensagensSugeridas : [];
  const proposal = record.metadata?.propostaImagem;
  const proposalWasAnalyzed = Boolean(proposal && isSafeProposalDataUrl(proposal.dataUrl));
  const actionableAlert = getActionableAnalysisAlert(record, analysis);
  const readingPoints = (Array.isArray(analysis.sinaisInteresse) && analysis.sinaisInteresse.length)
    ? analysis.sinaisInteresse
    : splitTextIntoPoints(analysis.resumo, 3);
  const pendingPoints = splitTextIntoPoints(analysis.pendenciaReal || analysis.pendenciaFinanceira || analysis.oQueFaltaParaFechar, 3);
  const nextStepPoints = splitTextIntoPoints(analysis.proximoPasso, 3);
  const analysisperiod = analysis.period || selectedPeriodLabel();
  const currentPeriod = selectedPeriodLabel();
  const periodMismatch = !analyzing && analysisperiod !== currentPeriod;

  return `
    <section class="cp-panel analysis-card analysis-card-rich">
      <div class="cp-panel-head">
        <div>
          <p class="cp-kicker">Análise completa</p>
          <h2>O que a IA percebeu</h2>
        </div>
        <button class="cp-secondary-action cp-small" type="button" data-analyze-attendance${analyzing ? " disabled" : ""}>${escapeHtml(actionLabel)}</button>
      </div>
      ${periodMismatch ? `<p class="cp-muted">Análise feita com ${escapeHtml(analysisperiod)} · ao atualizar usará ${escapeHtml(currentPeriod)}</p>` : ''}
      ${proposalWasAnalyzed && !actionableAlert ? `<div class="cp-inline-ok v2-inline-status">Proposta considerada na análise</div>` : ''}
      ${actionableAlert ? `<div class="cp-alert analysis-alert" role="alert">${escapeHtml(actionableAlert)}</div>` : ""}
      <div class="cp-insight-list v2-diagnosis-list">
        <article><span>O que está acontecendo</span>${renderPointList(readingPoints, analysis.resumo)}</article>
        <article><span>Antes de fechar</span>${renderPointList(pendingPoints, analysis.pendenciaReal || analysis.pendenciaFinanceira)}</article>
        <article><span>Próximo movimento</span>${renderPointList(nextStepPoints, analysis.proximoPasso)}</article>
      </div>
      <details class="cp-drawer v2-drawer">
        <summary>Campos técnicos da análise</summary>
        <div class="cp-drawer-content">
          <p><b>Gatilho principal:</b> ${escapeHtml(analysis.gatilhoPrincipal || "Não identificado")}</p>
          <p><b>Momento emocional:</b> ${escapeHtml(analysis.momentoEmocional || "Não identificado")}</p>
          <p><b>Tipo de comprador:</b> ${escapeHtml(analysis.tipoComprador || "Não identificado")}</p>
          <p><b>Objeção principal:</b> ${escapeHtml(analysis.objecaoPrincipal || "Não identificada")}</p>
          <p><b>Por que ainda não comprou:</b> ${escapeHtml(analysis.porqueNaoComprou || "Não identificado")}</p>
          <p><b>O que falta para fechar:</b> ${escapeHtml(analysis.oQueFaltaParaFechar || "Não identificado")}</p>
          ${renderFullAnalysisDetails(analysis, record)}
        </div>
      </details>
    </section>
    ${suggestions.length > 1 ? `<section class="cp-panel suggestions-panel suggestions-panel-grid">
      <div class="cp-panel-head">
        <div>
          <p class="cp-kicker">Alternativas</p>
          <h2>Outras respostas</h2>
        </div>
        <span class="cp-muted-label">${suggestions.length - 1} opções</span>
      </div>
      <div class="cp-suggestions-list v2-suggestions-stack">
        ${suggestions.slice(1).map((suggestion, idx) => {
          const index = idx + 1;
          return `<article class="cp-suggestion v2-suggestion-row">
            <div>
              <strong>${escapeHtml(suggestion.titulo || `Opção ${index + 1}`)}</strong>
              <p>${escapeHtml(suggestion.mensagem || '')}</p>
            </div>
            <button type="button" data-copy-suggestion="${index}">Copiar</button>
          </article>`;
        }).join("")}
      </div>
    </section>` : ""}`;
}


function renderCommercialSnapshot(record) {
  const analysis = record?.metadata?.analiseComercial || null;
  const priority = getCommercialPriority(record);
  const workflow = getLeadWorkflowState(record);
  const next = analysis?.proximoPasso || (workflow.mode === "client_response" ? "Responder sem mudar de assunto." : "Gerar análise comercial para definir a próxima ação.");
  const pending = analysis?.pendenciaReal || analysis?.pendenciaFinanceira || analysis?.oQueFaltaParaFechar || "A pendência ainda não está clara.";
  const verdict = analysis?.porqueNaoComprou || analysis?.objecaoPrincipal || analysis?.resumo || getCommercialReason(record);
  const suggestions = Array.isArray(analysis?.mensagensSugeridas) ? analysis.mensagensSugeridas : [];
  const firstSuggestion = suggestions[0]?.mensagem || "";

  return `
    <section class="cp-decision v2-decision-card v2-decision-card--${escapeHtml(priority.className)}">
      <p class="cp-kicker">Faça agora</p>
      <h2>${escapeHtml(next)}</h2>
      <p class="cp-decision-verdict">${escapeHtml(verdict || pending || "A melhor ação depende de uma nova análise.")}</p>
      ${firstSuggestion ? `<div class="cp-message-box v2-copy-box">
        <span>Mensagem pronta</span>
        <p>${escapeHtml(firstSuggestion)}</p>
        <button type="button" data-copy-suggestion="0">Copiar mensagem</button>
      </div>` : `<button class="cp-primary-action v2-primary-button" type="button" data-analyze-attendance>Analisar atendimento</button>`}
      <details class="cp-why v2-reason-box">
        <summary>Por que essa ação?</summary>
        <div>
          <p><b>O que falta:</b> ${escapeHtml(pending)}</p>
          <p><b>Quem deve agir:</b> ${escapeHtml(analysis?.quemDeveProximoPasso || "Corretor")}</p>
          <p><b>Gatilho principal:</b> ${escapeHtml(analysis?.gatilhoPrincipal || "Não identificado")}</p>
        </div>
      </details>
    </section>`;
}


function renderContactTypeSelector(record) {
  if (getContactType(record)) return "";
  return `
    <section class="contact-type-card" aria-labelledby="contact-type-title">
      <span class="section-eyebrow">Primeira importação</span>
      <h2 id="contact-type-title">Este contato é:</h2>
      <p>Escolha uma vez para a inteligência interpretar corretamente as próximas conversas.</p>
      <div class="contact-type-options" role="group" aria-label="Tipo de contato">
        <button type="button" data-contact-type="cliente">Cliente</button>
        <button type="button" data-contact-type="corretor">Corretor</button>
      </div>
    </section>`;
}

function renderNotasSection(record) {
  const notas = record.metadata?.notasAtendimento || [];
  const sorted = [...notas].sort((a, b) => new Date(b.criadaEm) - new Date(a.criadaEm));
  const isRecording = state.notaRecordingKey === record.conversationKey;

  const pendingCount = state.currentKey === record.conversationKey ? state.notaPrintsPendentes.length : 0;
  const pendingPrints = pendingCount
    ? `<div class="notas-pending" role="status">
         <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
         <span>${pendingCount} print${pendingCount > 1 ? "s" : ""} anexado${pendingCount > 1 ? "s" : ""} — toque em <strong>Salvar nota</strong> para a IA ler e adicionar ao histórico.</span>
         <button type="button" class="notas-pending-clear" data-clear-prints aria-label="Remover prints anexados">Remover</button>
       </div>`
    : "";

  const notaItems = sorted.map(nota => {
    const dt = new Date(nota.criadaEm);
    const label = Number.isNaN(dt.getTime())
      ? ""
      : `${dateOnlyFormatter.format(dt)} às ${timeFormatter.format(dt)}`;
    const tipoIcon = nota.tipo === "audio"
      ? `<svg class="nota-tipo-icon" viewBox="0 0 24 24" aria-label="Áudio transcrito"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`
      : nota.tipo === "print"
      ? `<svg class="nota-tipo-icon" viewBox="0 0 24 24" aria-label="Print lido pela IA"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`
      : "";
    const audioIcon = tipoIcon;
    return `
      <div class="nota-item" id="nota-${escapeHtml(nota.id)}" data-nota-id="${escapeHtml(nota.id)}">
        <div class="nota-item-header">
          <span class="nota-item-meta">${audioIcon}${escapeHtml(label)}</span>
          <button class="nota-delete-button" type="button" data-delete-nota="${escapeHtml(nota.id)}" aria-label="Excluir nota">
            <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <p class="nota-item-text">${escapeHtml(nota.conteudo)}</p>
      </div>`;
  }).join("");

  return `
    <section class="notas-section">
      <div class="notas-header">
        <span class="section-eyebrow">Notas de atendimento</span>
        <strong>Observações fora do WhatsApp</strong>
      </div>
      <div class="notas-input-area">
        <textarea
          class="nota-textarea"
          id="nota-textarea-${escapeHtml(record.conversationKey)}"
          placeholder="Toque em Gravar e fale — o texto aparece aqui em tempo real. Ou digite direto."
          rows="3"
          maxlength="2000"
        ></textarea>
        <div class="notas-actions">
          <button
            class="nota-record-button${isRecording ? " recording" : ""}"
            type="button"
            data-toggle-record-nota
            aria-label="${isRecording ? "Parar gravação" : "Gravar áudio"}"
            title="${isRecording ? "Parar gravação" : "Gravar e transcrever áudio"}"
          >
            ${isRecording
              ? `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>Parar`
              : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>Gravar`
            }
          </button>
          <label class="nota-print-button" title="Anexar print(s) da conversa — a IA lê e adiciona as mensagens ao histórico">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
            Print
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple data-print-nota-input hidden>
          </label>
          <button class="nota-save-button primary-action-button" type="button" data-save-nota>Salvar nota</button>
        </div>
        ${pendingPrints}
      </div>
      ${notaItems ? `<div class="notas-list">${notaItems}</div>` : ""}
    </section>`;
}

async function saveNota(record, conteudo, tipo = "texto") {
  const texto = String(conteudo || "").trim();
  if (!texto) return;
  // Sempre usa a versão mais completa do IndexedDB para não perder timeline ou notas anteriores
  const stored = await getAtendimento(record.conversationKey);
  const base = (stored && Array.isArray(stored.timeline)) ? stored : record;
  const now = new Date().toISOString();
  const nota = {
    id: globalThis.crypto?.randomUUID?.() || `nota-${Date.now()}`,
    tipo,
    conteudo: texto,
    criadaEm: now
  };
  const existing = Array.isArray(base.metadata?.notasAtendimento) ? base.metadata.notasAtendimento : [];
  const updated = {
    ...base,
    updatedAt: now,
    metadata: {
      ...(base.metadata || {}),
      notasAtendimento: [...existing, nota],
      ultimaMovimentacaoAt: now
    }
  };
  await saveAtendimento(updated);
  pushRemoteRecord(updated).catch(() => null);
  await refreshRecords();
  renderDetail(updated);
  showToast("Nota salva.", "success", 4000);
}

async function deleteNota(record, notaId) {
  const stored = await getAtendimento(record.conversationKey);
  const base = (stored && Array.isArray(stored.timeline)) ? stored : record;
  const existing = Array.isArray(base.metadata?.notasAtendimento) ? base.metadata.notasAtendimento : [];
  const filtered = existing.filter(n => n.id !== notaId);
  const now = new Date().toISOString();
  const updated = {
    ...base,
    updatedAt: now,
    metadata: {
      ...(base.metadata || {}),
      notasAtendimento: filtered,
      ultimaMovimentacaoAt: now
    }
  };
  await saveAtendimento(updated);
  pushRemoteRecord(updated).catch(() => null);
  await refreshRecords();
  renderDetail(updated);
}

// Colapa repetições crescentes que o Android Chrome gera no SpeechRecognition
// ("a", "a b", "a b c" → retorna só "a b c"). Em fala normal não altera nada.
function colapsarRepeticaoCrescente(txt) {
  const t = String(txt || "").trim().split(/\s+/).filter(Boolean);
  if (t.length < 4) return String(txt || "").trim();
  const low = t.map(w => w.toLowerCase());
  const first = low[0];
  const starts = [];
  for (let i = 0; i < t.length; i++) if (low[i] === first) starts.push(i);
  if (starts.length < 2) return t.join(" ");
  starts.push(t.length);
  const segs = [];
  for (let s = 0; s < starts.length - 1; s++) segs.push(t.slice(starts[s], starts[s + 1]).join(" "));
  for (let s = 0; s < segs.length - 1; s++) {
    if (!segs[s + 1].toLowerCase().startsWith(segs[s].toLowerCase())) return t.join(" ");
  }
  return segs[segs.length - 1];
}

async function toggleNotaRecording(record) {
  if (state.notaRecordingKey === record.conversationKey) {
    stopNotaRecording(record);
    return;
  }
  if (state.notaRecordingKey) stopNotaRecording(null);

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SR) {
    // Tempo real via Web Speech API (Chrome/Edge/Android) — texto aparece enquanto fala
    const textarea = document.getElementById(`nota-textarea-${record.conversationKey}`);
    const textoOriginal = textarea?.value ? textarea.value.trim() + " " : "";
    let ditadoBase = "", sessaoFinais = "", ditando = true;
    state.notaRecordingKey = record.conversationKey;
    renderDetail(record);

    function pararDitado() {
      ditando = false;
      state.notaRecordingKey = null;
      state.notaMediaRecorder = null;
      try { state._notaRecog?.stop(); } catch (_) {}
      state._notaRecog = null;
      getAtendimento(record.conversationKey).then(r => renderDetail(r || record));
      showToast("Pronto. Revise o texto e toque em Salvar nota.");
    }

    function montarRecog() {
      const r = new SR();
      r.lang = "pt-BR";
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e) => {
        const partes = []; let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const txt = String(e.results[i][0].transcript || "").trim();
          if (!txt) continue;
          if (e.results[i].isFinal) {
            const ult = partes.length ? partes[partes.length - 1] : "";
            if (ult && (txt.startsWith(ult) || ult.startsWith(txt))) {
              partes[partes.length - 1] = txt.length >= ult.length ? txt : ult;
            } else {
              partes.push(txt);
            }
          } else {
            interim = txt;
          }
        }
        const finais = partes.join(" ");
        sessaoFinais = finais ? finais + " " : "";
        const ditado = colapsarRepeticaoCrescente(
          (ditadoBase + sessaoFinais + interim).replace(/\s+/g, " ").trim()
        );
        const ta2 = document.getElementById(`nota-textarea-${record.conversationKey}`);
        if (ta2) ta2.value = (textoOriginal + ditado).replace(/\s+/g, " ").trim();
      };
      r.onerror = (ev) => {
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          showToast("Microfone bloqueado. Permita o microfone no navegador.", "error", 7000);
          pararDitado();
        }
      };
      r.onend = () => {
        if (!ditando) return;
        ditadoBase += sessaoFinais; sessaoFinais = "";
        try { r.onresult = null; r.onend = null; r.onerror = null; } catch (_) {}
        state._notaRecog = montarRecog();
        try { state._notaRecog.start(); } catch (_) {}
      };
      return r;
    }

    try {
      state._notaRecog = montarRecog();
      state._notaRecog.start();
      showToast("Ouvindo... fale e o texto vai aparecendo. Toque em Parar quando terminar.");
    } catch (_) {
      showToast("Não consegui ligar o microfone.", "error", 7000);
      pararDitado();
    }

    state.notaMediaRecorder = { _pararDitado: pararDitado };
  } else {
    // Fallback: MediaRecorder → OpenAI Whisper (Safari e browsers sem SpeechRecognition)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"]
        .find(t => MediaRecorder.isTypeSupported(t)) || "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      state.notaRecordingChunks = [];
      state.notaRecordingKey = record.conversationKey;
      state.notaMediaRecorder = recorder;

      recorder.ondataavailable = e => { if (e.data?.size > 0) state.notaRecordingChunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(state.notaRecordingChunks, { type: mimeType || "audio/webm" });
        state.notaRecordingChunks = [];
        state.notaMediaRecorder = null;
        state.notaRecordingKey = null;

        const latest = await getAtendimento(record.conversationKey) || record;
        renderDetail(latest);

        if (blob.size < 100) { showToast("Gravação muito curta, tente novamente.", "error"); return; }
        if (blob.size > AUDIO_MAX_BYTES) { showToast("Áudio longo demais (limite 12 MB). Grave em partes menores.", "error"); return; }

        showToast("Transcrevendo áudio...");
        try {
          const ext = mimeType.includes("ogg") ? "ogg" : "webm";
          const fname = `nota-audio-${Date.now()}.${ext}`;
          const resp = await fetch(`/api/transcrever?filename=${encodeURIComponent(fname)}`, {
            method: "POST",
            headers: { "Content-Type": blob.type || "audio/webm", "X-File-Name": encodeURIComponent(fname) },
            body: blob
          });
          const payload = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(payload.error || "Falha na transcrição.");
          const text = String(payload.text || "").trim();
          if (!text) { showToast("Nenhuma fala detectada no áudio.", "error"); return; }
          const fresh = await getAtendimento(record.conversationKey) || record;
          await saveNota(fresh, text, "audio");
        } catch (err) {
          showToast(err?.message || "Não foi possível transcrever o áudio.", "error", 7000);
        }
      };

      recorder.start();
      renderDetail(record);
      showToast("Gravando... toque em Parar quando terminar.");
    } catch (err) {
      state.notaRecordingKey = null;
      state.notaMediaRecorder = null;
      showToast("Não foi possível acessar o microfone. Verifique as permissões.", "error", 7000);
    }
  }
}

function stopNotaRecording(record) {
  if (state.notaMediaRecorder?._pararDitado) {
    state.notaMediaRecorder._pararDitado();
  } else if (state.notaMediaRecorder && state.notaMediaRecorder.state !== "inactive") {
    state.notaMediaRecorder.stop();
  }
  if (!state.notaMediaRecorder?._pararDitado) {
    state.notaRecordingKey = null;
    state.notaMediaRecorder = null;
  }
  if (record) getAtendimento(record.conversationKey).then(r => { if (r) renderDetail(r); });
}

const MAX_PRINT_DATA_URL = 1_400_000;
const MAX_PRINT_SOURCE_BYTES = 12 * 1024 * 1024;

async function preparePrintImage(file) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type || "")) throw new Error("Use imagens JPG, PNG ou WebP.");
  if (file.size > MAX_PRINT_SOURCE_BYTES) throw new Error("Imagem ultrapassa 12 MB.");
  const source = await readFileAsDataUrl(file);
  const image = await loadImageElement(source);
  const dimensions = [2000, 1700, 1400, 1150];
  const qualities = [0.90, 0.82, 0.74, 0.66];
  let prepared = null;
  for (const dimension of dimensions) {
    for (const quality of qualities) {
      prepared = proposalCanvasDataUrl(image, dimension, quality);
      if (prepared.dataUrl.length <= MAX_PRINT_DATA_URL) break;
    }
    if (prepared?.dataUrl.length <= MAX_PRINT_DATA_URL) break;
  }
  if (!prepared || prepared.dataUrl.length > MAX_PRINT_DATA_URL) {
    throw new Error("Imagem grande demais mesmo comprimida. Recorte apenas a conversa.");
  }
  return prepared.dataUrl;
}

async function handlePrintsAnexo(record, files) {
  if (!files?.length) return;
  const arr = [...files];
  const total = state.notaPrintsPendentes.length + arr.length;
  if (total > 6) { showToast("Máximo de 6 prints por vez.", "error"); return; }

  // Preserva o texto que o usuário já digitou antes do re-render.
  const textarea = document.getElementById(`nota-textarea-${record.conversationKey}`);
  const draft = textarea ? textarea.value : "";

  state.notaPrintsPendentes = [...state.notaPrintsPendentes, ...arr];
  const count = state.notaPrintsPendentes.length;

  // Re-renderiza para mostrar o indicador fixo de prints anexados (sobrevive ao
  // re-render automático da sincronização, ao contrário de um aviso temporário).
  renderDetail(record);
  const restored = document.getElementById(`nota-textarea-${record.conversationKey}`);
  if (restored && draft) restored.value = draft;

  showToast(`${count} print${count > 1 ? "s" : ""} anexado${count > 1 ? "s" : ""} — toque em Salvar nota.`);
}

const PRINT_TS_RE = /^\[(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\]\s*([\s\S]*)$/;

// Converte a transcrição do print (linhas "[AAAA-MM-DD HH:MM] Você/Cliente: texto")
// em itens de linha do tempo, prontos para mesclar no histórico da conversa.
function parsePrintTranscript(texto, leadName, timelineExistente) {
  const { clientAuthor, brokerAuthor } = resolveConversationAuthors(timelineExistente, leadName);
  const linhas = String(texto || "").replace(/\r/g, "").split("\n");
  const blocos = [];
  let atual = null;
  for (const linha of linhas) {
    const m = linha.match(PRINT_TS_RE);
    if (m) {
      if (atual) blocos.push(atual);
      atual = { ano: m[1], mes: m[2], dia: m[3], hora: String(m[4]).padStart(2, "0"), min: m[5], resto: m[6] };
    } else if (atual) {
      atual.resto += `\n${linha}`;
    }
  }
  if (atual) blocos.push(atual);

  const ocorrencias = new Map();
  const itens = [];
  let ordem = 0;
  for (const b of blocos) {
    const ts = new Date(Number(b.ano), Number(b.mes) - 1, Number(b.dia), Number(b.hora), Number(b.min), 0, 0);
    if (Number.isNaN(ts.getTime())) continue;
    const date = `${b.dia}/${b.mes}/${b.ano}`;
    const time = `${b.hora}:${b.min}`;
    const resto = b.resto.trim();
    if (!resto) continue;

    let author;
    let text;
    const fala = resto.match(/^\(?\s*(você|voce|cliente)\s*\)?\s*:\s*([\s\S]*)$/i);
    if (fala) {
      const lado = fala[1].toLowerCase();
      author = lado.startsWith("voc") ? brokerAuthor : clientAuthor;
      text = fala[2].trim();
    } else {
      // Linhas de sinalização (ex.: "*** CLIENTE ENTROU... ***") ficam com o cliente.
      author = clientAuthor;
      text = resto;
    }
    if (!text) continue;

    const base = [date, time, author, "text", text].join("|");
    const occ = (ocorrencias.get(base) || 0) + 1;
    ocorrencias.set(base, occ);
    itens.push({
      date,
      time,
      timestamp: ts.toISOString(),
      author,
      type: "text",
      text,
      origem: "print",
      sourceOrder: ordem += 1,
      fingerprint: `print-${stableHash(base)}-${occ}`
    });
  }
  return itens;
}

async function processarPrintsENota(record, texto, prints) {
  if (!prints.length) {
    await saveNota(record, texto);
    return;
  }

  showToast(`Lendo ${prints.length > 1 ? prints.length + " prints" : "o print"} com a IA...`);
  try {
    const dataUrls = await Promise.all(prints.map(f => preparePrintImage(f)));
    const resp = await fetch("/api/ler-print-nota", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ images: dataUrls, leadName: record.nomeLead })
    });
    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(payload.error || "A IA não conseguiu ler o print.");
    const textoIA = String(payload.texto || "").trim();
    if (!textoIA) { showToast("Nenhum texto identificado no(s) print(s).", "error"); return; }

    const fresh = await getAtendimento(record.conversationKey) || record;
    const printItems = parsePrintTranscript(textoIA, fresh.nomeLead, fresh.timeline);
    if (!printItems.length) {
      showToast("Não consegui identificar mensagens com data e hora no print.", "error", 7000);
      return;
    }

    const merged = mergeTimeline(fresh.timeline || [], printItems);
    const lastItem = merged.timeline[merged.timeline.length - 1];
    const now = new Date().toISOString();
    const nextMetadata = { ...(fresh.metadata || {}) };

    if (merged.added > 0) {
      const latestAdded = merged.addedItems
        .map(item => ({ item, ts: timelineItemTimestamp(item) }))
        .filter(entry => Number.isFinite(entry.ts))
        .sort((a, b) => a.ts - b.ts)
        .at(-1)?.item || merged.addedItems[merged.addedItems.length - 1];
      const movTs = timelineItemTimestamp(latestAdded);
      const movAt = Number.isFinite(movTs) ? new Date(movTs).toISOString() : now;
      nextMetadata.ultimaMovimentacaoAt = movAt;
      if (isClientTimelineItem(latestAdded)) {
        nextMetadata.statusAtendimento = "nova_resposta_cliente";
        nextMetadata.novaRespostaClienteAt = movAt;
        nextMetadata.origemUltimaMovimentacao = "mensagem_cliente";
        delete nextMetadata.atendidoAgoraAt;
        delete nextMetadata.reanaliseDisponivelEm;
      } else {
        nextMetadata.statusAtendimento = "aguardando_resposta";
        nextMetadata.atendidoAgoraAt = movAt;
        nextMetadata.origemUltimaMovimentacao = "mensagem_corretor";
        delete nextMetadata.novaRespostaClienteAt;
        delete nextMetadata.reanaliseDisponivelEm;
      }
    }

    const updated = {
      ...fresh,
      timeline: merged.timeline,
      ultimaMensagemAt: lastItem?.timestamp || fresh.ultimaMensagemAt || now,
      ultimaMensagemResumo: lastItem?.text || fresh.ultimaMensagemResumo || "",
      updatedAt: now,
      metadata: nextMetadata
    };

    await saveAtendimento(updated);
    pushRemoteRecord(updated).catch(() => null);

    // Texto digitado junto com o print continua virando nota de observação.
    // saveNota relê do IndexedDB (já salvo acima) e re-renderiza o detalhe.
    if (texto) {
      await saveNota(updated, texto);
    } else {
      await refreshRecords();
      renderDetail(updated);
    }

    showToast(
      merged.added
        ? `${merged.added === 1 ? "1 mensagem do print adicionada" : merged.added + " mensagens do print adicionadas"} ao histórico.`
        : "Nenhuma mensagem nova foi encontrada no print."
    );
  } catch (err) {
    showToast(err?.message || "Não foi possível processar o print.", "error", 7000);
  }
}

function renderManualLeadSection(record) {
  const { telefone, empreendimento, observacoes } = record.metadata || {};
  if (!telefone && !empreendimento && !observacoes) return "";
  return `
    <section class="manual-lead-card">
      ${empreendimento ? `<div class="manual-lead-row"><span>Empreendimento</span><strong>${escapeHtml(empreendimento)}</strong></div>` : ""}
      ${telefone ? `<div class="manual-lead-row"><span>Telefone</span><strong>${escapeHtml(telefone)}</strong></div>` : ""}
      ${observacoes ? `<div class="manual-lead-row manual-lead-obs"><span>Observações</span><p>${escapeHtml(observacoes)}</p></div>` : ""}
    </section>`;
}

async function createManualLead(name, phone, empreendimento, notes) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    showToast("Informe o nome do lead para continuar.", "error");
    return;
  }
  const now = new Date().toISOString();
  const conversationKey = makeConversationKey(trimmedName) + "-" + Date.now();
  const record = {
    id: globalThis.crypto?.randomUUID?.() || `manual-${Date.now()}`,
    deviceId: CLOUD_WORKSPACE,
    conversationKey,
    nomeLead: trimmedName,
    arquivoOrigem: null,
    ultimaMensagemAt: now,
    ultimaMensagemResumo: empreendimento || "Atendimento manual",
    timeline: [],
    metadata: {
      manualEntry: true,
      telefone: phone || null,
      empreendimento: empreendimento || null,
      observacoes: notes || null,
      ultimaMovimentacaoAt: now
    },
    createdAt: now,
    updatedAt: now
  };
  await saveAtendimento(record);
  await pushRemoteRecord(record);
  await refreshRecords();
  navigateToAttendance(record.conversationKey);
}


function renderDetail(record) {
  const isNewLead = state.currentKey !== record.conversationKey;
  if (isNewLead) state.detailPeriod = "30";
  state.currentKey = record.conversationKey;
  setDetailHeader(record);
  if (isNewLead) requestAnimationFrame(() => window.scrollTo(0, 0));

  const updated = new Date(record.updatedAt || record.ultimaMensagemAt || Date.now());
  const updatedLabel = Number.isNaN(updated.getTime())
    ? "Atualizado recentemente"
    : `${dateOnlyFormatter.format(updated)} às ${timeFormatter.format(updated)}`;
  const workflow = getLeadWorkflowState(record);
  const waitingForClient = workflow.mode === "waiting";
  const attendedNowLabel = formatAttendedNowLabel(record);
  const workflowTitle = waitingForClient
    ? getContactRoleText(record, "waiting")
    : workflow.mode === "client_response"
      ? getContactRoleText(record, "new")
      : "Atendimento salvo";
  const workflowSubtitle = waitingForClient
    ? (attendedNowLabel || updatedLabel)
    : workflow.mode === "client_response"
      ? `Resposta recebida ${formatCardDate(workflow.activityDate.toISOString()).date.toLowerCase()} às ${formatCardDate(workflow.activityDate.toISOString()).time}`
      : updatedLabel;
  const workflowClass = workflow.mode === "waiting" ? " waiting-client" : workflow.mode === "client_response" ? " client-response" : "";

  const failedAudios = (record.timeline || []).filter(isAudioFailure);
  const filteredTimeline = filterTimelineByPeriod(record.timeline);
  const totalTimeline = Array.isArray(record.timeline) ? record.timeline.length : 0;
  const hiddenCount = totalTimeline - filteredTimeline.length;
  const groups = groupTimelineByDate(filteredTimeline);
  const timelineHtml = groups.map(group => `
    <div class="timeline-day"><span>${escapeHtml(group.label)}</span></div>
    ${group.items.map(item => renderTimelineItem(item, record)).join("")}
  `).join("");
  const periodOptions = DETAIL_PERIODS.map(option => `
    <button class="period-option${state.detailPeriod === option.value ? " active" : ""}" type="button" data-detail-period="${option.value}" aria-pressed="${state.detailPeriod === option.value ? "true" : "false"}">${escapeHtml(option.label)}</button>
  `).join("");

  app.innerHTML = `
    <section class="cp-page cp-detail-page v2-detail-page v2-decision-page">
      <section class="cp-lead-header${workflowClass}">
        <div>
          <p class="cp-kicker">${escapeHtml(workflowTitle)}</p>
          <h1>${escapeHtml(record.nomeLead)}</h1>
          <span>${escapeHtml(workflowSubtitle)}</span>
        </div>
        ${waitingForClient ? "" : `<button class="cp-secondary-action cp-small" type="button" data-attended-now>Atendido agora</button>`}
      </section>

      ${renderCommercialSnapshot(record)}

      ${failedAudios.length ? `
        <section class="cp-alert audio-warning" role="alert">
          <strong>Informação incompleta</strong><span>${failedAudios.length} áudio${failedAudios.length === 1 ? " não foi transcrito" : "s não foram transcritos"}.</span>
        </section>` : ""}

      <details class="cp-fold v2-fold-section">
        <summary>Ver análise completa</summary>
        ${renderContactTypeSelector(record)}
        ${renderAnalysisSection(record)}
      </details>

      <details class="cp-fold v2-fold-section">
        <summary>Notas, proposta e histórico</summary>
        ${renderManualLeadSection(record)}
        ${renderNotasSection(record)}
        ${renderProposalSection(record)}
        <details class="cp-utility v2-compact-section v2-utility-panel">
          <summary>Mensagens analisadas</summary>
          <div class="message-toolbar" aria-label="Período das mensagens">
            <div class="period-filter">
              <span class="period-filter-label">Período:</span>
              <div class="period-options" role="group" aria-label="Selecionar período">${periodOptions}</div>
              <span class="period-result">${filteredTimeline.length} ${filteredTimeline.length === 1 ? "mensagem" : "mensagens"}${hiddenCount > 0 ? ` · <button class="period-hidden-hint" type="button" data-detail-period="all">+${hiddenCount} ocultas</button>` : ""}</span>
            </div>
            <button class="copy-messages-button" type="button" data-copy-messages${filteredTimeline.length ? "" : " disabled"}>Copiar mensagens</button>
          </div>
        </details>
        <details class="cp-utility history-panel">
          <summary><div><span class="section-eyebrow">Histórico</span><strong>Ver conversa do período</strong></div><span class="history-panel-count">${filteredTimeline.length}</span></summary>
          <section class="timeline">${timelineHtml || `<p class="timeline-empty">Nenhuma mensagem encontrada em ${escapeHtml(selectedPeriodSentenceLabel())}.</p>`}</section>
        </details>
      </details>

      <details class="cp-danger-zone v2-danger-zone">
        <summary>Opções do atendimento</summary>
        <button class="delete-lead-button" type="button" data-delete-lead>Excluir lead</button>
      </details>
    </section>`;
}


async function renderRoute() {
  const key = getRouteKey();
  if (!key) {
    renderList();
    return;
  }

  const record = await ensureFullRecord(key);
  if (!record) {
    showToast("Este atendimento não foi encontrado.", "error");
    navigateToList();
    return;
  }
  renderDetail(record);
}

function mergeLocalAndRemoteSummaries(localRecords) {
  const merged = new Map();
  for (const local of localRecords || []) merged.set(local.conversationKey, local);

  for (const summary of state.remoteSummaries.values()) {
    if (summary?.metadata?.deletedAt) {
      merged.delete(summary.conversationKey);
      continue;
    }
    const local = merged.get(summary.conversationKey);
    if (!local || recordUpdatedTime(summary) > recordUpdatedTime(local)) {
      merged.set(summary.conversationKey, { ...summary, _summaryOnly: true });
    }
  }

  return [...merged.values()].sort((a, b) => getLatestActivityDate(b).getTime() - getLatestActivityDate(a).getTime());
}

async function refreshRecords() {
  const localRecords = await listAtendimentos();
  state.records = mergeLocalAndRemoteSummaries(localRecords);
}

async function fetchRemoteRecords() {
  const query = new URLSearchParams({ device_id: CLOUD_WORKSPACE, summary: "1" });
  const response = await fetch(`/api/atendimentos?${query}`, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Não foi possível atualizar os atendimentos.");
  const payload = await response.json();
  return {
    storage: payload.storage || "local",
    records: Array.isArray(payload.records) ? payload.records : []
  };
}

async function pullRemoteRecords() {
  if (state.syncing || state.processing) return false;
  state.syncing = true;
  let changed = false;

  try {
    const payload = await fetchRemoteRecords();
    state.cloudAvailable = payload.storage === "supabase";
    if (!state.cloudAvailable) return false;

    const previous = state.remoteSummaries;
    const next = new Map();
    for (const remote of payload.records) {
      if (state.deletingKeys.has(remote.conversationKey)) continue;
      next.set(remote.conversationKey, remote);
      const old = previous.get(remote.conversationKey);
      if (!old || recordUpdatedTime(old) !== recordUpdatedTime(remote) || Boolean(old.metadata?.deletedAt) !== Boolean(remote.metadata?.deletedAt)) {
        changed = true;
      }

      if (remote.metadata?.deletedAt) {
        const local = await getAtendimento(remote.conversationKey);
        if (local) {
          await deleteAtendimento(remote.conversationKey);
          changed = true;
        }
      }
    }
    if (previous.size !== next.size) changed = true;
    state.remoteSummaries = next;
  } catch {
    state.cloudAvailable = false;
  } finally {
    state.syncing = false;
  }

  return changed;
}

async function pushRemoteRecord(record) {
  try {
    const response = await fetch("/api/atendimentos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ...record, deviceId: CLOUD_WORKSPACE })
    });
    if (!response.ok) return false;
    return await response.json().catch(() => ({}));
  } catch {
    return null;
  }
}

async function deleteRemoteRecord(record) {
  try {
    const query = new URLSearchParams({
      device_id: CLOUD_WORKSPACE,
      conversation_key: record.conversationKey
    });
    const response = await fetch(`/api/atendimentos?${query}`, {
      method: "DELETE",
      headers: { Accept: "application/json" }
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function refreshFromCloud({ render = true } = {}) {
  const changed = await pullRemoteRecords();
  if (!changed) return false;

  await refreshRecords();
  if (render) {
    const routeKey = getRouteKey();
    if (routeKey && !state.records.some(item => item.conversationKey === routeKey)) {
      navigateToList();
      showToast("Este lead foi excluído em outro aparelho.");
    } else {
      await renderRoute();
    }
  }
  return true;
}

function startAutomaticSync() {
  clearInterval(state.syncTimer);
  state.syncTimer = setInterval(() => {
    refreshFromCloud().catch(() => null);
  }, AUTO_SYNC_INTERVAL_MS);
}

function getZipLib() {
  const z = globalThis.zip;
  if (!z?.ZipReader) throw new Error("O leitor de ZIP não foi carregado.");
  return z;
}

// Mapeia apenas os áudios .opus -> entrada do ZIP. As fotos, vídeos e PDFs
// ficam de fora: nunca são lidos nem baixados, só os áudios e o texto entram.
function buildAudioMap(entries) {
  const map = new Map();
  for (const entry of entries) {
    if (entry.directory || !/\.opus$/i.test(entry.filename)) continue;
    map.set(normalizeFileName(entry.filename), entry);
  }
  return map;
}

function audioCacheKey(entry, item) {
  const filename = normalizeFileName(entry?.filename || item?.audioFile || "");
  const size = Number(entry?.uncompressedSize || entry?.compressedSize || 0);
  const modified = entry?.lastModDate instanceof Date ? entry.lastModDate.getTime() : "";
  const timestamp = item?.timestamp || "";
  return simpleHash([filename, size, modified, timestamp].join("|"));
}

function applyCachedTranscription(item, cached) {
  if (!item || !cached) return false;
  item.text = cached.text || "";
  item.transcriptionStatus = cached.status || "done";
  item.transcriptionAttempts = 0;
  item.transcriptionCached = true;
  item.transcriptionCachedAt = cached.createdAt || new Date().toISOString();
  return Boolean(item.text || item.transcriptionStatus === "done");
}

async function transcribeAudio(entry, fullName, signal) {
  if (!entry) {
    return { text: "", status: "missing" };
  }

  const z = getZipLib();
  let blob;
  try {
    // Lê só este áudio de dentro do ZIP (sem carregar o restante do arquivo).
    blob = await entry.getData(new z.BlobWriter("audio/ogg"));
  } catch {
    return { text: "", status: "missing" };
  }
  if (blob.size > MAX_AUDIO_TRANSCRIPTION_BYTES) {
    return { text: "", status: "too_large" };
  }

  const response = await fetch(`/api/transcrever?filename=${encodeURIComponent(fullName)}`, {
    method: "POST",
    headers: {
      "Content-Type": "audio/ogg",
      "X-File-Name": encodeURIComponent(fullName)
    },
    body: blob,
    signal
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const error = new Error(payload.error || "Falha ao transcrever o áudio.");
    error.fatal = response.status === 503 || payload.code === "OPENAI_NOT_CONFIGURED";
    throw error;
  }

  const text = String(payload.text || "").trim();
  return { text, status: text ? "done" : "empty" };
}

function wait(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createImportCancelledError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    function onAbort() {
      clearTimeout(timer);
      reject(createImportCancelledError());
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function transcribeAudioWithRetry(entry, fullName, onRetry, signal) {
  let lastResult = { text: "", status: "error" };
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_TRANSCRIPTION_ATTEMPTS; attempt += 1) {
    throwIfImportCancelled();
    try {
      const result = await transcribeAudio(entry, fullName, signal);
      lastResult = result;
      if (result.status === "done" && result.text) return { ...result, attempts: attempt };
      if (result.status === "missing" || result.status === "too_large") return { ...result, attempts: attempt };
    } catch (error) {
      if (error?.name === "AbortError" || error?.code === "IMPORT_CANCELLED") throw createImportCancelledError();
      if (error.fatal) {
        return { text: error.message, status: "error", attempts: attempt };
      }
      lastError = error;
    }

    if (attempt < MAX_TRANSCRIPTION_ATTEMPTS) {
      onRetry?.(attempt + 1);
      await wait(TRANSCRIPTION_RETRY_DELAY_MS * attempt, signal);
    }
  }

  return {
    text: lastResult.text || lastError?.message || "Não foi possível transcrever este áudio.",
    status: "error",
    attempts: MAX_TRANSCRIPTION_ATTEMPTS
  };
}

function mergeTimeline(existingTimeline, incomingTimeline) {
  const merged = new Map();
  for (const item of existingTimeline || []) merged.set(item.fingerprint, item);

  let added = 0;
  const addedItems = [];
  for (const incoming of incomingTimeline) {
    const previous = merged.get(incoming.fingerprint);
    if (previous) {
      if (incoming.type === "audio") {
        const previousDone = previous.transcriptionStatus === "done" && previous.text;
        const incomingDone = incoming.transcriptionStatus === "done" && incoming.text;
        if (previousDone && !incomingDone) {
          // Mantém transcrição bem-sucedida anterior; novo texto de erro é descartado.
          merged.set(incoming.fingerprint, { ...incoming, ...previous });
        } else {
          // Transcrição nova bem-sucedida ou ambas com falha: incoming prevalece,
          // inclusive o texto de erro mais recente.
          merged.set(incoming.fingerprint, { ...previous, ...incoming });
        }
      } else {
        merged.set(incoming.fingerprint, { ...previous, ...incoming });
      }
      continue;
    }
    merged.set(incoming.fingerprint, incoming);
    added += 1;
    addedItems.push(incoming);
  }

  const timeline = [...merged.values()].sort((a, b) => {
    const aTime = Date.parse(a.timestamp || 0) || 0;
    const bTime = Date.parse(b.timestamp || 0) || 0;
    if (aTime !== bTime) return aTime - bTime;
    return (a.sourceOrder || 0) - (b.sourceOrder || 0);
  });

  addedItems.sort((a, b) => {
    const aTime = Date.parse(a.timestamp || 0) || 0;
    const bTime = Date.parse(b.timestamp || 0) || 0;
    if (aTime !== bTime) return aTime - bTime;
    return (a.sourceOrder || 0) - (b.sourceOrder || 0);
  });

  return { timeline, added, addedItems };
}

function isAudioOutsidePeriod(item) {
  return item?.type === "audio" && item?.transcriptionStatus === "outside_period";
}

function isAudioFailure(item) {
  return item?.type === "audio" && item?.transcriptionStatus !== "done" && !isAudioOutsidePeriod(item);
}

function shouldRetryAudio(previous) {
  if (!previous || previous.type !== "audio") return false;
  const status = previous.transcriptionStatus;
  if (status === "done" || status === "outside_period" || status === "too_large") return false;
  return !status || status === "error" || status === "empty" || status === "missing";
}

async function processIncomingZip(pending) {
  if (state.processing) return;
  showProcessing();

  let zipReader = null;
  try {
    if (!pending?.blob) {
      throw new Error("O arquivo recebido não é um ZIP válido do WhatsApp.");
    }
    const z = getZipLib();
    const signal = state.importAbortController?.signal;

    setProcessingTelemetry(pending.name || "Conversa do WhatsApp", "Lendo o arquivo recebido");
    setProcessing("read", 0, "Abrindo o ZIP recebido pelo compartilhamento.");
    let entries;
    try {
      zipReader = new z.ZipReader(new z.BlobReader(pending.blob));
      entries = await zipReader.getEntries();
      throwIfImportCancelled();
    } catch (error) {
      if (state.importCancelled) throw createImportCancelledError();
      throw new Error("O arquivo recebido não é um ZIP válido do WhatsApp.");
    }

    const txtEntries = entries.filter(entry => !entry.directory && /\.txt$/i.test(entry.filename));
    if (!txtEntries.length) throw new Error("Nenhum arquivo de conversa .txt foi encontrado no ZIP.");

    const txtEntry = txtEntries[0];
    setProcessingTelemetry(txtEntry.filename, "Lendo mensagens escritas");
    const rawText = await txtEntry.getData(new z.TextWriter());
    throwIfImportCancelled();
    const parsedTimeline = parseWhatsappTxt(rawText);
    if (!parsedTimeline.length) throw new Error("O TXT foi encontrado, mas nenhuma mensagem pôde ser lida.");

    setProcessing("audio", 1, "Localizando somente os áudios .opus da conversa.");
    setProcessingTelemetry("Localizando áudios", `${parsedTimeline.length} itens encontrados na conversa`);
    const originalLeadName = inferLeadName(pending.name || txtEntry.filename);
    const identity = await resolveConversationIdentity(originalLeadName, parsedTimeline);
    const conversationKey = identity.conversationKey;
    const existing = identity.existing;
    throwIfImportCancelled();
    const existingByFingerprint = new Map((existing?.timeline || []).map(item => [item.fingerprint, item]));
    const audioMap = buildAudioMap(entries);
    const audioItems = parsedTimeline.filter(item => item.type === "audio");
    const audioItemsToProcess = audioItems.filter(item => {
      const previous = existingByFingerprint.get(item.fingerprint);
      return !previous || shouldRetryAudio(previous);
    });
    const referenceTimestamp = getLatestTimelineTimestamp(parsedTimeline);

    let selectedPeriod = "all";
    if (audioItemsToProcess.length) {
      selectedPeriod = await waitForAudioPeriodSelection(audioItemsToProcess, referenceTimestamp);
      if (!selectedPeriod || state.importCancelled) throw createImportCancelledError();
    }
    if (audioPeriodPanel) audioPeriodPanel.hidden = true;
    if (processingLive) processingLive.hidden = false;

    const selectedAudioItems = [];
    for (const item of audioItemsToProcess) {
      if (isAudioWithinSelectedPeriod(item, selectedPeriod, referenceTimestamp)) {
        selectedAudioItems.push(item);
      } else {
        item.text = "Não transcrito por estar fora do período selecionado.";
        item.transcriptionStatus = "outside_period";
        item.transcriptionAttempts = 0;
        item.transcriptionPeriod = selectedPeriod;
      }
    }

    const totalToTranscribe = selectedAudioItems.length;
    let completedAudios = 0;
    if (totalToTranscribe) {
      setProcessing("transcribe", 1, `Transcrevendo ${totalToTranscribe} áudio${totalToTranscribe === 1 ? "" : "s"} novo${totalToTranscribe === 1 ? "" : "s"}.`);
      for (let index = 0; index < selectedAudioItems.length; index += 1) {
        throwIfImportCancelled();
        const item = selectedAudioItems[index];
        const audioEntry = audioMap.get(normalizeFileName(item.audioFile));
        const beforePercent = 1 + (completedAudios / Math.max(totalToTranscribe, 1)) * 91;
        setProcessing(
          "transcribe",
          beforePercent,
          `Processando áudio ${index + 1} de ${totalToTranscribe}.`
        );
        setProcessingTelemetry(
          audioEntry?.filename || item.audioFile || `Áudio ${index + 1}`,
          `${completedAudios} concluído${completedAudios === 1 ? "" : "s"} · ${totalToTranscribe - completedAudios} restante${totalToTranscribe - completedAudios === 1 ? "" : "s"}`
        );

        if (!audioEntry) {
          item.transcriptionStatus = "missing";
          item.transcriptionAttempts = 0;
          item.text = "Não foi possível localizar este áudio dentro do ZIP.";
        } else {
          const cacheKey = audioCacheKey(audioEntry, item);
          const cached = await getCachedTranscription(cacheKey).catch(() => null);
          if (applyCachedTranscription(item, cached)) {
            item.transcriptionPeriod = selectedPeriod;
            setProcessingTelemetry(audioEntry.filename, "Transcrição reaproveitada do cache local");
          } else {
            try {
              const result = await transcribeAudioWithRetry(
                audioEntry,
                audioEntry.filename,
                nextAttempt => {
                  setProcessing(
                    "transcribe",
                    beforePercent,
                    `O áudio ${index + 1} falhou. Tentando novamente (${nextAttempt}/${MAX_TRANSCRIPTION_ATTEMPTS}).`
                  );
                  setProcessingTelemetry(
                    audioEntry.filename,
                    `${completedAudios} concluído${completedAudios === 1 ? "" : "s"} · nova tentativa em andamento`
                  );
                },
                signal
              );
              item.text = result.text || (
                result.status === "too_large"
                  ? "Este áudio ultrapassa o limite permitido para transcrição."
                  : "O áudio não retornou texto após novas tentativas."
              );
              item.transcriptionStatus = result.status;
              item.transcriptionAttempts = result.attempts;
              item.transcriptionPeriod = selectedPeriod;
              if (result.status === "done" && result.text) {
                await saveCachedTranscription({ cacheKey, text: result.text, status: result.status, filename: audioEntry.filename, size: audioEntry.uncompressedSize || audioEntry.compressedSize || 0 }).catch(() => null);
              }
            } catch (error) {
              if (error?.code === "IMPORT_CANCELLED" || error?.name === "AbortError") throw createImportCancelledError();
              if (error.fatal) throw error;
              item.text = "Não foi possível transcrever este áudio após 3 tentativas.";
              item.transcriptionStatus = "error";
              item.transcriptionAttempts = MAX_TRANSCRIPTION_ATTEMPTS;
              item.transcriptionPeriod = selectedPeriod;
            }
          }
        }

        completedAudios += 1;
        const progress = 1 + (completedAudios / Math.max(totalToTranscribe, 1)) * 91;
        setProcessing(
          "transcribe",
          progress,
          `${completedAudios} de ${totalToTranscribe} áudio${totalToTranscribe === 1 ? "" : "s"} concluído${completedAudios === 1 ? "" : "s"}.`
        );
        setProcessingTelemetry(
          audioEntry?.filename || item.audioFile || `Áudio ${index + 1}`,
          `${completedAudios} concluído${completedAudios === 1 ? "" : "s"} · ${totalToTranscribe - completedAudios} restante${totalToTranscribe - completedAudios === 1 ? "" : "s"}`
        );
      }
    } else {
      setProcessing(
        "transcribe",
        92,
        audioItemsToProcess.length
          ? "Nenhum áudio novo ou com falha está dentro do período selecionado."
          : "Nenhum áudio novo ou com falha precisa ser transcrito."
      );
      setProcessingTelemetry(
        audioItemsToProcess.length ? "Áudios mantidos fora do período" : "Mensagens prontas",
        `${audioItemsToProcess.length} áudio${audioItemsToProcess.length === 1 ? "" : "s"} novo${audioItemsToProcess.length === 1 ? " ou com falha" : "s ou com falha"}`
      );
    }

    throwIfImportCancelled();
    setProcessing("timeline", 94, "Unindo mensagens escritas e transcrições na ordem correta.");
    setProcessingTelemetry("Montando linha do tempo", `${parsedTimeline.length} itens analisados`);
    const merged = mergeTimeline(existing?.timeline, parsedTimeline);
    const lastItem = merged.timeline[merged.timeline.length - 1];
    const now = new Date().toISOString();
    const deviceId = CLOUD_WORKSPACE;
    const failedAudioCount = merged.timeline.filter(isAudioFailure).length;
    const outsidePeriodAudioCount = merged.timeline.filter(isAudioOutsidePeriod).length;
    const nextMetadata = {
      ...(existing?.metadata || {}),
      originalLeadName,
      conversationDna: identity.dna,
      usuarioApp: APP_USER_NAME,
      txtFile: txtEntry.filename,
      totalItens: merged.timeline.length,
      totalAudios: merged.timeline.filter(item => item.type === "audio").length,
      audiosNaoTranscritos: failedAudioCount,
      audiosForaPeriodo: outsidePeriodAudioCount,
      periodoAudioUltimaImportacao: selectedPeriod,
      ignoredMedia: true,
      lastReceivedAt: pending.receivedAt || now
    };
    if (merged.added > 0) {
      const addedWithTime = merged.addedItems
        .map(item => ({ item, timestamp: timelineItemTimestamp(item) }))
        .filter(entry => Number.isFinite(entry.timestamp))
        .sort((a, b) => a.timestamp - b.timestamp);
      const latestAddedItem = addedWithTime.at(-1)?.item || merged.addedItems[merged.addedItems.length - 1];
      const movementTimestamp = timelineItemTimestamp(latestAddedItem) ?? timelineItemTimestamp(lastItem);
      const movementAt = Number.isFinite(movementTimestamp) ? new Date(movementTimestamp).toISOString() : now;
      nextMetadata.ultimaMovimentacaoAt = movementAt;

      if (isClientTimelineItem(latestAddedItem)) {
        nextMetadata.statusAtendimento = "nova_resposta_cliente";
        nextMetadata.novaRespostaClienteAt = movementAt;
        nextMetadata.origemUltimaMovimentacao = "mensagem_cliente";
        delete nextMetadata.atendidoAgoraAt;
        delete nextMetadata.reanaliseDisponivelEm;
      } else {
        nextMetadata.statusAtendimento = "aguardando_resposta";
        nextMetadata.atendidoAgoraAt = movementAt;
        delete nextMetadata.reanaliseDisponivelEm;
        nextMetadata.origemUltimaMovimentacao = "mensagem_corretor";
        delete nextMetadata.novaRespostaClienteAt;
      }
    }

    const record = {
      id: existing?.id || globalThis.crypto?.randomUUID?.() || `attendance-${Date.now()}`,
      deviceId,
      conversationKey,
      nomeLead: existing?.nomeLead || originalLeadName,
      arquivoOrigem: pending.name,
      ultimaMensagemAt: lastItem?.timestamp || now,
      ultimaMensagemResumo: lastItem?.text || "Áudio recebido",
      timeline: merged.timeline,
      metadata: nextMetadata,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    throwIfImportCancelled();
    if (cancelImportButton) {
      cancelImportButton.disabled = true;
      cancelImportButton.textContent = "Finalizando...";
    }
    setProcessing("save", 97, "Salvando o atendimento neste aparelho.");
    setProcessingTelemetry("Salvando atendimento", `${merged.added} novo${merged.added === 1 ? " item" : "s itens"}`);
    await saveAtendimento(record);
    const cloudResult = await pushRemoteRecord(record);
    await removePendingShare();

    setProcessing("save", 100, "Atendimento pronto.", "Conversa processada");
    setProcessingTelemetry("Importação concluída", `${merged.timeline.length} itens no histórico`);
    await new Promise(resolve => setTimeout(resolve, 350));
    hideProcessing();
    cleanShareQuery();
    await refreshRecords();
    navigateToAttendance(conversationKey);

    if (failedAudioCount) {
      showToast(
        `${failedAudioCount} áudio${failedAudioCount === 1 ? " não foi transcrito" : "s não foram transcritos"} após novas tentativas. O atendimento está com informação incompleta.`,
        "error",
        9000
      );
    } else if (!cloudResult) {
      showToast("Salvo neste aparelho, mas ainda não sincronizado.", "error", 7000);
    } else if (outsidePeriodAudioCount) {
      showToast(`${outsidePeriodAudioCount} áudio${outsidePeriodAudioCount === 1 ? " antigo ficou" : "s antigos ficaram"} fora do período selecionado.`);
    } else if (existing) {
      showToast(merged.added ? `${merged.added} novo${merged.added === 1 ? " item adicionado" : "s itens adicionados"}.` : "Nenhuma mensagem nova foi encontrada.");
    } else {
      showToast("Atendimento criado e salvo.");
    }
  } catch (error) {
    const cancelled = error?.code === "IMPORT_CANCELLED" || state.importCancelled || error?.name === "AbortError";
    if (cancelled) await removePendingShare().catch(() => null);
    hideProcessing();
    cleanShareQuery();
    await refreshRecords();
    await renderRoute();
    showToast(cancelled ? "Importação cancelada. Nenhum atendimento parcial foi salvo." : (error?.message || "Não foi possível processar a conversa."), cancelled ? "normal" : "error", 7000);
  } finally {
    try { await zipReader?.close(); } catch { /* leitor sem recursos a liberar */ }
  }
}

async function installApp() {
  if (!state.installPrompt) return;
  state.installPrompt.prompt();
  await state.installPrompt.userChoice.catch(() => null);
  state.installPrompt = null;
  installButton.hidden = true;
  renderRoute();
}

function openRenameDialog() {
  if (!state.currentKey) return;
  const record = state.records.find(item => item.conversationKey === state.currentKey);
  if (!record) return;
  renameInput.value = record.nomeLead;
  renameDialog.showModal();
  requestAnimationFrame(() => renameInput.select());
}

async function saveRenamedAttendance() {
  const name = renameInput.value.trim();
  if (!name || !state.currentKey) return;
  const record = await getAtendimento(state.currentKey);
  if (!record) return;
  const updated = { ...record, nomeLead: name, updatedAt: new Date().toISOString() };
  await saveAtendimento(updated);
  await pushRemoteRecord(updated);
  await refreshRecords();
  renderDetail(updated);
  showToast("Nome atualizado.");
}

async function setContactType(type) {
  if (type !== "cliente" && type !== "corretor") return;
  const record = await getCurrentRecord();
  if (!record || getContactType(record)) return;

  const now = new Date().toISOString();
  const metadata = {
    ...(record.metadata || {}),
    tipoContato: type,
    tipoContatoDefinidoEm: now
  };
  delete metadata.analiseComercial;
  const updated = { ...record, metadata, updatedAt: now };

  try {
    await saveAtendimento(updated);
    updateRecordInState(updated);
    renderDetail(updated);
    showToast(type === "corretor" ? "Contato definido como corretor parceiro." : "Contato definido como cliente.");
    pushRemoteRecord(updated).then(result => {
      if (!result) showToast("A classificação ficou salva neste aparelho, mas a nuvem não confirmou a atualização.", "error", 7000);
    });
  } catch {
    showToast("Não foi possível salvar o tipo de contato.", "error", 7000);
  }
}

async function registerLeadAttended(record, source, successMessage) {
  if (!record) return null;
  const now = new Date().toISOString();
  const metadata = {
    ...(record.metadata || {}),
    statusAtendimento: "aguardando_resposta",
    atendidoAgoraAt: now,
    ultimaMovimentacaoAt: now,
    origemUltimaMovimentacao: source
  };
  delete metadata.reanaliseDisponivelEm;
  const updated = {
    ...record,
    metadata,
    updatedAt: now
  };

  try {
    await saveAtendimento(updated);
    updateRecordInState(updated);
    renderDetail(updated);
    showToast(successMessage || `Atendimento registrado agora. ${getContactRoleText(updated, "waiting")}.`);

    pushRemoteRecord(updated).then(result => {
      if (!result) {
        showToast("O atendimento foi registrado neste aparelho, mas a nuvem não confirmou a atualização.", "error", 7000);
      }
    });
    return updated;
  } catch {
    showToast("Não foi possível registrar o atendimento agora.", "error", 7000);
    return null;
  }
}

async function markAttendedNow() {
  const record = await getCurrentRecord();
  if (!record) return;
  await registerLeadAttended(record, "atendido_agora", `Atendimento registrado agora. ${getContactRoleText(record, "waiting")}.`);
}

async function deleteCurrentLead() {
  if (!state.currentKey) return;
  const record = state.records.find(item => item.conversationKey === state.currentKey)
    || await getAtendimento(state.currentKey);
  if (!record) return;

  const confirmed = window.confirm(`Excluir o lead "${record.nomeLead}"? Esta ação removerá o atendimento deste site em todos os aparelhos.`);
  if (!confirmed) return;

  const previousRecords = [...state.records];
  state.deletingKeys.add(record.conversationKey);
  state.records = state.records.filter(item => item.conversationKey !== record.conversationKey);
  state.currentKey = null;
  state.detailPeriod = "30";
  history.replaceState({}, "", `${location.pathname}${location.search}#/`);
  renderList();

  try {
    await deleteAtendimento(record.conversationKey);
    const remoteDeleted = await deleteRemoteRecord(record);
    if (!remoteDeleted) throw new Error("Falha ao excluir na nuvem.");
    showToast("Lead excluído.");
  } catch {
    await saveAtendimento(record).catch(() => null);
    state.records = previousRecords;
    renderList();
    showToast("Não foi possível concluir a exclusão. O lead foi restaurado.", "error", 7000);
  } finally {
    state.deletingKeys.delete(record.conversationKey);
  }
}

function bindEvents() {
  window.addEventListener("hashchange", renderRoute);
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    state.installPrompt = event;
    installButton.hidden = isStandalone();
    renderRoute();
  });
  window.addEventListener("appinstalled", () => {
    state.installPrompt = null;
    installButton.hidden = true;
    renderRoute();
    showToast("Corretor Pro instalado.");
  });

  backButton?.addEventListener("click", navigateToList);
  brandButton?.addEventListener("click", navigateToList);
  installButton?.addEventListener("click", installApp);
  editNameButton?.addEventListener("click", openRenameDialog);
  cancelImportButton?.addEventListener("click", cancelCurrentImport);
  audioPeriodPanel?.addEventListener("click", event => {
    const trigger = event.target.closest("[data-audio-import-period]");
    if (trigger) setAudioPeriodSelection(trigger.dataset.audioImportPeriod);
  });
  audioPeriodContinueButton?.addEventListener("click", () => {
    const resolve = state.audioPeriodResolver;
    state.audioPeriodResolver = null;
    resolve?.(state.audioPeriodSelection);
  });

  app?.addEventListener("click", async event => {
    const installTrigger = event.target.closest("[data-install]");
    if (installTrigger) {
      installApp();
      return;
    }

    const contactTypeTrigger = event.target.closest("[data-contact-type]");
    if (contactTypeTrigger) {
      await setContactType(contactTypeTrigger.dataset.contactType);
      return;
    }

    const periodTrigger = event.target.closest("[data-detail-period]");
    if (periodTrigger) {
      const nextPeriod = periodTrigger.dataset.detailPeriod;
      if (DETAIL_PERIODS.some(option => option.value === nextPeriod)) {
        state.detailPeriod = nextPeriod;
        const record = await getCurrentRecord();
        if (record) renderDetail(record);
      }
      return;
    }

    const copyTrigger = event.target.closest("[data-copy-messages]");
    if (copyTrigger) {
      await copySelectedMessages();
      return;
    }

    const attachProposalTrigger = event.target.closest("[data-attach-proposal]");
    if (attachProposalTrigger) {
      app.querySelector("[data-proposal-input]")?.click();
      return;
    }

    const showAllTrigger = event.target.closest("[data-show-all-leads]");
    if (showAllTrigger) {
      const all = document.getElementById("all-leads");
      if (all) {
        all.open = true;
        all.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    const copyHomeTrigger = event.target.closest("[data-copy-home-suggestion]");
    if (copyHomeTrigger) {
      await copyHomeSuggestedMessage(copyHomeTrigger.dataset.copyHomeSuggestion);
      return;
    }

    const analyzeTrigger = event.target.closest("[data-analyze-attendance]");
    if (analyzeTrigger) {
      await analyzeCurrentAttendance();
      return;
    }

    const copySuggestionTrigger = event.target.closest("[data-copy-suggestion]");
    if (copySuggestionTrigger) {
      await copySuggestedMessage(Number(copySuggestionTrigger.dataset.copySuggestion));
      return;
    }

    const attendedNowTrigger = event.target.closest("[data-attended-now]");
    if (attendedNowTrigger) {
      await markAttendedNow();
      return;
    }

    const deleteTrigger = event.target.closest("[data-delete-lead]");
    if (deleteTrigger) {
      await deleteCurrentLead();
      return;
    }

    const saveNotaTrigger = event.target.closest("[data-save-nota]");
    if (saveNotaTrigger) {
      const record = await getCurrentRecord();
      if (!record) return;
      const textarea = document.getElementById(`nota-textarea-${record.conversationKey}`);
      const texto = (textarea?.value || "").trim();
      const prints = [...state.notaPrintsPendentes];
      if (!texto && !prints.length) return;
      state.notaPrintsPendentes = [];
      await processarPrintsENota(record, texto, prints);
      return;
    }

    const clearPrintsTrigger = event.target.closest("[data-clear-prints]");
    if (clearPrintsTrigger) {
      state.notaPrintsPendentes = [];
      const record = await getCurrentRecord();
      if (record) renderDetail(record);
      return;
    }

    const recordNotaTrigger = event.target.closest("[data-toggle-record-nota]");
    if (recordNotaTrigger) {
      const record = await getCurrentRecord();
      if (record) await toggleNotaRecording(record);
      return;
    }

    const deleteNotaTrigger = event.target.closest("[data-delete-nota]");
    if (deleteNotaTrigger) {
      const record = await getCurrentRecord();
      if (record) await deleteNota(record, deleteNotaTrigger.dataset.deleteNota);
      return;
    }
    const addLeadTrigger = event.target.closest("[data-add-lead]");
    if (addLeadTrigger) {
      addLeadForm?.reset();
      addLeadDialog?.showModal();
      return;
    }

    const card = event.target.closest("[data-attendance]");
    if (card) navigateToAttendance(card.dataset.attendance);
  });

  app?.addEventListener("change", async event => {
    const proposalInput = event.target.closest("[data-proposal-input]");
    if (proposalInput) {
      const file = proposalInput.files?.[0];
      proposalInput.value = "";
      if (file) await attachProposalImage(file);
      return;
    }
    const printInput = event.target.closest("[data-print-nota-input]");
    if (printInput) {
      const files = [...(printInput.files || [])];
      printInput.value = "";
      if (files.length) {
        const record = await getCurrentRecord();
        if (record) await handlePrintsAnexo(record, files);
      }
    }
  });

  app?.addEventListener("paste", async event => {
    if (!event.target.closest(".nota-textarea")) return;
    const images = [...(event.clipboardData?.items || [])]
      .filter(item => item.type.startsWith("image/"))
      .map(item => item.getAsFile())
      .filter(Boolean);
    if (!images.length) return;
    event.preventDefault();
    const record = await getCurrentRecord();
    if (record) await handlePrintsAnexo(record, images);
    // Não processa automaticamente — acumula e aguarda o Salvar nota
  });

  renameForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (event.submitter?.value === "save") await saveRenamedAttendance();
    renameDialog.close();
  });

  addLeadForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (event.submitter?.value === "save") {
      const data = new FormData(addLeadForm);
      await createManualLead(
        data.get("name"),
        data.get("phone"),
        data.get("empreendimento"),
        data.get("notes")
      );
    }
    addLeadDialog.close();
  });

  window.addEventListener("focus", () => refreshFromCloud().catch(() => null));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshFromCloud().catch(() => null);
  });

}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    let reloadingForUpdate = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingForUpdate) return;
      reloadingForUpdate = true;
      window.location.reload();
    });

    const registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
    registration.update().catch(() => null);
  } catch {
    showToast("Não foi possível ativar a instalação do aplicativo.", "error");
  }
}

async function init() {
  // Lê o ZIP na thread principal (sem web workers): evita arquivos extras e
  // funciona offline. Só lemos texto e áudios pequenos, então é leve.
  globalThis.zip?.configure?.({ useWebWorkers: false });
  if (headerVersion) headerVersion.textContent = APP_VERSION;
  bindEvents();
  await refreshRecords();
  await renderRoute();
  startAutomaticSync();
  registerServiceWorker().catch(() => null);
  refreshFromCloud().catch(() => null);

  const params = new URLSearchParams(location.search);
  const shareError = params.get("share_error");
  if (shareError) {
    cleanShareQuery();
    const messages = {
      sem_arquivo: "O WhatsApp não enviou nenhum arquivo. Ao exportar a conversa, escolha “Incluir mídias” e compartilhe o arquivo.",
      leitura: "Não foi possível ler o arquivo compartilhado. Exporte a conversa de novo e compartilhe.",
      muito_grande: "Esta conversa passou de 2 GB. Ao exportar, prefira um período menor para reduzir o tamanho.",
      armazenamento: "Não foi possível salvar o arquivo no aparelho. Verifique o espaço livre e tente outra vez.",
      arquivo_invalido: "O WhatsApp não enviou um arquivo válido. Exporte a conversa com “Incluir mídias”.",
      falha_ao_receber: "Houve uma falha ao receber o arquivo. Tente compartilhar novamente."
    };
    showToast(messages[shareError] || "O arquivo compartilhado não pôde ser recebido. Envie um ZIP exportado do WhatsApp.", "error", 8000);
  }

  const pending = await getPendingShare().catch(() => null);
  if (pending) await processIncomingZip(pending);
}

init().catch(error => {
  hideProcessing();
  showToast(error?.message || "Falha ao iniciar o Corretor Pro.", "error", 7000);
});
