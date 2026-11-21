const CACHE_NAME = 'flight-log-shell-v1';
const APP_SHELL = './';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Salva la pagina principale durante la prima visita online.
    const response = await fetch(APP_SHELL, { cache: 'reload' });
    if (!response.ok) throw new Error('Impossibile scaricare Flight Log per la cache offline');
    await cache.put(APP_SHELL, response);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('flight-log-') && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Per la pagina dell'app: prova prima la rete, poi usa la copia salvata.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(APP_SHELL, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await caches.match(APP_SHELL);
        if (cached) return cached;
        return new Response('Flight Log non è ancora disponibile offline. Apri l’app una prima volta con Internet.', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  // Memorizza anche le eventuali risorse locali richieste dall'app.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok && new URL(request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return cached || Response.error();
    }
  })());
});
