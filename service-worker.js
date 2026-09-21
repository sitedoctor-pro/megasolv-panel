const CACHE = 'megasolv-admin-v2';
const SHELL = [
  './','./index.html','./login.html','./orders.html','./reviews.html','./offline.html','./manifest.webmanifest',
  './assets/css/dashboard.css','./assets/js/supabase-client.js','./assets/js/auth.js','./assets/js/dashboard.js','./assets/js/pwa.js',
  './assets/img/megasolv-logo-header.webp','./assets/favicons/favicon.ico','./assets/favicons/favicon-32.png',
  './assets/pwa/icon-192.png','./assets/pwa/icon-512.png','./assets/pwa/maskable-192.png','./assets/pwa/maskable-512.png',
  './assets/icons/menu.svg','./assets/icons/dashboard.svg','./assets/icons/orders.svg','./assets/icons/reviews.svg','./assets/icons/install.svg',
  './assets/icons/trash.svg','./assets/icons/export.svg','./assets/icons/more.svg','./assets/icons/close.svg','./assets/icons/bell.svg',
  './assets/icons/external-link.svg','./assets/icons/search.svg','./assets/icons/users.svg','./assets/icons/cart.svg','./assets/icons/revenue.svg',
  './assets/icons/check.svg','./assets/icons/x.svg','./assets/icons/filter.svg','./assets/icons/chart.svg','./assets/icons/eye.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('megasolv-admin-') && k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

function isSupabase(url){
  return /\.supabase\.co$/i.test(url.hostname) || /\.supabase\.com$/i.test(url.hostname);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache live/auth/API traffic.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (isSupabase(url) || url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/') || url.pathname.includes('/realtime/v1/')) return;

  if (req.mode === 'navigate') {
    event.respondWith((async()=>{
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone()).catch(()=>{});
        return fresh;
      } catch {
        return (await caches.match(req)) || (await caches.match('./offline.html'));
      }
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith((async()=>{
      const cached = await caches.match(req);
      const network = fetch(req).then(async res=>{
        if (res && res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone()).catch(()=>{});
        }
        return res;
      }).catch(()=>cached);
      return cached || network;
    })());
  }
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
