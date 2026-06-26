import {
  getAtendimento,
  getPendingShare,
  getRemoteKey,
  getSyncCode,
  listAtendimentos,
  normalizeSyncCode,
  removePendingShare,
  saveAtendimento,
  setSyncCode
} from "./db.js";
import {
  inferLeadName,
  initials,
  makeConversationKey,
  normalizeFileName,
  parseWhatsappTxt
} from "./whatsapp.js";

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
const syncDialog = document.querySelector("#sync-dialog");
const syncForm = document.querySelector("#sync-form");
const syncInput = document.querySelector("#sync-input");

const PROCESSING_STEPS = ["read", "audio", "transcribe", "timeline", "save"];
const state = {
  records: [],
  currentKey: null,
  installPrompt: null,
  processing: false,
  toastTimer: null
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

  const syncCode = getSyncCode();
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
        <button class="storage-note" type="button" data-sync-open>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
          <span>${syncCode
            ? `Sincronizando entre aparelhos com o código <strong>${escapeHtml(syncCode)}</strong>. Toque para alterar.`
            : `Atendimentos salvos só neste aparelho. <strong>Toque para sincronizar</strong> com o computador.`}</span>
        </button>
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
      <section class="timeline">${timelineHtml || "<p>Nenhuma mensagem disponível.</p>"}</section>
      <div class="detail-footer">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg>
        <span>Somente mensagens escritas e transcrições de áudio são exibidas. Imagens, vídeos, PDFs e outras mídias são ignorados.</span>
      </div>
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

async function pullRemoteRecords() {
  const remoteKey = getRemoteKey();
  try {
    const response = await fetch(`/api/atendimentos?device_id=${encodeURIComponent(remoteKey)}`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return;
    const payload = await response.json();
    if (!Array.isArray(payload.records)) return;

    for (const remote of payload.records) {
      const local = await getAtendimento(remote.conversationKey);
      const localTime = Date.parse(local?.updatedAt || 0) || 0;
      const remoteTime = Date.parse(remote.updatedAt || 0) || 0;
      if (!local || remoteTime > localTime) await saveAtendimento(remote);
    }
  } catch {
    // O armazenamento local mantém o app funcional sem conexão ou Supabase.
  }
}

async function pushRemoteRecord(record) {
  try {
    const response = await fetch("/api/atendimentos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ...record, deviceId: getRemoteKey() })
    });
    return await response.json().catch(() => ({}));
  } catch {
    // O registro já foi salvo localmente. A cópia remota é complementar nesta fase.
    return null;
  }
}

async function isCloudConfigured() {
  try {
    const response = await fetch("/api/health", { headers: { Accept: "application/json" } });
    const data = await response.json();
    return Boolean(data?.supabaseConfigured);
  } catch {
    return false;
  }
}

async function applySyncCode(rawCode) {
  const candidate = normalizeSyncCode(rawCode);
  if (candidate && candidate.length < 8) {
    showToast("O código precisa ter ao menos 8 caracteres. Ex.: corretor-sanchai.", "error", 7000);
    return;
  }

  const clean = setSyncCode(rawCode);

  if (!clean) {
    await refreshRecords();
    renderRoute();
    showToast("Sincronização desligada. Os atendimentos ficam apenas neste aparelho.");
    return;
  }

  if (!(await isCloudConfigured())) {
    renderRoute();
    showToast(
      "Código salvo, mas o banco na nuvem (Supabase) ainda não está configurado na Vercel. A sincronia começa assim que você configurar.",
      "error",
      9000
    );
    return;
  }

  showToast("Sincronizando atendimentos com a nuvem…");
  for (const record of state.records) {
    await pushRemoteRecord(record);
  }
  await pullRemoteRecords();
  await refreshRecords();
  renderRoute();
  showToast(`Sincronização ativada com o código "${clean}". Use o mesmo código no outro aparelho.`, "success", 8000);
}

function openSyncDialog() {
  syncInput.value = getSyncCode();
  syncDialog.showModal();
  requestAnimationFrame(() => syncInput.select());
}

function buildAudioMap(zip) {
  const map = new Map();
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !/\.opus$/i.test(entry.name)) continue;
    map.set(normalizeFileName(entry.name), entry.name);
  }
  return map;
}

async function transcribeAudio(zip, fullName) {
  const entry = zip.files[fullName];
  if (!entry) {
    return { text: "", status: "missing" };
  }

  const blob = await entry.async("blob");
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

function mergeTimeline(existingTimeline, incomingTimeline) {
  const merged = new Map();
  for (const item of existingTimeline || []) merged.set(item.fingerprint, item);

  let added = 0;
  for (const incoming of incomingTimeline) {
    const previous = merged.get(incoming.fingerprint);
    if (previous) {
      merged.set(incoming.fingerprint, {
        ...incoming,
        text: incoming.type === "audio" && previous.text ? previous.text : incoming.text,
        transcriptionStatus: incoming.type === "audio"
          ? previous.transcriptionStatus || incoming.transcriptionStatus
          : undefined
      });
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
    if (!globalThis.JSZip) throw new Error("O leitor de ZIP não foi carregado.");

    // Não exigimos a extensão .zip no nome (o Android nem sempre a preserva).
    // O JSZip valida o conteúdo: se não for um ZIP legível, o erro aparece aqui.
    setProcessing("read", 8, "Abrindo o ZIP recebido pelo compartilhamento.");
    let zip;
    try {
      zip = await globalThis.JSZip.loadAsync(pending.blob);
    } catch {
      throw new Error("O arquivo recebido não é um ZIP válido do WhatsApp.");
    }
    const txtEntries = Object.values(zip.files).filter(entry => !entry.dir && /\.txt$/i.test(entry.name));
    if (!txtEntries.length) throw new Error("Nenhum arquivo de conversa .txt foi encontrado no ZIP.");

    const txtEntry = txtEntries[0];
    const rawText = await txtEntry.async("string");
    const parsedTimeline = parseWhatsappTxt(rawText);
    if (!parsedTimeline.length) throw new Error("O TXT foi encontrado, mas nenhuma mensagem pôde ser lida.");

    setProcessing("audio", 25, "Localizando somente os áudios .opus da conversa.");
    const originalLeadName = inferLeadName(pending.name || txtEntry.name);
    const conversationKey = makeConversationKey(originalLeadName);
    const existing = await getAtendimento(conversationKey);
    const existingByFingerprint = new Map((existing?.timeline || []).map(item => [item.fingerprint, item]));
    const audioMap = buildAudioMap(zip);
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

      const fullName = audioMap.get(normalizeFileName(item.audioFile));
      if (!fullName) {
        item.transcriptionStatus = "missing";
        item.text = "Não foi possível localizar este áudio dentro do ZIP.";
        completedAudios += 1;
        continue;
      }

      try {
        const result = await transcribeAudio(zip, fullName);
        item.text = result.text || (
          result.status === "too_large"
            ? "Este áudio ultrapassa o limite desta primeira versão."
            : "O áudio não retornou texto."
        );
        item.transcriptionStatus = result.status;
      } catch (error) {
        if (error.fatal) throw error;
        item.text = "Não foi possível transcrever este áudio.";
        item.transcriptionStatus = "error";
      }

      completedAudios += 1;
      const progress = 32 + (completedAudios / Math.max(audioItems.length, 1)) * 43;
      setProcessing(
        "transcribe",
        progress,
        `Transcrevendo áudio ${completedAudios} de ${audioItems.length}.`
      );
    }

    setProcessing("timeline", 82, "Unindo mensagens escritas e transcrições na ordem correta.");
    const merged = mergeTimeline(existing?.timeline, parsedTimeline);
    const lastItem = merged.timeline[merged.timeline.length - 1];
    const now = new Date().toISOString();
    const deviceId = getRemoteKey();

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
        txtFile: txtEntry.name,
        totalItens: merged.timeline.length,
        totalAudios: merged.timeline.filter(item => item.type === "audio").length,
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

    if (existing) {
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

  backButton.addEventListener("click", navigateToList);
  brandButton.addEventListener("click", navigateToList);
  installButton.addEventListener("click", installApp);
  editNameButton.addEventListener("click", openRenameDialog);

  app.addEventListener("click", event => {
    const installTrigger = event.target.closest("[data-install]");
    if (installTrigger) {
      installApp();
      return;
    }
    const syncTrigger = event.target.closest("[data-sync-open]");
    if (syncTrigger) {
      openSyncDialog();
      return;
    }
    const card = event.target.closest("[data-attendance]");
    if (card) navigateToAttendance(card.dataset.attendance);
  });

  renameForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (event.submitter?.value === "save") await saveRenamedAttendance();
    renameDialog.close();
  });

  syncForm.addEventListener("submit", async event => {
    event.preventDefault();
    const code = syncInput.value;
    const save = event.submitter?.value === "save";
    syncDialog.close();
    if (save) await applySyncCode(code);
  });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
  } catch {
    showToast("Não foi possível ativar a instalação do aplicativo.", "error");
  }
}

async function init() {
  bindEvents();
  await registerServiceWorker();
  await pullRemoteRecords();
  await refreshRecords();
  await renderRoute();

  const params = new URLSearchParams(location.search);
  if (params.get("share_error")) {
    cleanShareQuery();
    showToast("O arquivo compartilhado não pôde ser recebido. Envie um ZIP exportado do WhatsApp.", "error", 6500);
  }

  const pending = await getPendingShare().catch(() => null);
  if (pending) await processIncomingZip(pending);
}

init().catch(error => {
  hideProcessing();
  showToast(error?.message || "Falha ao iniciar o Corretor Pro.", "error", 7000);
});
