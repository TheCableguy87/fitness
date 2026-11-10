// Cache-first Service Worker. Bump VERSION on every release.
const VERSION = 'v2';
const CACHE = 'fitness-' + VERSION;
const FILES = [
  './', 'index.html', 'manifest.json', 'css/styles.css',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'data/exercises.json',
  'js/app.js', 'js/store.js', 'js/storage.js', 'js/validate.js', 'js/timer.js', 'js/workoutState.js', 'js/library.js',
  'js/backup.js', 'js/draft.js', 'js/ui.js', 'js/errors.js', 'js/audio.js', 'js/wakelock.js',
  'js/views/home.js', 'js/views/day.js', 'js/views/import.js', 'js/views/workout.js', 'js/views/summary.js',
  'js/views/explain.js', 'js/views/settings.js',
];

// No skipWaiting here: the new version waits until the user taps "update" on the home screen.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fitness-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
