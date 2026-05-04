// Service Worker — FastPOS offline shell cache (network-first)
// Estratégia: network-first para shell e API; fallback para cache quando offline.
// Vantagem: usuário sempre recebe versão atualizada quando online; cache só é usado
// como rede de segurança offline. Bump do CACHE_NAME força purga em mudanças de schema.

const CACHE_NAME = 'fastpos-shell-v12';

// Assets do shell para pré-cachear no install (best-effort).
const SHELL_ASSETS = [
  '/pages/caixa.html',
  '/pages/mesas.html',
  '/js/api.js',
  '/js/utils.js',
  '/js/components.js',
  '/js/offline.js',
  '/js/tcp-print.js',
  '/css/app.css',
  '/login-app.html',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(SHELL_ASSETS.map(url => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // ── API: network-only com fallback de erro estruturado ───────────────────
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(req).catch(() =>
        new Response(
          JSON.stringify({ detail: 'Sem conexão com o servidor', _offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // ── Shell: network-first; cacheia sucessos; fallback ao cache offline ───
  e.respondWith(
    fetch(req).then(response => {
      if (response && response.ok) {
        const clone = response.clone();
        const sameOrigin = url.origin === self.location.origin;
        const isCdn = url.hostname.includes('jsdelivr.net');
        if (sameOrigin || isCdn) {
          caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
        }
      }
      return response;
    }).catch(() =>
      caches.match(req).then(cached => {
        if (cached) return cached;
        // Fallback final para navegação HTML offline
        if (req.headers.get('accept')?.includes('text/html')) {
          return caches.match('/pages/caixa.html');
        }
        return new Response('', { status: 504 });
      })
    )
  );
});
