/* Mizan Service Worker
 * Caches public application assets and legal-library content only.
 * Exam questions, judicial-institute questions, petitions, procedures,
 * account data and administration data are always fetched from the network.
 */
'use strict';

const MIZAN_BUILD_ID = '__MIZAN_BUILD_ID__';
const MIZAN_STATIC_CACHE = `mizan-static-${MIZAN_BUILD_ID}`;
const MIZAN_SHELL_CACHE = `mizan-shell-${MIZAN_BUILD_ID}`;
const MIZAN_BOOK_CATALOG_CACHE = 'mizan-book-catalog-v1';
const MIZAN_LAW_LIBRARY_CACHE = 'mizan-law-library-v1';

const MIZAN_KEEP_CACHES = new Set([
  MIZAN_STATIC_CACHE,
  MIZAN_SHELL_CACHE,
  MIZAN_BOOK_CATALOG_CACHE,
  MIZAN_LAW_LIBRARY_CACHE
]);

const MIZAN_SCOPE_URL = new URL(self.registration.scope);
const MIZAN_SCOPE_PATH = MIZAN_SCOPE_URL.pathname;

function getAppRelativePath(requestUrl) {
  const url = new URL(requestUrl);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(MIZAN_SCOPE_PATH)) {
    return null;
  }
  return url.pathname.slice(MIZAN_SCOPE_PATH.length).replace(/^\/+/, '');
}

async function notifyClientsAboutUpdate() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({ type: 'MIZAN_UPDATE_AVAILABLE' });
  }
}

async function responseChanged(previousResponse, nextResponse) {
  const oldTag = previousResponse.headers.get('etag');
  const newTag = nextResponse.headers.get('etag');
  if (oldTag && newTag) return oldTag !== newTag;

  const oldModified = previousResponse.headers.get('last-modified');
  const newModified = nextResponse.headers.get('last-modified');
  if (oldModified && newModified && oldModified !== newModified) return true;

  try {
    const [oldBody, newBody] = await Promise.all([
      previousResponse.clone().text(),
      nextResponse.clone().text()
    ]);
    return oldBody !== newBody;
  } catch (_) {
    return false;
  }
}

async function networkFirstWithCache(request, cacheName, announceUpdates) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  try {
    const networkResponse = await fetch(request, { cache: 'no-store' });

    if (networkResponse.ok) {
      const changed = Boolean(
        cachedResponse &&
        announceUpdates &&
        await responseChanged(cachedResponse, networkResponse)
      );

      await cache.put(request, networkResponse.clone());

      if (changed) await notifyClientsAboutUpdate();
    } else if (networkResponse.status === 404 && cachedResponse) {
      await cache.delete(request);
    }

    return networkResponse;
  } catch (error) {
    if (cachedResponse) return cachedResponse;
    throw error;
  }
}

function staleWhileRevalidate(request, event) {
  const cachePromise = caches.open(MIZAN_STATIC_CACHE);
  const cachedPromise = cachePromise.then(cache => cache.match(request, { ignoreSearch: true }));

  const refreshPromise = Promise.all([cachePromise, cachedPromise]).then(async ([cache, cachedResponse]) => {
    const networkResponse = await fetch(request, { cache: 'no-cache' });

    if (networkResponse.ok) {
      const url = new URL(request.url);
      const isExecutableAsset = /\.(?:css|js|mjs)$/i.test(url.pathname);
      const changed = Boolean(
        cachedResponse &&
        isExecutableAsset &&
        await responseChanged(cachedResponse, networkResponse)
      );

      await cache.put(request, networkResponse.clone());

      if (changed) await notifyClientsAboutUpdate();
    } else if (networkResponse.status === 404 && cachedResponse) {
      await cache.delete(request);
      await notifyClientsAboutUpdate();
    }

    return networkResponse;
  });

  // Extend the fetch event synchronously while the cached response is returned.
  event.waitUntil(refreshPromise.then(() => undefined).catch(() => {}));
  return cachedPromise.then(cachedResponse => cachedResponse || refreshPromise);
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(MIZAN_SHELL_CACHE);

  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const exactMatch = await cache.match(request);
    if (exactMatch) return exactMatch;

    const indexUrl = new URL('index.html', self.registration.scope);
    const indexFallback = await cache.match(indexUrl.href);
    if (indexFallback) return indexFallback;

    return new Response(
      '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ميزان</title><body><main><h1>لا يوجد اتصال بالإنترنت</h1><p>يمكنك إعادة المحاولة عند عودة الاتصال. المحتوى الذي لم يُخزّن سابقاً يحتاج إلى الإنترنت.</p></main></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(MIZAN_SHELL_CACHE);
    const indexUrl = new URL('index.html', self.registration.scope).href;

    // Always preserve the latest application entry point for offline launch.
    try {
      const response = await fetch(indexUrl, { cache: 'no-store' });
      if (response.ok) {
        await cache.put(indexUrl, response.clone());
        await cache.put(new URL('./', self.registration.scope).href, response.clone());
      }
    } catch (_) {
      // A previously installed application can still activate while offline.
    }

    // Pre-cache the complete same-origin visual/runtime shell at installation.
    // The generated manifest contains only static assets, never questions,
    // account data, petitions, procedure records or legal book content.
    try {
      const manifestUrl = new URL('precache-manifest.json', self.registration.scope).href;
      const manifestResponse = await fetch(manifestUrl, { cache: 'no-store' });
      if (manifestResponse.ok) {
        const paths = await manifestResponse.json();
        if (Array.isArray(paths)) {
          await Promise.allSettled(paths.filter(path =>
            typeof path === 'string' &&
            !path.startsWith('/') &&
            !/^https?:/i.test(path) &&
            !path.includes('..')
          ).map(async path => {
            const assetUrl = new URL(path, self.registration.scope).href;
            const assetResponse = await fetch(assetUrl, { cache: 'no-store' });
            if (assetResponse.ok) await cache.put(assetUrl, assetResponse);
          }));
        }
      }
    } catch (_) {
      // Individual assets remain network-loadable; do not block SW installation.
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    // Remove only obsolete application-shell/static caches. Never delete the
    // dedicated legal-book or book-catalogue caches, including older versions.
    await Promise.all(cacheNames
      .filter(name => (name.startsWith('mizan-static-') || name.startsWith('mizan-shell-')) && !MIZAN_KEEP_CACHES.has(name))
      .map(name => caches.delete(name)));

    // Legal books and the book catalogue use dedicated caches and are retained
    // across application updates.
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'MIZAN_SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const relativePath = getAppRelativePath(request.url);
  if (relativePath === null) return;

  // Account, admin, API, and rewritten article routes are never cached.
  if (
    relativePath === 'admin.html' ||
    relativePath.startsWith('api/') ||
    relativePath.startsWith('pulpit/')
  ) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  // Cache only the public book catalogue and chapter metadata. Actual question
  // files are deliberately excluded and always require a live network response.
  if (
    relativePath === 'data/books.json' ||
    relativePath === 'data/question-metadata.json'
  ) {
    event.respondWith(networkFirstWithCache(request, MIZAN_BOOK_CATALOG_CACHE, true));
    return;
  }

  // Legal texts are cached only after they are requested successfully.
  // Online requests always revalidate; offline use falls back to the saved copy.
  if (relativePath.startsWith('data/laws/') && /\.json$/i.test(relativePath)) {
    event.respondWith(networkFirstWithCache(request, MIZAN_LAW_LIBRARY_CACHE, true));
    return;
  }

  // Question chapters and other online-only datasets are revalidated against
  // the origin. A 304 can reuse the browser HTTP cache, but there is no
  // Service Worker CacheStorage fallback, so offline access remains blocked.
  if (relativePath.startsWith('data/')) {
    const isQuestionChapter = /^data\/[^/]+\/chapter_\d+\.json$/i.test(relativePath);
    event.respondWith(fetch(request, { cache: isQuestionChapter ? 'no-cache' : 'no-store' }));
    return;
  }

  // Only the public application entry page may fall back to an offline shell.
  if (request.mode === 'navigate') {
    if (relativePath === '' || relativePath === 'index.html') {
      event.respondWith(networkFirstNavigation(request));
    } else {
      event.respondWith(fetch(request, { cache: 'no-store' }));
    }
    return;
  }

  const isStaticLocation =
    relativePath.startsWith('assets/') ||
    relativePath.startsWith('icons/') ||
    relativePath.startsWith('engine/') ||
    relativePath === 'manifest.json';

  const isStaticFile = /\.(?:css|js|mjs|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|otf)$/i.test(relativePath) ||
    relativePath === 'manifest.json';

  if (isStaticLocation && isStaticFile) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});
