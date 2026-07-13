const BUILD_ID = '__BUILD_ID__';
const STATIC_CACHE = 'corretor-pro-static-v__VERSION__-' + BUILD_ID;
const SHARE_CACHE = 'direciona-sharetarget-stable';
const ZIP_KEYS = ['/__direciona_shared_zip__','./__direciona_shared_zip__','__direciona_shared_zip__'];
const CORE_ASSETS = [
  '/', '/index.html', '/styles.css?v=__VERSION__', '/app.js?v=__VERSION__', '/vendor/jszip.min.js?v=__VERSION__',
  '/share.html', '/manifest.json', '/service-worker.js', '/icon-192.png?v=__VERSION__', '/logo-cp.png?v=__VERSION__',
  '/icon-512.png?v=__VERSION__', '/favicon.png?v=__VERSION__'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.allSettled(CORE_ASSETS.map(url => cache.add(url)));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === STATIC_CACHE || k === SHARE_CACHE) ? null : caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.method === 'POST' && (url.pathname === '/share-target' || url.pathname === '/share.html')) {
    event.respondWith(handleShare(event.request));
    return;
  }

  if (url.pathname.includes('/api/')) return;
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(event.request, '/index.html'));
    return;
  }

  event.respondWith(networkFirst(event.request, null));
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) cache.put(request, response.clone()).catch(() => null);
    return response;
  } catch (_) {
    const cached = await cache.match(request) || (fallbackUrl ? await cache.match(fallbackUrl) : null) || await caches.match(request) || (fallbackUrl ? await caches.match(fallbackUrl) : null);
    if (cached) return cached;
    if (fallbackUrl) return new Response('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Corretor Pro</title><style>html,body{margin:0;height:100%;background:#001E2B;color:#F4F7FB;font-family:system-ui,-apple-system,Segoe UI,sans-serif}.boot{min-height:100%;display:grid;place-items:center;text-align:center}.logo{font-weight:900;font-size:22px}.sub{margin-top:8px;color:#8fb1bf}.btn{margin-top:16px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:#ff6257;color:white;padding:10px 16px;font-weight:900}</style></head><body><div class="boot"><div><div class="logo">Corretor <span style="color:#ff6257">Pro</span></div><div class="sub">Sem conexão para atualizar.</div><button class="btn" onclick="location.reload()">Tentar novamente</button></div></div></body></html>', {status:200, headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
    return new Response('', { status: 504, statusText: 'offline' });
  }
}

const SHARE_IDB_NAME = 'direciona-share';
const SHARE_IDB_VERSION = 1;
const SHARE_IDB_STORE = 'zips';

function openShareDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in self)) { reject(new Error('indexedDB indisponível')); return; }
    const req = indexedDB.open(SHARE_IDB_NAME, SHARE_IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SHARE_IDB_STORE)) {
        db.createObjectStore(SHARE_IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('falha ao abrir IndexedDB'));
  });
}

async function saveSharedZipInIdb(file, body, shareId) {
  let db;
  try {
    db = await openShareDb();
    const blob = new Blob([body.slice(0)], { type: file.type || 'application/zip' });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SHARE_IDB_STORE, 'readwrite');
      tx.objectStore(SHARE_IDB_STORE).put({
        id: shareId,
        status: 'pending',
        attempts: 0,
        name: file.name || 'whatsapp.zip',
        type: file.type || 'application/zip',
        size: file.size || blob.size || body.byteLength || 0,
        ts: new Date().toISOString(),
        blob
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('falha ao gravar IndexedDB'));
      tx.onabort = () => reject(tx.error || new Error('gravação IndexedDB abortada'));
    });
    return true;
  } finally {
    try { if (db) db.close(); } catch (_) {}
  }
}

async function saveShareDebug(debug) {
  try {
    const cache = await caches.open(SHARE_CACHE);
    await cache.put('/__direciona_share_debug__', new Response(JSON.stringify(debug), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    }));
  } catch (_) {}
}

function pickSharedZip(form) {
  const candidates = [];
  for (const [key, value] of form.entries()) {
    if (value && typeof value.arrayBuffer === 'function') {
      candidates.push({ key, file: value });
    }
  }
  candidates.sort((a, b) => {
    const az = String(a.file.name || '').toLowerCase().endsWith('.zip') ? 1 : 0;
    const bz = String(b.file.name || '').toLowerCase().endsWith('.zip') ? 1 : 0;
    if (az !== bz) return bz - az;
    return Number(b.file.size || 0) - Number(a.file.size || 0);
  });
  return candidates[0] || null;
}

function createShareId() {
  try {
    if (self.crypto && typeof self.crypto.randomUUID === 'function') return `share-${self.crypto.randomUUID()}`;
  } catch (_) {}
  return `share-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

async function handleShare(request) {
  const shareId = createShareId();
  const debug = {
    ts: new Date().toISOString(),
    shareId,
    buildId: BUILD_ID,
    step: 'started',
    formKeys: [],
    files: [],
    chosenFile: null,
    cacheSaved: false,
    idbSaved: false,
    putError: '',
    error: ''
  };

  const redirect = (extra = '') => Response.redirect(
    `/?source=share-target&shared=1&shareId=${encodeURIComponent(shareId)}${extra}`,
    303
  );

  try {
    const form = await request.formData();
    debug.formKeys = Array.from(form.keys());
    for (const [key, value] of form.entries()) {
      if (value && typeof value.arrayBuffer === 'function') {
        debug.files.push({ key, name: value.name || '', type: value.type || '', size: value.size || 0 });
      }
    }

    const picked = pickSharedZip(form);
    const file = picked && picked.file;
    if (!file || typeof file.arrayBuffer !== 'function') {
      debug.step = 'no-file';
      await saveShareDebug(debug);
      return redirect('&erro=sem-arquivo');
    }

    debug.chosenFile = { key: picked.key, name: file.name || 'whatsapp.zip', type: file.type || '', size: file.size || 0 };
    const body = await file.arrayBuffer();

    // O arquivo recebe um ID único e permanece como pendente até o APP confirmar
    // que todo o processamento terminou. Nunca apagamos no cold start.
    try {
      debug.idbSaved = await saveSharedZipInIdb(file, body, shareId);
    } catch (e) {
      debug.putError = 'IndexedDB: ' + (e && e.message ? e.message : String(e));
    }

    // Fallback no Cache Storage, também separado por shareId. As chaves legadas são
    // mantidas por compatibilidade, mas o app usa primeiro a chave exclusiva.
    try {
      const cache = await caches.open(SHARE_CACHE);
      const headers = new Headers({
        'Content-Type': file.type || 'application/zip',
        'X-File-Name': encodeURIComponent(file.name || 'whatsapp.zip'),
        'X-Shared-At': new Date().toISOString(),
        'X-Share-Id': shareId,
        'Cache-Control': 'no-store'
      });
      const uniqueKey = `/__direciona_shared_zip__/${encodeURIComponent(shareId)}`;
      await cache.put(new Request(new URL(uniqueKey, self.location.origin).href, { method: 'GET' }), new Response(body.slice(0), { headers }));
      for (const k of ZIP_KEYS) {
        const requestUrl = new URL(k, self.location.origin).href;
        await cache.put(new Request(requestUrl, { method: 'GET' }), new Response(body.slice(0), { headers }));
      }
      debug.cacheSaved = true;
    } catch (e) {
      debug.putError = (debug.putError ? debug.putError + ' | ' : '') + 'Cache: ' + (e && e.message ? e.message : String(e));
    }

    debug.step = (debug.idbSaved || debug.cacheSaved) ? 'saved-pending' : 'not-saved';
    await saveShareDebug(debug);
    if (!debug.idbSaved && !debug.cacheSaved) return redirect('&erro=nao-salvo');
  } catch (e) {
    debug.step = 'exception';
    debug.error = e && e.message ? e.message : String(e);
    await saveShareDebug(debug);
    return redirect('&erro=excecao');
  }

  return redirect();
}
