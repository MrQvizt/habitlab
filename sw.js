// Offline support: cache the app shell; network-first so updates arrive when online.
const CACHE = 'habit-lab-v2';
const ASSETS = [
  './', 'index.html', 'css/styles.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png',
  'js/app.js', 'js/store.js', 'js/demo.js', 'js/ui/dom.js', 'js/ui/charts.js',
  'js/engine/util.js', 'js/engine/calc.js', 'js/engine/trend.js', 'js/engine/meals.js', 'js/engine/workouts.js', 'js/engine/habits.js', 'js/engine/adjust.js', 'js/engine/safety.js', 'js/engine/game.js', 'js/ui/celebrate.js', 'js/views/rewards.js',
  'js/data/foods.js', 'js/data/recipes.js', 'js/data/exercises.js', 'js/data/habits.js', 'js/data/learn.js',
  'js/views/shared.js', 'js/views/onboarding.js', 'js/views/today.js', 'js/views/meals.js', 'js/views/shopping.js', 'js/views/move.js', 'js/views/habits.js', 'js/views/progress.js', 'js/views/checkin.js', 'js/views/learn.js', 'js/views/settings.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))),
  );
});
