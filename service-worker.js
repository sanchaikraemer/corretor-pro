const BUILD_ID = '__BUILD_ID__';
const STATIC_CACHE = 'corretor-pro-static-v663-' + BUILD_ID;
// Cache de nome ESTÁVEL para o ZIP compartilhado. Nunca é apagado em activate.
const SHARE_CACHE = 'direciona-sharetarget-stable';
const ZIP_KEYS = ['/__direciona_shared_zip__','./__direciona_shared_zip__','__direciona_shared_zip__'];
const DEBUG_KEY = '/__direciona_share_debug__';

// IndexedDB pra storage redundante do ZIP. Cache API tem comportamento erratico
// no Chrome Android (put returna sucesso mas dados nao persistem). IndexedDB e
// mais previsivel: writes sao transacionais e duraveis.
const IDB_NAME = 'direciona-share';
const IDB_VERSION = 1;
const IDB_STORE = 'zips';

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(record) {
  const db = await idbOpen();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('idb tx aborted'));
    });
  } finally { db.close(); }
}

async function idbGet(id) {
  const db = await idbOpen();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(id);
      let result = null;
      req.onsuccess = () => { result = req.result || null; };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('idb get aborted'));
    });
  } finally { db.close(); }
}

async function idbDel(id) {
  const db = await idbOpen();
  try {
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } finally { db.close(); }
}

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css?v=__VERSION__',
  '/app.js?v=__VERSION__',
  '/vendor/jszip.min.js?v=__VERSION__',
  '/share.html',
  '/manifest.json',
  '/service-worker.js',
  '/icon-192.png?v=__VERSION__',
  '/logo-cp.png?v=__VERSION__',
  '/avatar-1.png?v=__VERSION__',
  '/avatar-2.png?v=__VERSION__',
  '/avatar-3.png?v=__VERSION__',
  '/avatar-4.png?v=__VERSION__',
  '/icon-512.png?v=__VERSION__',
  '/favicon.png?v=__VERSION__',
  '/logo-direciona-light.svg?v=__VERSION__',
  '/logo-direciona-dark.svg?v=__VERSION__'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(CORE_ASSETS).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();

    // Resgata qualquer ZIP/debug que o SW anterior tenha deixado em cache
    // antes de apagarmos o cache antigo. Mantém o histórico de share intacto.
    const legacyCaches = names.filter(n =>
      n !== STATIC_CACHE &&
      n !== SHARE_CACHE &&
      (n.startsWith('direciona-sharetarget-') || n.startsWith('direciona-static-'))
    );

    if (legacyCaches.length) {
      try {
        const target = await caches.open(SHARE_CACHE);
        for (const oldName of legacyCaches) {
          try {
            const old = await caches.open(oldName);
            for (const key of ZIP_KEYS) {
              const match = await old.match(key);
              if (match) await target.put(key, match).catch(() => null);
            }
            const debug = await old.match(DEBUG_KEY);
            if (debug) await target.put(DEBUG_KEY, debug).catch(() => null);
          } catch (_) { /* ignore */ }
        }
      } catch (_) { /* ignore */ }
    }

    // Apaga só caches obsoletos. SHARE_CACHE e STATIC_CACHE atual ficam.
    await Promise.all(
      names
        .filter(n => n !== STATIC_CACHE && n !== SHARE_CACHE)
        .map(n => caches.delete(n).catch(() => false))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && (
    url.pathname.endsWith('/share.html') ||
    url.pathname.endsWith('/share-target')
  )) {
    event.respondWith(handleShare(event.request));
    return;
  }

  if (url.pathname.includes('/api/')) return;
  if (event.request.method !== 'GET') return;

  const isHtml = url.pathname === '/' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/manifest.json') ||
                 url.pathname.endsWith('/service-worker.js');

  if (isHtml) {
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(STATIC_CACHE).then(cache => cache.put(event.request, copy)).catch(() => null);
        return response;
      }).catch(() => caches.match(event.request).then(c => c || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(STATIC_CACHE).then(cache => cache.put(event.request, copy)).catch(() => null);
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

async function saveShareDebug(info) {
  try {
    const cache = await caches.open(SHARE_CACHE);
    await cache.put(DEBUG_KEY, new Response(JSON.stringify(info), {
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (_) { /* ignore */ }
}

async function handleShare(request) {
  const debug = { ts: new Date().toISOString(), buildId: BUILD_ID, step: 'start', formKeys: [], files: [], note: null };

  try {
    const formData = await request.formData();

    for (const [key, value] of formData.entries()) {
      debug.formKeys.push(key);
      if (value && typeof value === 'object' && 'name' in value) {
        debug.files.push({
          key,
          name: value.name || '(sem nome)',
          type: value.type || '(sem tipo)',
          size: typeof value.size === 'number' ? value.size : null
        });
      }
    }

    // Preferência: campo "zip" do manifest. Depois qualquer File com nome.
    let file =
      formData.get('zip') ||
      formData.get('file') ||
      formData.get('files') ||
      formData.get('arquivo');

    if (!file || !file.name) {
      for (const value of formData.values()) {
        if (value && value.name) { file = value; break; }
      }
    }

    if (!file || !file.name) {
      debug.step = 'no_file_in_form';
      await saveShareDebug(debug);
      return Response.redirect('/index.html?shared=0&source=share-target&erro=sem_arquivo', 303);
    }

    debug.chosenFile = { name: file.name, type: file.type, size: file.size };
    const maxSharedBytes = 750 * 1024 * 1024;
    if (!/\.zip$/i.test(String(file.name || '')) || file.size <= 0 || file.size > maxSharedBytes) {
      debug.step = 'invalid_file';
      debug.note = file.size > maxSharedBytes ? 'arquivo acima de 750 MB' : 'arquivo não é ZIP';
      await saveShareDebug(debug);
      return Response.redirect('/index.html?shared=0&source=share-target&erro=arquivo_invalido', 303);
    }
    debug.step = 'saving';

    // Dupla persistencia: IndexedDB (primario, mais confiavel no Android)
    // + Cache API (fallback, compat com codigo legado).
    let idbError = null;
    let cacheError = null;
    let verifiedSize = null;

    try {
      const blob = file.slice(0, file.size, file.type || 'application/zip');
      await idbPut({
        id: 'latest',
        name: file.name,
        type: file.type || 'application/zip',
        blob,
        receivedAt: new Date().toISOString()
      });
      const back = await idbGet('latest');
      verifiedSize = back?.blob?.size ?? null;
      if (!verifiedSize) idbError = 'idb roundtrip retornou blob sem tamanho';
    } catch (e) {
      idbError = e?.message || String(e);
    }

    try {
      const cache = await caches.open(SHARE_CACHE);
      const headers = {
        'Content-Type': file.type || 'application/zip',
        'X-File-Name': encodeURIComponent(file.name),
        'X-Received-At': new Date().toISOString()
      };
      await cache.put(ZIP_KEYS[0], new Response(file, { headers }));
    } catch (e) {
      cacheError = e?.message || String(e);
    }

    debug.idbError = idbError;
    debug.cacheError = cacheError;
    debug.idbVerifiedSize = verifiedSize;
    debug.step = (!idbError || !cacheError) ? 'saved' : 'save_failed';
    await saveShareDebug(debug);

    if (idbError && cacheError) {
      return Response.redirect('/index.html?shared=0&source=share-target&erro=storage_falhou', 303);
    }
    return Response.redirect('/index.html?shared=1&source=share-target', 303);
  } catch (error) {
    debug.step = 'exception';
    debug.error = error?.message || String(error);
    await saveShareDebug(debug);
    return Response.redirect('/index.html?shared=0&source=share-target&erro=excecao', 303);
  }
}
