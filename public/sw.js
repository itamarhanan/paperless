/*
 * Paperless service worker: reading offline.
 *
 * Books already live in the browser (IndexedDB). This keeps the app around
 * them: the pages, Next's scripts, styles and fonts, and the PDF worker, so
 * the library and the reader open with no network after one online visit.
 *
 * - Pages: network first, so a new deploy shows up at once; the last copy
 *   when offline. Pages read their book from the address (/reader?id=…), so
 *   one copy per path serves every book.
 * - /_next/static: content-hashed, so cache first.
 * - /api/*: never cached, never answered from here.
 *
 * The cache is named after the build (?v= on this script's address). A new
 * deploy registers a new script; it fills its own cache and deletes the old.
 */

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const PREFIX = "paperless-";
const CACHE = `${PREFIX}${VERSION}`;

/** Pages that work without a server, from what the browser has stored. */
const PAGES = ["/", "/reader", "/book"];
const FILES = ["/pdf.worker.min.mjs", "/manifest.webmanifest", "/apple-icon.png", "/icons/icon-192.png", "/icons/icon-512.png"];

const isStatic = (url) => url.pathname.startsWith("/_next/static/");

/** Script, style and font addresses a page's HTML refers to. */
function assetsIn(html) {
  const found = new Set();
  for (const match of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) found.add(match[1].replace(/&amp;/g, "&"));
  return [...found];
}

async function addQuietly(cache, url) {
  try {
    const response = await fetch(url, { cache: "no-cache" });
    if (response.ok) await cache.put(url, response);
  } catch {
    // One missing file shouldn't stop the rest
  }
}

async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    PAGES.map(async (path) => {
      try {
        const response = await fetch(path, { cache: "no-cache" });
        if (!response.ok || response.redirected) return;
        const html = await response.clone().text();
        await cache.put(path, response);
        await Promise.all(assetsIn(html).map((url) => addQuietly(cache, url)));
      } catch {
        // Offline during install: pages are stored as they're visited instead
      }
    })
  );
  await Promise.all(FILES.map((url) => addQuietly(cache, url)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(PREFIX) && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

/** The page can hand over what it loaded before this worker took charge. */
self.addEventListener("message", (event) => {
  const urls = event.data?.type === "cache" && Array.isArray(event.data.urls) ? event.data.urls : [];
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (const href of urls) {
        const url = new URL(href, self.location.origin);
        if (url.origin !== self.location.origin || !isStatic(url)) continue;
        if (!(await cache.match(url.href))) await addQuietly(cache, url.href);
      }
    })()
  );
});

async function page(request) {
  const url = new URL(request.url);
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected && PAGES.includes(url.pathname)) {
      await cache.put(url.pathname, response.clone());
    }
    return response;
  } catch (error) {
    const cached = (await cache.match(url.pathname)) || (await cache.match("/"));
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(page(request));
  } else if (isStatic(url)) {
    event.respondWith(cacheFirst(request));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(networkFirst(request));
  }
  // Everything else (React Server Component requests, images) goes to the
  // network as usual. Offline, Next falls back to loading the page, which
  // is answered above.
});
