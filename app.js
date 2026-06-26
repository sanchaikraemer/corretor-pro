import {
  deleteAtendimento,
  getAtendimento,
  getPendingShare,
  listAtendimentos,
  removePendingShare,
  saveAtendimento
} from "./db.js?v=023";
import {
  inferLeadName,
  initials,
  makeConversationKey,
  normalizeFileName,
  parseWhatsappTxt
} from "./whatsapp.js?v=023";

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
const toast = document.querySelector("#toast");
const renameDialog = document.querySelector("#rename-dialog");
const renameForm = document.querySelector("#rename-form");
const renameInput = document.querySelector("#rename-input");

const APP_VERSION = "v023";
const CLOUD_WORKSPACE = "corretor-pro-site";
const AUTO_SYNC_INTERVAL_MS = 15000;
const MAX_TRANSCRIPTION_ATTEMPTS = 3;
const TRANSCRIPTION_RETRY_DELAY_MS = 1200;
const MAX_PROPOSAL_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_PROPOSAL_DATA_URL_LENGTH = 1_800_000;
const MAX_PROPOSAL_DIMENSION = 2000;
const PROCESSING_STEPS = ["read", "audio", "transcribe", "timeline", "save"];
const state = {
  records: [],
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
  proposalBusy: false
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

function setProcessing(step, percent, description, title = "Processando conversa") {
  processingTitle.textContent = title;
  processingDescription.textContent = description;
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  progressBar.style.width = `${safePercent}%`;
  progressLabel.textContent = `${safePercent}%`;

  const activeIndex = PROCESSING_STEPS.indexOf(step);
  document.querySelectorAll(".processing-steps li").forEach((item, index) => {
    item.classList.toggle("done", index < activeIndex || safePercent === 100);
    item.classList.toggle("active", index === activeIndex && safePercent < 100);
  });
}

function showProcessing() {
  state.processing = true;
  processingOverlay.hidden = false;
  document.body.style.overflow = "hidden";
  setProcessing("read", 3, "Abrindo o arquivo enviado pelo WhatsApp.", "Processando conversa");
}

function hideProcessing() {
  state.processing = false;
  processingOverlay.hidden = true;
  document.body.style.overflow = "";
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
      ? (item.transcriptionStatus === "done" ? "[Áudio transcrito] " : "[Áudio não transcrito] ")
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
}

async function getCurrentRecord() {
  if (!state.currentKey) return null;
  return state.records.find(item => item.conversationKey === state.currentKey)
    || await getAtendimento(state.currentKey);
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
  return {
    leadName: record.nomeLead,
    period: selectedPeriodLabel(),
    messages: formatTimelineForCopy(timeline),
    messageCount: timeline.length,
    incompleteAudioCount: (timeline || []).filter(item => item.type === "audio" && item.transcriptionStatus !== "done").length,
    proposalImage: proposal && isSafeProposalDataUrl(proposal.dataUrl) ? proposal.dataUrl : null,
    proposalAttachedAt: proposal?.attachedAt || null
  };
}

async function analyzeCurrentAttendance() {
  const record = await getCurrentRecord();
  if (!record || state.analyzingKey) return;
  const timeline = filterTimelineByPeriod(record.timeline);
  if (!timeline.length) {
    showToast(`Não há mensagens em ${selectedPeriodLabel().toLowerCase()} para analisar.`, "error");
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
  showToast(copied ? "Mensagem copiada." : "Não foi possível copiar a mensagem.", copied ? "normal" : "error");
}

async function copySelectedMessages() {
  if (!state.currentKey) return;
  const record = state.records.find(item => item.conversationKey === state.currentKey)
    || await getAtendimento(state.currentKey);
  if (!record) return;

  const timeline = filterTimelineByPeriod(record.timeline);
  if (!timeline.length) {
    showToast(`Não há mensagens em ${selectedPeriodLabel().toLowerCase()}.`, "error");
    return;
  }

  const copied = await writeToClipboard(formatTimelineForCopy(timeline));
  if (!copied) {
    showToast("Não foi possível copiar as mensagens.", "error");
    return;
  }
  showToast(`${timeline.length} mensagem${timeline.length === 1 ? " copiada" : "s copiadas"}.`);
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
}

function setDetailHeader(record) {
  backButton.hidden = false;
  brandButton.hidden = true;
  detailHeader.hidden = false;
  editNameButton.hidden = false;
  installButton.hidden = true;

  detailHeaderTitle.textContent = record.nomeLead;
  const last = new Date(record.ultimaMensagemAt || record.updatedAt || Date.now());
  detailHeaderSubtitle.textContent = Number.isNaN(last.getTime())
    ? "Atendimento salvo"
    : `Última mensagem: ${dateOnlyFormatter.format(last)} às ${timeFormatter.format(last)}`;
}

function renderList() {
  state.currentKey = null;
  setListHeader();

  const cards = state.records.map(record => {
    const moment = formatCardDate(record.ultimaMensagemAt || record.updatedAt);
    return `
      <button class="attendance-card" type="button" data-attendance="${escapeHtml(record.conversationKey)}">
        <span class="avatar">${escapeHtml(initials(record.nomeLead))}</span>
        <span class="attendance-copy">
          <span class="attendance-name">${escapeHtml(record.nomeLead)}</span>
          <span class="attendance-preview">${escapeHtml(record.ultimaMensagemResumo || "Atendimento recebido")}</span>
        </span>
        <span class="attendance-time">${escapeHtml(moment.date)}<span>${escapeHtml(moment.time)}</span></span>
      </button>`;
  }).join("");

  app.innerHTML = `
    <section class="list-page">
      <div class="list-hero">
        <h1>Atendimentos</h1>
        <p>Conversas recebidas e organizadas em texto, na ordem em que aconteceram.</p>
      </div>
      <div class="list-surface">
        ${renderInstallCard()}
        ${state.records.length ? `<section class="attendance-list">${cards}</section>` : renderEmptyState()}
        <div class="storage-note${state.cloudAvailable === false ? " error" : ""}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7h-7V2"/><path d="m20 2-8 8"/><path d="M4 17h7v5"/><path d="m4 22 8-8"/></svg>
          <span>${state.cloudAvailable === false
            ? "A atualização automática está indisponível porque o banco na nuvem não está configurado."
            : "Os atendimentos deste link são <strong>atualizados automaticamente</strong>."}</span>
        </div>
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
    const failed = item.transcriptionStatus !== "done";
    return `
      <article class="timeline-item${leadClass}">
        <div class="timeline-meta">
          <span class="timeline-author">${escapeHtml(item.author)}</span>
          <time class="timeline-time">${escapeHtml(item.time || "")}</time>
        </div>
        <div class="transcription-block${failed ? " error" : ""}">
          <span class="transcription-label">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M8 6v12M4 9v6M16 5v14M20 8v8"/></svg>
            ${failed ? "Áudio não transcrito" : "Áudio transcrito"}
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

  return `
    <section class="proposal-card">
      <div class="section-heading-row">
        <div>
          <span class="section-eyebrow">Contexto financeiro</span>
          <h2>Última proposta</h2>
        </div>
        ${hasSafeImage ? `<span class="proposal-status">Já enviada</span>` : ""}
      </div>
      <p class="section-description">Anexe um print da proposta enviada ao cliente. A análise considerará automaticamente que ela já foi enviada.</p>
      <input id="proposal-image-input" type="file" accept="image/jpeg,image/png,image/webp" data-proposal-input hidden>
      ${hasSafeImage ? `
        <div class="proposal-preview">
          <img src="${escapeHtml(proposal.dataUrl)}" alt="Print da última proposta enviada">
          <div class="proposal-preview-copy">
            <strong>${escapeHtml(proposal.name || "Proposta anexada")}</strong>
            <span>${attachedLabel ? `Anexada em ${escapeHtml(attachedLabel)}` : "Proposta atual"}</span>
            <small>A última imagem anexada substitui a anterior.</small>
          </div>
        </div>
        <button class="secondary-action-button" type="button" data-attach-proposal${busy ? " disabled" : ""}>
          ${busy ? "Preparando imagem..." : "Trocar print da proposta"}
        </button>` : `
        <button class="primary-action-button" type="button" data-attach-proposal${busy ? " disabled" : ""}>
          ${busy ? "Preparando imagem..." : "Anexar print da proposta"}
        </button>`}
    </section>`;
}

function renderTextList(items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return `<span class="analysis-empty-value">Não identificado</span>`;
  return `<ul>${list.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderAnalysisSection(record) {
  const analysis = record.metadata?.analiseComercial;
  const analyzing = state.analyzingKey === record.conversationKey;
  const actionLabel = analyzing
    ? "Analisando conversa e proposta..."
    : analysis
      ? "Atualizar análise"
      : "Analisar atendimento";

  if (!analysis) {
    return `
      <section class="analysis-card analysis-card-empty">
        <div class="section-heading-row">
          <div>
            <span class="section-eyebrow">Inteligência comercial</span>
            <h2>Análise do atendimento</h2>
          </div>
        </div>
        <p class="section-description">A análise usa as mensagens do período selecionado, as transcrições dos áudios e o print da proposta, quando anexado.</p>
        <button class="analysis-button" type="button" data-analyze-attendance${analyzing ? " disabled" : ""}>
          ${escapeHtml(actionLabel)}
        </button>
      </section>`;
  }

  const generatedLabel = formatSavedDate(analysis.generatedAt);
  const suggestions = Array.isArray(analysis.mensagensSugeridas) ? analysis.mensagensSugeridas : [];
  return `
    <section class="analysis-card">
      <div class="section-heading-row analysis-heading">
        <div>
          <span class="section-eyebrow">Inteligência comercial</span>
          <h2>Análise do atendimento</h2>
        </div>
        <button class="analysis-refresh-button" type="button" data-analyze-attendance${analyzing ? " disabled" : ""}>
          ${escapeHtml(actionLabel)}
        </button>
      </div>
      <div class="analysis-meta">
        <span>${escapeHtml(analysis.period || selectedPeriodLabel())}</span>
        <span>${Number(analysis.messageCount || 0)} mensagens</span>
        ${generatedLabel ? `<span>${escapeHtml(generatedLabel)}</span>` : ""}
      </div>
      <div class="analysis-summary">
        <strong>Leitura atual</strong>
        <p>${escapeHtml(analysis.resumo || "")}</p>
      </div>
      <div class="analysis-facts">
        <div><span>Produto principal</span><strong>${escapeHtml(analysis.produtoPrincipal || "Não identificado")}</strong></div>
        <div><span>Etapa</span><strong>${escapeHtml(analysis.etapa || "Não identificada")}</strong></div>
        <div><span>Interesse</span><strong>${escapeHtml(analysis.nivelInteresse || "Não identificado")}</strong></div>
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
        <div class="analysis-block"><h3>Última solicitação do cliente</h3><p>${escapeHtml(analysis.ultimaSolicitacaoCliente || "Não identificada")}</p></div>
        <div class="analysis-block"><h3>Último compromisso do cliente</h3><p>${escapeHtml(analysis.ultimoCompromissoCliente || "Não identificado")}</p></div>
        <div class="analysis-block"><h3>Último compromisso do corretor</h3><p>${escapeHtml(analysis.ultimoCompromissoCorretor || "Não identificado")}</p></div>
        <div class="analysis-block"><h3>Participantes da decisão</h3><p>${escapeHtml(analysis.participantesDecisao || "Não identificados")}</p></div>
        <div class="analysis-block"><h3>Proposta identificada</h3><p>${escapeHtml(analysis.propostaResumo || "Nenhuma proposta anexada")}</p></div>
        <div class="analysis-block"><h3>Pendência financeira</h3><p>${escapeHtml(analysis.pendenciaFinanceira || "Não identificada")}</p></div>
        <div class="analysis-block emphasis"><h3>Pendência real</h3><p>${escapeHtml(analysis.pendenciaReal || "Não identificada")}</p></div>
        <div class="analysis-block emphasis"><h3>Quem deve agir agora</h3><p>${escapeHtml(analysis.quemDeveProximoPasso || "Não identificado")}</p></div>
        <div class="analysis-block emphasis"><h3>Próximo passo</h3><p>${escapeHtml(analysis.proximoPasso || "Não identificado")}</p></div>
      </div>
      ${analysis.alertaInformacaoIncompleta ? `<div class="analysis-alert">${escapeHtml(analysis.alertaInformacaoIncompleta)}</div>` : ""}
      <div class="suggestions-section">
        <h3>Sugestões de resposta</h3>
        ${suggestions.map((suggestion, index) => `
          <article class="suggestion-card">
            <div class="suggestion-heading">
              <strong>${escapeHtml(suggestion.titulo || `Opção ${index + 1}`)}</strong>
              <button type="button" data-copy-suggestion="${index}">Copiar</button>
            </div>
            <p>${escapeHtml(suggestion.mensagem || "")}</p>
          </article>`).join("") || `<p class="analysis-empty-value">Nenhuma sugestão foi gerada.</p>`}
      </div>
    </section>`;
}

function renderDetail(record) {
  if (state.currentKey !== record.conversationKey) state.detailPeriod = "30";
  state.currentKey = record.conversationKey;
  setDetailHeader(record);

  const updated = new Date(record.updatedAt || record.ultimaMensagemAt || Date.now());
  const updatedLabel = Number.isNaN(updated.getTime())
    ? "Atualizado recentemente"
    : `Atualizado em ${dateOnlyFormatter.format(updated)} às ${timeFormatter.format(updated)}`;

  const failedAudios = (record.timeline || []).filter(item => item.type === "audio" && item.transcriptionStatus !== "done");
  const filteredTimeline = filterTimelineByPeriod(record.timeline);
  const groups = groupTimelineByDate(filteredTimeline);
  const timelineHtml = groups.map(group => `
    <div class="timeline-day"><span>${escapeHtml(group.label)}</span></div>
    ${group.items.map(item => renderTimelineItem(item, record)).join("")}
  `).join("");
  const periodOptions = DETAIL_PERIODS.map(option => `
    <button
      class="period-option${state.detailPeriod === option.value ? " active" : ""}"
      type="button"
      data-detail-period="${option.value}"
      aria-pressed="${state.detailPeriod === option.value ? "true" : "false"}"
    >${escapeHtml(option.label)}</button>
  `).join("");

  app.innerHTML = `
    <section class="detail-page">
      <section class="status-card">
        <span class="status-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>
        </span>
        <div class="status-copy">
          <strong>Atendimento salvo</strong>
          <span>${escapeHtml(updatedLabel)}</span>
        </div>
      </section>
      ${failedAudios.length ? `
        <section class="audio-warning" role="alert">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4m0 4h.01"/><path d="M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/></svg>
          <div><strong>Informação incompleta</strong><span>${failedAudios.length} áudio${failedAudios.length === 1 ? " não foi transcrito" : "s não foram transcritos"} mesmo após novas tentativas. A conversa pode estar sem informações importantes.</span></div>
        </section>` : ""}
      <section class="message-toolbar" aria-label="Período das mensagens">
        <div class="period-filter">
          <span class="period-filter-label">Mostrar mensagens de:</span>
          <div class="period-options" role="group" aria-label="Selecionar período">
            ${periodOptions}
          </div>
          <span class="period-result">${filteredTimeline.length} mensagem${filteredTimeline.length === 1 ? "" : "s"}</span>
        </div>
        <button class="copy-messages-button" type="button" data-copy-messages${filteredTimeline.length ? "" : " disabled"}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>
          Copiar
        </button>
      </section>
      ${renderProposalSection(record)}
      ${renderAnalysisSection(record)}
      <section class="timeline">${timelineHtml || `<p class="timeline-empty">Nenhuma mensagem encontrada em ${escapeHtml(selectedPeriodLabel().toLowerCase())}.</p>`}</section>
      <div class="detail-footer">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg>
        <span>Somente mensagens escritas e transcrições de áudio são exibidas. Imagens, vídeos, PDFs e outras mídias são ignorados.</span>
      </div>
      <button class="delete-lead-button" type="button" data-delete-lead>Excluir lead</button>
    </section>`;
}

async function renderRoute() {
  const key = getRouteKey();
  if (!key) {
    renderList();
    return;
  }

  const record = state.records.find(item => item.conversationKey === key) || await getAtendimento(key);
  if (!record) {
    showToast("Este atendimento não foi encontrado.", "error");
    navigateToList();
    return;
  }
  renderDetail(record);
}

async function refreshRecords() {
  state.records = await listAtendimentos();
}

async function fetchRemoteRecords() {
  const response = await fetch(`/api/atendimentos?device_id=${encodeURIComponent(CLOUD_WORKSPACE)}`, {
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

    for (const remote of payload.records) {
      if (state.deletingKeys.has(remote.conversationKey)) continue;
      const local = await getAtendimento(remote.conversationKey);

      if (remote.metadata?.deletedAt) {
        if (local) {
          await deleteAtendimento(remote.conversationKey);
          changed = true;
        }
        continue;
      }

      const localTime = Date.parse(local?.updatedAt || 0) || 0;
      const remoteTime = Date.parse(remote.updatedAt || 0) || 0;
      if (!local || remoteTime > localTime) {
        await saveAtendimento(remote);
        changed = true;
      }
    }
  } catch {
    // Sem conexão, a cópia local continua disponível e a próxima atualização tenta de novo.
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
    if (!response.ok) return null;
    return await response.json().catch(() => ({}));
  } catch {
    // O registro continua disponível localmente; uma nova alteração poderá tentar o envio outra vez.
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

async function transcribeAudio(entry, fullName) {
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
  if (blob.size > 4 * 1024 * 1024) {
    return { text: "", status: "too_large" };
  }

  const response = await fetch(`/api/transcrever?filename=${encodeURIComponent(fullName)}`, {
    method: "POST",
    headers: {
      "Content-Type": "audio/ogg",
      "X-File-Name": encodeURIComponent(fullName)
    },
    body: blob
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

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function transcribeAudioWithRetry(entry, fullName, onRetry) {
  let lastResult = { text: "", status: "error" };
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_TRANSCRIPTION_ATTEMPTS; attempt += 1) {
    try {
      const result = await transcribeAudio(entry, fullName);
      lastResult = result;
      if (result.status === "done" && result.text) return { ...result, attempts: attempt };
      if (result.status === "missing" || result.status === "too_large") return { ...result, attempts: attempt };
    } catch (error) {
      if (error.fatal) {
        return { text: error.message, status: "error", attempts: attempt };
      }
      lastError = error;
    }

    if (attempt < MAX_TRANSCRIPTION_ATTEMPTS) {
      onRetry?.(attempt + 1);
      await wait(TRANSCRIPTION_RETRY_DELAY_MS * attempt);
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
  for (const incoming of incomingTimeline) {
    const previous = merged.get(incoming.fingerprint);
    if (previous) {
      if (incoming.type === "audio") {
        const incomingDone = incoming.transcriptionStatus === "done" && incoming.text;
        const previousDone = previous.transcriptionStatus === "done" && previous.text;
        merged.set(incoming.fingerprint, incomingDone
          ? { ...previous, ...incoming }
          : previousDone
            ? { ...incoming, text: previous.text, transcriptionStatus: "done", transcriptionAttempts: previous.transcriptionAttempts }
            : { ...previous, ...incoming });
      } else {
        merged.set(incoming.fingerprint, { ...previous, ...incoming });
      }
      continue;
    }
    merged.set(incoming.fingerprint, incoming);
    added += 1;
  }

  const timeline = [...merged.values()].sort((a, b) => {
    const aTime = Date.parse(a.timestamp || 0) || 0;
    const bTime = Date.parse(b.timestamp || 0) || 0;
    if (aTime !== bTime) return aTime - bTime;
    return (a.sourceOrder || 0) - (b.sourceOrder || 0);
  });

  return { timeline, added };
}

async function processIncomingZip(pending) {
  if (state.processing) return;
  showProcessing();

  try {
    if (!pending?.blob) {
      throw new Error("O arquivo recebido não é um ZIP válido do WhatsApp.");
    }
    const z = getZipLib();

    // Lê o ZIP sob demanda: só o índice + o texto + os áudios .opus são lidos.
    // Fotos, vídeos e PDFs ficam no arquivo mas nunca são carregados, então o
    // tamanho total do ZIP não pesa no aparelho.
    setProcessing("read", 8, "Abrindo o ZIP recebido pelo compartilhamento.");
    let entries;
    let zipReader;
    try {
      zipReader = new z.ZipReader(new z.BlobReader(pending.blob));
      entries = await zipReader.getEntries();
    } catch {
      throw new Error("O arquivo recebido não é um ZIP válido do WhatsApp.");
    }

    const txtEntries = entries.filter(entry => !entry.directory && /\.txt$/i.test(entry.filename));
    if (!txtEntries.length) throw new Error("Nenhum arquivo de conversa .txt foi encontrado no ZIP.");

    const txtEntry = txtEntries[0];
    const rawText = await txtEntry.getData(new z.TextWriter());
    const parsedTimeline = parseWhatsappTxt(rawText);
    if (!parsedTimeline.length) throw new Error("O TXT foi encontrado, mas nenhuma mensagem pôde ser lida.");

    setProcessing("audio", 25, "Localizando somente os áudios .opus da conversa.");
    const originalLeadName = inferLeadName(pending.name || txtEntry.filename);
    const conversationKey = makeConversationKey(originalLeadName);
    const existing = await getAtendimento(conversationKey);
    const existingByFingerprint = new Map((existing?.timeline || []).map(item => [item.fingerprint, item]));
    const audioMap = buildAudioMap(entries);
    const audioItems = parsedTimeline.filter(item => item.type === "audio");

    setProcessing(
      "transcribe",
      audioItems.length ? 32 : 75,
      audioItems.length
        ? `${audioItems.length} áudio${audioItems.length === 1 ? "" : "s"} encontrado${audioItems.length === 1 ? "" : "s"}. Iniciando transcrição.`
        : "Nenhum áudio .opus encontrado."
    );

    let completedAudios = 0;
    for (const item of audioItems) {
      const previous = existingByFingerprint.get(item.fingerprint);
      if (previous?.transcriptionStatus === "done" && previous.text) {
        item.text = previous.text;
        item.transcriptionStatus = "done";
        completedAudios += 1;
        continue;
      }

      const audioEntry = audioMap.get(normalizeFileName(item.audioFile));
      if (!audioEntry) {
        item.transcriptionStatus = "missing";
        item.transcriptionAttempts = 0;
        item.text = "Não foi possível localizar este áudio dentro do ZIP.";
        completedAudios += 1;
        continue;
      }

      try {
        const result = await transcribeAudioWithRetry(
          audioEntry,
          audioEntry.filename,
          nextAttempt => setProcessing(
            "transcribe",
            32 + (completedAudios / Math.max(audioItems.length, 1)) * 43,
            `O áudio ${completedAudios + 1} falhou. Tentando novamente (${nextAttempt}/${MAX_TRANSCRIPTION_ATTEMPTS}).`
          )
        );
        item.text = result.text || (
          result.status === "too_large"
            ? "Este áudio ultrapassa o limite permitido para transcrição."
            : "O áudio não retornou texto após novas tentativas."
        );
        item.transcriptionStatus = result.status;
        item.transcriptionAttempts = result.attempts;
      } catch (error) {
        if (error.fatal) throw error;
        item.text = "Não foi possível transcrever este áudio após 3 tentativas.";
        item.transcriptionStatus = "error";
        item.transcriptionAttempts = MAX_TRANSCRIPTION_ATTEMPTS;
      }

      completedAudios += 1;
      const progress = 32 + (completedAudios / Math.max(audioItems.length, 1)) * 43;
      setProcessing(
        "transcribe",
        progress,
        `Transcrevendo áudio ${completedAudios} de ${audioItems.length}.`
      );
    }

    try { await zipReader.close(); } catch { /* leitor sem recursos a liberar */ }

    setProcessing("timeline", 82, "Unindo mensagens escritas e transcrições na ordem correta.");
    const merged = mergeTimeline(existing?.timeline, parsedTimeline);
    const lastItem = merged.timeline[merged.timeline.length - 1];
    const now = new Date().toISOString();
    const deviceId = CLOUD_WORKSPACE;

    const record = {
      id: existing?.id || globalThis.crypto?.randomUUID?.() || `attendance-${Date.now()}`,
      deviceId,
      conversationKey,
      nomeLead: existing?.nomeLead || originalLeadName,
      arquivoOrigem: pending.name,
      ultimaMensagemAt: lastItem?.timestamp || now,
      ultimaMensagemResumo: lastItem?.text || "Áudio recebido",
      timeline: merged.timeline,
      metadata: {
        ...(existing?.metadata || {}),
        originalLeadName,
        txtFile: txtEntry.filename,
        totalItens: merged.timeline.length,
        totalAudios: merged.timeline.filter(item => item.type === "audio").length,
        audiosNaoTranscritos: merged.timeline.filter(item => item.type === "audio" && item.transcriptionStatus !== "done").length,
        ignoredMedia: true,
        lastReceivedAt: pending.receivedAt || now
      },
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    setProcessing("save", 94, "Salvando o atendimento neste aparelho.");
    await saveAtendimento(record);
    await pushRemoteRecord(record);
    await removePendingShare();

    setProcessing("save", 100, "Atendimento pronto.", "Conversa processada");
    await new Promise(resolve => setTimeout(resolve, 350));
    hideProcessing();
    cleanShareQuery();
    await refreshRecords();
    navigateToAttendance(conversationKey);

    const unresolvedAudios = merged.timeline.filter(item => item.type === "audio" && item.transcriptionStatus !== "done").length;
    if (unresolvedAudios) {
      showToast(
        `${unresolvedAudios} áudio${unresolvedAudios === 1 ? " não foi transcrito" : "s não foram transcritos"} após novas tentativas. O atendimento está com informação incompleta.`,
        "error",
        9000
      );
    } else if (existing) {
      showToast(merged.added ? `${merged.added} novo${merged.added === 1 ? " item adicionado" : "s itens adicionados"}.` : "Nenhuma mensagem nova foi encontrada.");
    } else {
      showToast("Atendimento criado e salvo.");
    }
  } catch (error) {
    hideProcessing();
    cleanShareQuery();
    await refreshRecords();
    renderRoute();
    showToast(error?.message || "Não foi possível processar a conversa.", "error", 7000);
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

  app?.addEventListener("click", async event => {
    const installTrigger = event.target.closest("[data-install]");
    if (installTrigger) {
      installApp();
      return;
    }

    const periodTrigger = event.target.closest("[data-detail-period]");
    if (periodTrigger) {
      const nextPeriod = periodTrigger.dataset.detailPeriod;
      if (DETAIL_PERIODS.some(option => option.value === nextPeriod)) {
        state.detailPeriod = nextPeriod;
        const record = state.records.find(item => item.conversationKey === state.currentKey)
          || await getAtendimento(state.currentKey);
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

    const deleteTrigger = event.target.closest("[data-delete-lead]");
    if (deleteTrigger) {
      await deleteCurrentLead();
      return;
    }
    const card = event.target.closest("[data-attendance]");
    if (card) navigateToAttendance(card.dataset.attendance);
  });

  app?.addEventListener("change", async event => {
    const input = event.target.closest("[data-proposal-input]");
    if (!input) return;
    const file = input.files?.[0];
    input.value = "";
    if (file) await attachProposalImage(file);
  });

  renameForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (event.submitter?.value === "save") await saveRenamedAttendance();
    renameDialog.close();
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
