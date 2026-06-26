import {
  deleteAtendimento,
  getAtendimento,
  getPendingShare,
  listAtendimentos,
  removePendingShare,
  saveAtendimento
} from "./db.js?v=021";
import {
  inferLeadName,
  initials,
  makeConversationKey,
  normalizeFileName,
  parseWhatsappTxt
} from "./whatsapp.js?v=021";

const app = document.querySelector("#app");
const backButton = document.querySelector("#back-button");
const brandButton = document.querySelector("#brand-button");
const installButton = document.querySelector("#install-button");
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

const APP_VERSION = "v021";
const CLOUD_WORKSPACE = "corretor-pro-site";
const AUTO_SYNC_INTERVAL_MS = 15000;
const MAX_TRANSCRIPTION_ATTEMPTS = 3;
const TRANSCRIPTION_RETRY_DELAY_MS = 1200;
const PROCESSING_STEPS = ["read", "audio", "transcribe", "timeline", "save"];
const state = {
  records: [],
  currentKey: null,
  installPrompt: null,
  processing: false,
  toastTimer: null,
  syncing: false,
  syncTimer: null,
  cloudAvailable: null
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
        <p class="build-tag">Corretor Pro ${APP_VERSION}</p>
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

function renderDetail(record) {
  state.currentKey = record.conversationKey;
  setDetailHeader(record);

  const updated = new Date(record.updatedAt || record.ultimaMensagemAt || Date.now());
  const updatedLabel = Number.isNaN(updated.getTime())
    ? "Atualizado recentemente"
    : `Atualizado em ${dateOnlyFormatter.format(updated)} às ${timeFormatter.format(updated)}`;

  const failedAudios = (record.timeline || []).filter(item => item.type === "audio" && item.transcriptionStatus !== "done");
  const groups = groupTimelineByDate(record.timeline);
  const timelineHtml = groups.map(group => `
    <div class="timeline-day"><span>${escapeHtml(group.label)}</span></div>
    ${group.items.map(item => renderTimelineItem(item, record)).join("")}
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
      <section class="timeline">${timelineHtml || "<p>Nenhuma mensagem disponível.</p>"}</section>
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
    // O registro fica local e será reenviado quando o site abrir novamente.
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

async function syncLocalRecordsToCloud() {
  const localRecords = await listAtendimentos();
  for (const record of localRecords) {
    const migrated = record.deviceId === CLOUD_WORKSPACE
      ? record
      : {
          ...record,
          id: globalThis.crypto?.randomUUID?.() || `attendance-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          deviceId: CLOUD_WORKSPACE
        };
    if (migrated !== record) await saveAtendimento(migrated);
    await pushRemoteRecord(migrated);
  }
  return pullRemoteRecords();
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
  const record = await getAtendimento(state.currentKey);
  if (!record) return;

  const confirmed = window.confirm(`Excluir o lead "${record.nomeLead}"? Esta ação removerá o atendimento deste site em todos os aparelhos.`);
  if (!confirmed) return;

  const remoteDeleted = await deleteRemoteRecord(record);
  if (!remoteDeleted) {
    showToast("Não foi possível excluir o lead agora. Verifique a conexão e tente novamente.", "error", 7000);
    return;
  }

  await deleteAtendimento(record.conversationKey);
  await refreshRecords();
  navigateToList();
  showToast("Lead excluído.");
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
    const deleteTrigger = event.target.closest("[data-delete-lead]");
    if (deleteTrigger) {
      await deleteCurrentLead();
      return;
    }
    const card = event.target.closest("[data-attendance]");
    if (card) navigateToAttendance(card.dataset.attendance);
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
  bindEvents();
  await registerServiceWorker();
  await syncLocalRecordsToCloud();
  await refreshRecords();
  await renderRoute();
  startAutomaticSync();

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
