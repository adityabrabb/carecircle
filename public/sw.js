/**
 * Service worker.
 *
 * Purpose: keep the elder's saved plan pages readable with no internet.
 * Network first; a copy of each saved page is kept, and the offline page
 * is shown when a page is not saved. Saved pages are cleared on request
 * (sign-out) so health data does not stay on a shared phone.
 */

const CACHE_NAME = 'carecircle-pages-v1';
const OFFLINE_URL = '/offline.html';
const ICON_URL = '/icon.svg';
const SAVED_PATHS = ['/home', '/medicines/chart'];
const PURGE_MESSAGE = 'purge';
const OK_STATUS = 200;
const KEPT_URLS = [OFFLINE_URL, ICON_URL];

// ----- Install: keep the offline page and icon, then take over.

self.addEventListener('install', (event) => {
   event.waitUntil(precache());
});

/**
 * Purpose: store the offline page and icon. Side effect: writes cache.
 */
async function precache() {
   try {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(KEPT_URLS);
   } catch {
      console.warn('Offline precache failed', error);
   }
   await self.skipWaiting();
}

// ----- Activate: drop caches from older versions, then take control.

self.addEventListener('activate', (event) => {
   event.waitUntil(activateWorker());
});

/**
 * Purpose: delete old caches and claim open pages. Side effect: deletes
 * caches.
 */
async function activateWorker() {
   try {
      const names = await caches.keys();
      const stale = names.filter((name) => name !== CACHE_NAME);
      await Promise.all(stale.map((name) => caches.delete(name)));
   } catch (error) {
      console.warn('Old cache cleanup failed', error);
   }
   await self.clients.claim();
}

// ----- Fetch: only same-origin page navigations (GET) are handled.

self.addEventListener('fetch', (event) => {
   const { request } = event;
   if (request.mode !== 'navigate' || request.method !== 'GET') {
      return;
   }
   const url = new URL(request.url);
   if (url.origin !== self.location.origin) {
      return;
   }
   event.respondWith(networkFirst(request, event));
});

/**
 * Purpose: answer a page request from the network, falling back to the
 * saved copy or the offline page when the network fails. Side effect:
 * stores a copy of saved pages.
 */
async function networkFirst(request, event) {
   const path = new URL(request.url).pathname;
   try {
      const response = await fetch(request);
      const saveable =
         response.status === OK_STATUS &&
         !response.redirected &&
         SAVED_PATHS.includes(path);
      if (saveable) {
         event.waitUntil(savePage(path, response.clone()));
      }
      return response;
   } catch {
      return offlineResponse(path);
   }
}

/**
 * Purpose: store a copy of a saved page under its bare path. Side effect:
 * writes cache.
 */
async function savePage(path, response) {
   try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(path, response);
   } catch (error) {
      console.warn('Saving page failed', error);
   }
}

/**
 * Purpose: pick the saved copy of a page, else the offline page. Side
 * effect: reads cache.
 */
async function offlineResponse(path) {
   try {
      const cache = await caches.open(CACHE_NAME);
      const saved = await cache.match(path);
      if (saved) {
         return saved;
      }
      const offline = await cache.match(OFFLINE_URL);
      if (offline) {
         return offline;
      }
   } catch (error) {
      console.warn('Offline lookup failed', error);
   }
   return Response.error();
}

// ----- Message: 'purge' clears saved pages (sign-out on a shared phone).

self.addEventListener('message', (event) => {
   if (event.data !== PURGE_MESSAGE) {
      return;
   }
   event.waitUntil(purgeSaved());
});

/**
 * Purpose: delete every cached entry except the offline page and icon.
 * Side effect: deletes cache entries.
 */
async function purgeSaved() {
   try {
      const cache = await caches.open(CACHE_NAME);
      const requests = await cache.keys();
      await Promise.all(
         requests
            .filter((request) => {
               const path = new URL(request.url).pathname;
               return !KEPT_URLS.includes(path);
            })
            .map((request) => cache.delete(request)),
      );
   } catch (error) {
      console.warn('Purge failed', error);
   }
}
