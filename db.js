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
      const aTime = Math.max(
        Date.parse(a?.metadata?.ultimaMovimentacaoAt || 0) || 0,
        Date.parse(a?.metadata?.atendidoAgoraAt || 0) || 0,
        Date.parse(a.ultimaMensagemAt || 0) || 0,
        Date.parse(a.createdAt || 0) || 0
      );
      const bTime = Math.max(
        Date.parse(b?.metadata?.ultimaMovimentacaoAt || 0) || 0,
        Date.parse(b?.metadata?.atendidoAgoraAt || 0) || 0,
        Date.parse(b.ultimaMensagemAt || 0) || 0,
        Date.parse(b.createdAt || 0) || 0
      );
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


export async function deleteAtendimento(conversationKey) {
  if (!conversationKey) return;
  const db = await openAppDatabase();
  try {
    await runTransaction(db, ATTENDANCE_STORE, "readwrite", store => {
      store.delete(conversationKey);
    });
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
