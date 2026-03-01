// ── VERSION ──────────────────────────────────────────────
// This timestamp changes on every deploy → forces cache refresh.
const VERSION = 'quoterly-v20260301181819';
const CACHE   = VERSION;
const ASSETS  = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

// ── INSTALL ──────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE — delete old caches ─────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
  // Notify all open tabs that a new version is ready
  self.clients.matchAll({ type: 'window' }).then(clients =>
    clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }))
  );
});

// ── FETCH — network-first for HTML, cache-first for rest ──
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      });
    })
  );
});

// ── NOTIFICATIONS ─────────────────────────────────────────
let notifTimer = null, recurInterval = null;

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE') {
    const { delay, state } = e.data;
    if (notifTimer)    clearTimeout(notifTimer);
    if (recurInterval) clearInterval(recurInterval);
    notifTimer = setTimeout(() => {
      fireNotification(state);
      recurInterval = setInterval(() => fireNotification(state), 24 * 60 * 60 * 1000);
    }, delay);
  }
});

const QUOTES = [
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Imagination is more important than knowledge.", author: "Albert Einstein" },
  { text: "We are not troubled by things, but by our opinions of them.", author: "Epictetus" },
  { text: "The obstacle in the path becomes the path.", author: "Marcus Aurelius" },
  { text: "Be the change you wish to see in the world.", author: "Mahatma Gandhi" },
  { text: "Creativity is intelligence having fun.", author: "Albert Einstein" },
  { text: "Wealth consists not in having great possessions, but in having few wants.", author: "Epictetus" },
];

function fireNotification(state) {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  self.registration.showNotification('Quoterly ✦', {
    body: '"' + q.text + '"\n— ' + q.author,
    icon: '/icon-192.png', badge: '/icon-192.png',
    tag: 'daily-quote', renotify: true, data: { url: '/' }
  });
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(list => {
      if (list.length) return list[0].focus();
      return self.clients.openWindow('/');
    })
  );
});
