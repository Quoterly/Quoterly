const VERSION = 'quoterly-v20260303191634';
const CACHE   = VERSION;
const ASSETS  = ['/Quoterly/', '/Quoterly/index.html', '/Quoterly/manifest.json', '/Quoterly/icon-192.png', '/Quoterly/icon-512.png'];

// ── INSTALL ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE — delete old caches ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
  self.clients.matchAll({ type: 'window' }).then(clients =>
    clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }))
  );
});

// ── FETCH ──
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match('/Quoterly/index.html'))
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

// ── NOTIFICATIONS ──
// We use a persistent alarm via setTimeout chains.
// On SW restart, the page will re-send SCHEDULE message.
let notifTimer = null;

self.addEventListener('message', e => {
  if (!e.data) return;

  if (e.data.type === 'SCHEDULE') {
    const { delay, lang } = e.data;
    if (notifTimer) clearTimeout(notifTimer);

    // Schedule first notification
    notifTimer = setTimeout(() => {
      fireNotification(lang || 'cs');
      // Reschedule every 24h
      notifTimer = setInterval(() => fireNotification(lang || 'cs'), 24 * 60 * 60 * 1000);
    }, delay);
  }
});

function fireNotification(lang) {
  const isCzech = lang === 'cs';
  const title   = 'Quoterly ✨';
  const body    = isCzech
    ? 'Tvůj dnešní citát je připraven.'
    : 'Your daily quote is ready.';

  self.registration.showNotification(title, {
    body,
    icon:     '/Quoterly/icon-192.png',
    badge:    '/Quoterly/icon-192.png',
    tag:      'daily-quote',
    renotify: true,
    data:     { url: '/Quoterly/' }
  });
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus existing window if open
      for (const client of list) {
        if (client.url.includes('/Quoterly') && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow('/Quoterly/');
    })
  );
});
