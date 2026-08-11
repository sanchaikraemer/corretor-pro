const BUILD_ID = '__BUILD_ID__';
const STATIC_CACHE = 'corretor-pro-static-v__VERSION__-' + BUILD_ID;
const SHARE_CACHE = 'direciona-sharetarget-stable';
const CORE_ASSETS = [
  // v1186 — o jszip saiu do pacote que é baixado na instalação: ele só entra em cena na
  // importação de ZIP e na planilha de exportação, e as duas precisam de internet de qualquer
  // jeito (upload, IA). Guardar 96 KB por versão em todo aparelho, pra um uso que nunca acontece
  // offline, era desperdício. Continua sendo guardado pelo staleWhileRevalidate no primeiro uso.
  //
  // v1195 — js/importacao.js segue a MESMA regra e por isso também não está nesta lista: ele é o
  // pedaço do app que processa a conversa importada, e importar exige internet (upload + IA). Cair
  // no staleWhileRevalidate significa que ele é buscado na primeira importação e fica guardado
  // dali em diante. Colocá-lo aqui desfaria justamente a economia da divisão.
  '/', '/index.html', '/styles.css?v=__VERSION__', '/app.js?v=__VERSION__',
  '/js/state.js?v=__VERSION__', '/js/dom.js?v=__VERSION__', '/js/proposta.js?v=__VERSION__', '/js/pwa-install.js?v=__VERSION__',
  // v1107 — faltavam no pacote offline: tema.js e commercial-schema.js são imports estáticos do
  // app.js (sem eles o módulo inteiro não executa), supabase.js e contas-config.js são <script>
  // do index.html. Sem os 4, o app instalado abria offline mas travava em "Carregando os leads...".
  '/js/tema.js?v=__VERSION__', '/js/commercial-schema.js?v=__VERSION__', '/js/dados-locais.js?v=__VERSION__',
  '/vendor/supabase.js?v=__VERSION__', '/contas-config.js?v=__VERSION__',
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

  // v1209 — a comparação ignora barra final ("/share-target/" é o mesmo endereço que
  // "/share-target"). Uma diferença boba dessas fazia a conversa compartilhada escapar daqui e ir
  // parar no servidor, que devolvia a tela de erro em inglês no lugar do app.
  const caminho = url.pathname.replace(/\/+$/, '') || '/';
  if (event.request.method === 'POST' && (caminho === '/share-target' || caminho === '/share.html')) {
    event.respondWith(handleShare(event.request));
    return;
  }

  if (url.pathname.includes('/api/')) return;
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    // O HTML NÃO é versionado na URL — precisa vir fresco pra apontar pros assets ?v=NNN novos.
    event.respondWith(networkFirst(event.request, '/index.html'));
    return;
  }

  // v942 — assets estáticos (app.js, styles.css, js/*, vendor) são SERVIDOS DO CACHE NA HORA e
  // revalidados por trás. Antes era network-first: todo carregamento esperava a rede ir e voltar
  // pelo proxy, mesmo com tudo já salvo no aparelho — era a causa do "clico e demora pra carregar"
  // reportado pelo dono. Como cada asset tem ?v=__VERSION__ na URL, uma versão nova = URL nova =
  // cache miss = busca fresca automática. Ou seja: instantâneo E sem nunca servir versão velha.
  event.respondWith(staleWhileRevalidate(event.request));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response && response.ok) cache.put(request, response.clone()).catch(() => null);
    return response;
  }).catch(() => null);
  // Cache primeiro (instantâneo). Sem cache ainda (1º acesso), espera a rede.
  return cached || (await fetchPromise) || new Response('', { status: 504, statusText: 'offline' });
}

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) cache.put(request, response.clone()).catch(() => null);
    return response;
  } catch (_) {
    const cached = await cache.match(request) || (fallbackUrl ? await cache.match(fallbackUrl) : null) || await caches.match(request) || (fallbackUrl ? await caches.match(fallbackUrl) : null);
    if (cached) return cached;
    if (fallbackUrl) return new Response('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Corretor Pro</title><style>html,body{margin:0;height:100%;background:#052B36;color:#F4F7FB;font-family:system-ui,-apple-system,Segoe UI,sans-serif}.boot{min-height:100%;display:grid;place-items:center;text-align:center}.logo{font-weight:900;font-size:22px}.sub{margin-top:8px;color:#8fb1bf}.btn{margin-top:16px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:#FF6258;color:white;padding:10px 16px;font-weight:900}</style></head><body><div class="boot"><div><div class="logo">Corretor <span style="color:#FF6258">Pro</span></div><div class="sub">Sem conexão para atualizar.</div><button class="btn" onclick="location.reload()">Tentar novamente</button></div></div></body></html>', {status:200, headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
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

    // v1192 — ARQUIVO VAZIO NÃO É COMPARTILHAMENTO VÁLIDO.
    // Caso real do dono (09/08/2026): o WhatsApp entregou um ZIP de 0 byte. O worker gravava esse
    // vazio como pendente, redirecionava como se tivesse dado certo, e o app ficava 15 segundos
    // procurando um conteúdo que não existe pra então mostrar "o arquivo não apareceu" — com um
    // botão "Tentar recuperar" que nunca teria como funcionar. Agora para aqui, com motivo próprio,
    // e nada é gravado: sem registro pendente vazio sobrando no aparelho.
    if (!body || body.byteLength === 0) {
      debug.step = 'arquivo-vazio';
      await saveShareDebug(debug);
      return redirect('&erro=arquivo-vazio');
    }

    // O arquivo recebe um ID único e permanece como pendente até o APP confirmar
    // que todo o processamento terminou. Nunca apagamos no cold start.
    try {
      debug.idbSaved = await saveSharedZipInIdb(file, body, shareId);
    } catch (e) {
      debug.putError = 'IndexedDB: ' + (e && e.message ? e.message : String(e));
    }

    // Cache Storage é somente fallback. Quando o IndexedDB funcionou, não criamos
    // uma segunda cópia integral do mesmo ZIP no aparelho.
    if (!debug.idbSaved) {
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
        await cache.put(new Request(new URL(uniqueKey, self.location.origin).href, { method: 'GET' }), new Response(body, { headers }));
        debug.cacheSaved = true;
      } catch (e) {
        debug.putError = (debug.putError ? debug.putError + ' | ' : '') + 'Cache: ' + (e && e.message ? e.message : String(e));
      }
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

// ============ v1138 — LEMBRETE DIÁRIO ============
// A pesquisa de mercado da auditoria (05/08/2026): a maioria das vendas sai depois do 5º contato,
// e quase metade dos corretores para no 1º. O app avisa dentro dele (sino); isto aqui é o aviso
// de fora: uma notificação por dia, com o app FECHADO.
//
// Sem servidor nenhum: o app (quando aberto) grava um retrato compacto no IndexedDB (ver
// cpAtualizarRetratoAcoes em app.js) e o navegador acorda este worker periodicamente (Periodic
// Background Sync; Android com o app instalado). O worker NÃO tem sessão nem token: ele só lê
// esse retrato local. Nenhum dado sai do aparelho.
//
// v1190 — DUAS MUDANÇAS AQUI:
// 1) O texto não afirma mais que "há clientes esperando sua resposta". O app lê o retrato que o
//    corretor exporta do WhatsApp, não a conversa ao vivo — ele não tem como saber se alguém está
//    sem resposta (regra do dono, v1158/v1189). O retrato agora traz ações com data registrada
//    (compromisso atrasado + a dose de "Fazer agora" do dia) e o texto fala só disso.
// 2) NENHUM NOME DE CLIENTE aparece na notificação. Antes iam até três, direto na tela bloqueada
//    do celular — qualquer um que pegasse o telefone lia nome de cliente sem desbloquear.
const NOTIF_DB = 'corretor-pro-notif';
function swNotifDB() {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open(NOTIF_DB, 1);
    rq.onupgradeneeded = () => { rq.result.createObjectStore('kv'); };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
function swNotifLer(chave) {
  return swNotifDB().then(db => new Promise(resolve => {
    const tx = db.transaction('kv', 'readonly');
    const rq = tx.objectStore('kv').get(chave);
    rq.onsuccess = () => { resolve(rq.result); db.close(); };
    rq.onerror = () => { resolve(null); db.close(); };
  })).catch(() => null);
}
function swNotifGravar(chave, valor) {
  return swNotifDB().then(db => new Promise(resolve => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(valor, chave);
    tx.oncomplete = () => { resolve(); db.close(); };
    tx.onerror = () => { resolve(); db.close(); };
  })).catch(() => {});
}

self.addEventListener('periodicsync', event => {
  if (event.tag !== 'cp-cobranca-diaria') return;
  event.waitUntil((async () => {
    const retrato = await swNotifLer('retrato');
    if (!retrato || !Number(retrato.total)) return;
    // Anti-incômodo: no máximo um aviso a cada 20h (o navegador pode acordar mais vezes).
    const ultimo = Number(await swNotifLer('ultimoAviso') || 0);
    if (Date.now() - ultimo < 20 * 60 * 60 * 1000) return;
    // Honestidade com retrato velho: o app fechado não recalcula. Até 48h, o número vale; depois
    // disso o texto vira genérico (sem número, que pode ter mudado); com mais de 30 dias, para de
    // avisar — insistir com dado de um mês só faria o corretor silenciar o app de vez.
    const idade = Date.now() - Number(retrato.calculadoEm || 0);
    if (idade > 30 * 24 * 60 * 60 * 1000) return;
    const total = Number(retrato.total);
    const corpo = idade > 48 * 60 * 60 * 1000
      ? 'Há ações comerciais para revisar no Corretor Pro. Abra o app para atualizar.'
      : (total === 1
        ? 'Você tem 1 ação comercial para revisar hoje no Corretor Pro.'
        : `Você tem ${total} ações comerciais para revisar hoje no Corretor Pro.`);
    await self.registration.showNotification('Corretor Pro', {
      body: corpo,
      tag: 'cp-cobranca-diaria',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: '/' }
    });
    await swNotifGravar('ultimoAviso', Date.now());
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(janelas => {
    for (const j of janelas) { if ('focus' in j) return j.focus(); }
    return self.clients.openWindow('/');
  }));
});
