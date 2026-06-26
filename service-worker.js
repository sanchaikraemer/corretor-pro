const BUILD_ID = "corretor-pro-v028";
const STATIC_CACHE = `corretor-pro-static-${BUILD_ID}`;
const SHARE_DB_NAME = "corretor-pro-share";
const SHARE_DB_VERSION = 1;
const SHARE_STORE = "incoming";
const SHARE_RECORD_ID = "latest";

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/styles.css?v=028",
  "/app.js?v=028",
  "/db.js?v=028",
  "/whatsapp.js?v=028",
  "/manifest.webmanifest",
  "/share-target.html",
  "/zip.min.js",
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

function ensureZipName(name) {
  const base = String(name || "").trim() || "conversa-whatsapp";
  return /\.zip$/i.test(base) ? base : `${base}.zip`;
}

async function saveIncomingFile(file) {
  // Guarda o próprio arquivo (File é um Blob). O IndexedDB persiste os bytes
  // reais sem carregar tudo na memória — seguro mesmo para ZIPs grandes, e
  // resolve o caso do Android reportar tamanho 0 antes da leitura.
  const type = file.type || "application/zip";
  const db = await openShareDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(SHARE_STORE, "readwrite");
      transaction.objectStore(SHARE_STORE).put({
        id: SHARE_RECORD_ID,
        name: ensureZipName(file.name),
        type,
        size: file.size,
        blob: file,
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

  // 1) Lê o multipart do compartilhamento.
  let file;
  try {
    const formData = await request.formData();
    file = formData.get("conversation");
    if (!(file instanceof File)) {
      for (const value of formData.values()) {
        if (value instanceof File) {
          file = value;
          break;
        }
      }
    }
  } catch (error) {
    home.searchParams.set("share_error", "leitura");
    return Response.redirect(home.href, 303);
  }

  // 2) Confere que veio um arquivo (sem exigir extensão .zip nem tamanho > 0:
  //    o app valida o conteúdo depois, e o tamanho pode vir 0 no Android).
  if (!(file instanceof File)) {
    home.searchParams.set("share_error", "sem_arquivo");
    return Response.redirect(home.href, 303);
  }
  if (file.size > 2 * 1024 * 1024 * 1024) {
    home.searchParams.set("share_error", "muito_grande");
    return Response.redirect(home.href, 303);
  }

  // 3) Salva o arquivo recebido para o app processar.
  try {
    await saveIncomingFile(file);
  } catch (error) {
    home.searchParams.set("share_error", "armazenamento");
    return Response.redirect(home.href, 303);
  }

  home.searchParams.set("recebido", "1");
  return Response.redirect(home.href, 303);
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

  const networkFirstPaths = new Set([
    "/index.html",
    "/styles.css",
    "/app.js",
    "/db.js",
    "/whatsapp.js"
  ]);

  if (networkFirstPaths.has(url.pathname)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response.ok) {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, copy)).catch(() => null);
        }
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match(url.pathname)) || Response.error();
      }
    })());
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
