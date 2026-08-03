const CACHE_VERSION = "fittrack-v15";
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

  // App shell: network-first. Deployed updates must show up on the very next
  // load while online — falling back to the cache only when there's truly no
  // connection (e.g. mid-workout with no signal) is what "offline support"
  // actually needs to mean here; preferring a stale cached copy while online
  // just means updates silently don't appear until a second reload.
  // cache: "no-store" is deliberate — GitHub Pages serves these with a
  // Cache-Control that lets the browser's own HTTP cache silently answer a
  // plain fetch() from its cache, which would quietly bring back the exact
  // "shows an old version" bug this network-first strategy exists to fix.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((res) => {
          if (res.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request))
    );
  }
});
