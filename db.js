const APP_DB_NAME = "corretor-pro-data";
const APP_DB_VERSION = 1;
const ATTENDANCE_STORE = "atendimentos";

export const SHARE_DB_NAME = "corretor-pro-share";
export const SHARE_DB_VERSION = 1;
export const SHARE_STORE = "incoming";
export const SHARE_RECORD_ID = "latest";

function openDatabase(name, version, onUpgrade) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => onUpgrade(request.result, request.transaction);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error(`Falha ao abrir ${name}.`));
    request.onblocked = () => reject(new Error(`O banco ${name} está bloqueado por outra aba.`));
  });
}

function runTransaction(db, storeName, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let value;

    try {
      value = operation(store);
    } catch (error) {
      transaction.abort();
      reject(error);
      return;
    }

    transaction.oncomplete = () => resolve(value);
    transaction.onerror = () => reject(transaction.error || new Error("Falha na operação local."));
    transaction.onabort = () => reject(transaction.error || new Error("Operação local cancelada."));
  });
}

async function openAppDatabase() {
  return openDatabase(APP_DB_NAME, APP_DB_VERSION, db => {
    if (!db.objectStoreNames.contains(ATTENDANCE_STORE)) {
      const store = db.createObjectStore(ATTENDANCE_STORE, { keyPath: "conversationKey" });
      store.createIndex("updatedAt", "updatedAt", { unique: false });
    }
  });
}

async function openShareDatabase() {
  return openDatabase(SHARE_DB_NAME, SHARE_DB_VERSION, db => {
    if (!db.objectStoreNames.contains(SHARE_STORE)) {
      db.createObjectStore(SHARE_STORE, { keyPath: "id" });
    }
  });
}

export function getDeviceId() {
  const key = "corretor-pro-device-id";
  let value = localStorage.getItem(key);
  if (value) return value;

  value = globalThis.crypto?.randomUUID?.()
    || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(key, value);
  return value;
}

const SYNC_CODE_KEY = "corretor-pro-sync-code";

// Normaliza o código de sincronia para que celular e PC cheguem ao mesmo
// valor mesmo digitando com maiúsculas, acentos ou espaços diferentes.
export function normalizeSyncCode(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getSyncCode() {
  return (localStorage.getItem(SYNC_CODE_KEY) || "").trim();
}

export function setSyncCode(value) {
  const clean = normalizeSyncCode(value);
  if (clean) localStorage.setItem(SYNC_CODE_KEY, clean);
  else localStorage.removeItem(SYNC_CODE_KEY);
  return clean;
}

// Chave usada na nuvem: o código de sincronia (compartilhado entre aparelhos)
// quando definido, ou a identidade local do aparelho como reserva.
export function getRemoteKey() {
  return getSyncCode() || getDeviceId();
}

export async function listAtendimentos() {
  const db = await openAppDatabase();
  try {
    const records = await new Promise((resolve, reject) => {
      const transaction = db.transaction(ATTENDANCE_STORE, "readonly");
      const request = transaction.objectStore(ATTENDANCE_STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("Falha ao listar atendimentos."));
    });

    return records.sort((a, b) => {
      const aTime = Date.parse(a.ultimaMensagemAt || a.updatedAt || 0) || 0;
      const bTime = Date.parse(b.ultimaMensagemAt || b.updatedAt || 0) || 0;
      return bTime - aTime;
    });
  } finally {
    db.close();
  }
}

export async function getAtendimento(conversationKey) {
  const db = await openAppDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(ATTENDANCE_STORE, "readonly");
      const request = transaction.objectStore(ATTENDANCE_STORE).get(conversationKey);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Falha ao abrir atendimento."));
    });
  } finally {
    db.close();
  }
}

export async function saveAtendimento(record) {
  if (!record?.conversationKey) throw new Error("Atendimento sem identificação.");
  const db = await openAppDatabase();
  try {
    await runTransaction(db, ATTENDANCE_STORE, "readwrite", store => {
      store.put(record);
    });
    return record;
  } finally {
    db.close();
  }
}

export async function getPendingShare() {
  const db = await openShareDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(SHARE_STORE, "readonly");
      const request = transaction.objectStore(SHARE_STORE).get(SHARE_RECORD_ID);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Falha ao ler o arquivo recebido."));
    });
  } finally {
    db.close();
  }
}

export async function removePendingShare() {
  const db = await openShareDatabase();
  try {
    await runTransaction(db, SHARE_STORE, "readwrite", store => {
      store.delete(SHARE_RECORD_ID);
    });
  } finally {
    db.close();
  }
}
