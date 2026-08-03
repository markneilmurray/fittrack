const CACHE_VERSION = "fittrack-v9";
const IMAGE_CACHE = "fittrack-images-v1";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./js/app.js",
  "./js/router.js",
  "./js/store.js",
  "./js/db.js",
  "./js/utils.js",
  "./js/firebaseConfig.js",
  "./js/firebase.js",
  "./js/sync.js",
  "./js/insights.js",
  "./js/aiError.js",
  "./js/components/charts.js",
  "./js/components/icons.js",
  "./js/components/modal.js",
  "./js/components/nav.js",
  "./js/components/toast.js",
  "./js/data/exercises.js",
  "./js/data/templates.js",
  "./js/pages/activeSession.js",
  "./js/pages/calendar.js",
  "./js/pages/dashboard.js",
  "./js/pages/exerciseDetail.js",
  "./js/pages/food.js",
  "./js/pages/library.js",
  "./js/pages/more.js",
  "./js/pages/profiles.js",
  "./js/pages/sessionBuild.js",
  "./js/pages/train.js",
  "./js/pages/weight.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION && k !== IMAGE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Exercise reference images: cache-first, runtime cache so once viewed they work offline.
  if (url.hostname === "raw.githubusercontent.com") {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // App shell: cache-first, falling back to network, updating cache in the background.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, res.clone()));
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
