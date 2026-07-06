const BUILD_ID = '__BUILD_ID__';
const STATIC_CACHE = 'corretor-pro-static-v724-' + BUILD_ID;
const SHARE_CACHE = 'direciona-sharetarget-stable';
const ZIP_KEYS = ['/__direciona_shared_zip__','./__direciona_shared_zip__','__direciona_shared_zip__'];
const CORE_ASSETS = [
  '/', '/index.html', '/styles.css?v=719', '/app.js?v=719', '/vendor/jszip.min.js?v=719',
  '/share.html', '/manifest.json', '/service-worker.js', '/icon-192.png?v=719', '/logo-cp.png?v=719',
  '/icon-512.png?v=719', '/favicon.png?v=719', '/logo-direciona-light.svg?v=719', '/logo-direciona-dark.svg?v=719'
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

async function handleShare(request) {
  try {
    const form = await request.formData();
    const files = form.getAll('zip');
    const file = files && files[0];
    if (file && typeof file.arrayBuffer === 'function') {
      const cache = await caches.open(SHARE_CACHE);
      const body = await file.arrayBuffer();
      const headers = new Headers({
        'Content-Type': file.type || 'application/zip',
        'X-File-Name': encodeURIComponent(file.name || 'whatsapp.zip'),
        'X-Shared-At': new Date().toISOString(),
        'Cache-Control': 'no-store'
      });
      await Promise.all(ZIP_KEYS.map(k => cache.put(k, new Response(body.slice(0), { headers }))));
    }
  } catch (_) {}
  return Response.redirect('/?shared=1', 303);
}
