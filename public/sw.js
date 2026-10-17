/**
 * Storage Drive Enterprise - Service Worker
 * Comprehensive caching strategy for offline metadata, app shell,
 * recently viewed files, and background sync triggers.
 */

const CACHE_VERSION = 'v1.1.0';
const STATIC_CACHE = `storage-drive-static-${CACHE_VERSION}`;
const METADATA_CACHE = `storage-drive-metadata-${CACHE_VERSION}`;
const FILES_CACHE = `storage-drive-files-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install Event - Pre-cache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Precache partial error (ignored for dynamic Vite dev):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (
            key.startsWith('storage-drive-') &&
            key !== STATIC_CACHE &&
            key !== METADATA_CACHE &&
            key !== FILES_CACHE
          ) {
            console.log('[SW] Deleting deprecated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Dynamic caching strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip chrome-extension, non-http, or foreign schemes
  if (!url.protocol.startsWith('http')) return;

  // Handle special offline file preview endpoint
  if (url.pathname.startsWith('/offline-preview/')) {
    event.respondWith(
      caches.open(FILES_CACHE).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request).catch(() => {
            return new Response(JSON.stringify({ error: 'File not available offline' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        });
      })
    );
    return;
  }

  // Handle navigation requests (SPA HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          // Offline fallback to cached index.html
          const cache = await caches.open(STATIC_CACHE);
          const cached = await cache.match('/index.html') || await cache.match('/');
          if (cached) return cached;
          return new Response('<h1>Storage Drive Offline</h1><p>You are currently offline. Please reconnect to access online services.</p>', {
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // Handle static assets (CSS, JS, Fonts, Images)
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.includes('/assets/')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Stale-while-revalidate
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, networkResponse));
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => {
            // If offline and not in cache, graceful degradation
            return new Response('', { status: 408 });
          });
      })
    );
    return;
  }

  // Default network with cache fallback
  event.respondWith(
    fetch(event.request).catch(async () => {
      const match = await caches.match(event.request);
      if (match) return match;
      throw new Error('Network error and no cache match');
    })
  );
});

// Sync Event for Background Sync API (when browser comes back online)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-storage-drive-uploads') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'BACKGROUND_SYNC_TRIGGERED',
            tag: event.tag,
            timestamp: Date.now()
          });
        });
      })
    );
  }
});

// Message Event - Communication between React App and Service Worker
self.addEventListener('message', async (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_FILE_DATA': {
      try {
        const { fileId, mimeType, buffer, name } = data.payload;
        const cache = await caches.open(FILES_CACHE);
        const headers = new Headers({
          'Content-Type': mimeType || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${encodeURIComponent(name || 'file')}"`,
          'X-Offline-Cached-At': new Date().toISOString()
        });
        const response = new Response(buffer, { headers });
        await cache.put(`/offline-preview/${fileId}`, response);
        event.ports[0]?.postMessage({ success: true, fileId });
      } catch (err) {
        event.ports[0]?.postMessage({ success: false, error: String(err) });
      }
      break;
    }

    case 'REMOVE_CACHED_FILE': {
      try {
        const { fileId } = data.payload;
        const cache = await caches.open(FILES_CACHE);
        await cache.delete(`/offline-preview/${fileId}`);
        event.ports[0]?.postMessage({ success: true, fileId });
      } catch (err) {
        event.ports[0]?.postMessage({ success: false, error: String(err) });
      }
      break;
    }

    case 'GET_CACHED_FILE_KEYS': {
      try {
        const cache = await caches.open(FILES_CACHE);
        const requests = await cache.keys();
        const keys = requests.map(r => r.url);
        event.ports[0]?.postMessage({ success: true, keys });
      } catch (err) {
        event.ports[0]?.postMessage({ success: false, error: String(err) });
      }
      break;
    }

    case 'CACHE_METADATA_SNAPSHOT': {
      try {
        const { snapshot } = data.payload;
        const cache = await caches.open(METADATA_CACHE);
        const response = new Response(JSON.stringify(snapshot), {
          headers: { 'Content-Type': 'application/json' }
        });
        await cache.put('/api/metadata-snapshot', response);
        event.ports[0]?.postMessage({ success: true });
      } catch (err) {
        event.ports[0]?.postMessage({ success: false, error: String(err) });
      }
      break;
    }

    case 'GET_METADATA_SNAPSHOT': {
      try {
        const cache = await caches.open(METADATA_CACHE);
        const response = await cache.match('/api/metadata-snapshot');
        if (response) {
          const snapshot = await response.json();
          event.ports[0]?.postMessage({ success: true, snapshot });
        } else {
          event.ports[0]?.postMessage({ success: true, snapshot: null });
        }
      } catch (err) {
        event.ports[0]?.postMessage({ success: false, error: String(err) });
      }
      break;
    }

    case 'CLEAR_DYNAMIC_CACHES': {
      try {
        await caches.delete(FILES_CACHE);
        await caches.delete(METADATA_CACHE);
        event.ports[0]?.postMessage({ success: true });
      } catch (err) {
        event.ports[0]?.postMessage({ success: false, error: String(err) });
      }
      break;
    }

    case 'CHECK_SW_STATUS': {
      event.ports[0]?.postMessage({
        success: true,
        version: CACHE_VERSION,
        caches: [STATIC_CACHE, METADATA_CACHE, FILES_CACHE]
      });
      break;
    }
  }
});
