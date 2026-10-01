const V = 'boki-v1';
const ASSETS = ['./', './index.html', './css/app.css', './manifest.json', './data/seed.json', './icon-192.png', './icon-512.png',
  './js/app.js', './js/ui.js', './js/db.js', './js/srs.js', './js/scoring.js', './js/seed.js', './js/session.js',
  './js/views/dashboard.js', './js/views/review.js', './js/views/quiz.js', './js/views/dailylog.js', './js/views/settings.js',
  './js/views/cards.js', './js/views/questions.js', './js/views/journalForm.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(V).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
