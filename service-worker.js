const BUILD_ID = "corretor-pro-v013-express";
const STATIC_CACHE = `corretor-pro-static-${BUILD_ID}`;
const SHARE_DB_NAME = "corretor-pro-share";
const SHARE_DB_VERSION = 1;
const SHARE_STORE = "incoming";
const SHARE_RECORD_ID = "latest";

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/db.js",
  "/whatsapp.js",
  "/manifest.webmanifest",
  "/share-target.html",
  "/jszip.min.js",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/logo-mark.png"
];

function openShareDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARE_DB_NAME, SHARE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SHARE_STORE)) {
        db.createObjectStore(SHARE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Falha ao abrir armazenamento de compartilhamento."));
  });
}

async function saveIncomingFile(file) {
  const db = await openShareDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(SHARE_STORE, "readwrite");
      transaction.objectStore(SHARE_STORE).put({
        id: SHARE_RECORD_ID,
        name: file.name || "conversa-whatsapp.zip",
        type: file.type || "application/zip",
        size: file.size,
        blob: file.slice(0, file.size, file.type || "application/zip"),
        receivedAt: new Date().toISOString()
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Falha ao salvar arquivo recebido."));
      transaction.onabort = () => reject(transaction.error || new Error("Salvamento cancelado."));
    });
  } finally {
    db.close();
  }
}

async function handleShareTarget(request) {
  const home = new URL("/", request.url);

  try {
    const formData = await request.formData();
    let file = formData.get("conversation");

    if (!(file instanceof File)) {
      for (const value of formData.values()) {
        if (value instanceof File) {
          file = value;
          break;
        }
      }
    }

    const validName = file instanceof File && /\.zip$/i.test(file.name || "");
    const validSize = file instanceof File && file.size > 0 && file.size <= 500 * 1024 * 1024;

    if (!validName || !validSize) {
      home.searchParams.set("share_error", "arquivo_invalido");
      return Response.redirect(home.href, 303);
    }

    await saveIncomingFile(file);
    home.searchParams.set("recebido", "1");
    return Response.redirect(home.href, 303);
  } catch (error) {
    home.searchParams.set("share_error", "falha_ao_receber");
    return Response.redirect(home.href, 303);
  }
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(name => name.startsWith("corretor-pro-static-") && name !== STATIC_CACHE)
        .map(name => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method === "POST" && url.origin === self.location.origin && url.pathname === "/share-target") {
    event.respondWith(handleShareTarget(request));
    return;
  }

  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, copy)).catch(() => null);
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, copy)).catch(() => null);
        }
        return response;
      });
    })
  );
});
