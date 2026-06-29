// Offline cache for the Japan Trip Companion PWA.
// Strategy: NETWORK-FIRST for the page itself, so an edited/re-uploaded
// version always wins when online; the cache is only the offline fallback.
// Other assets are cache-first. Bump CACHE to force a refresh.
const CACHE = "japan-trip-v8";
const PAGE = "./index.html";
const ASSETS = ["./", PAGE, "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const accept = req.headers.get("accept") || "";
  const isDoc = req.mode === "navigate" || req.destination === "document" || accept.includes("text/html");

  if (isDoc) {
    // Network-first: fresh content wins online, cache covers offline.
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match(PAGE)))
    );
    return;
  }

  // Everything else: cache-first.
  e.respondWith(
    caches.match(req).then(hit =>
      hit || fetch(req).then(res => {
        try {
          if (res.ok && new URL(req.url).origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
        } catch (_) {}
        return res;
      }).catch(() => caches.match(PAGE))
    )
  );
});
