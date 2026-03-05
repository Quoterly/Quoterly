const VERSION = 'quoterly-v20260304093213';
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

// ── ACTIVATE ──
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
        .then(res => { caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res; })
        .catch(() => caches.match('/Quoterly/index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque')
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      });
    })
  );
});

// ── NOTIFICATIONS ──
// Strategy: store target time in SW scope, check every time SW wakes via fetch/message.
// Also use a setTimeout chain — but re-arm it when page sends SCHEDULE.
// This is the most reliable approach for PWA without background sync.

let scheduledHour = null;
let scheduledMin  = null;
let scheduledLang = 'cs';
let notifTimer    = null;

function msUntilNext(h, m) {
  const now  = new Date();
  const fire = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  if (fire <= now) fire.setDate(fire.getDate() + 1);
  return fire - now;
}

function armTimer() {
  if (scheduledHour === null) return;
  if (notifTimer) clearTimeout(notifTimer);
  const delay = msUntilNext(scheduledHour, scheduledMin);
  notifTimer = setTimeout(() => {
    fireNotification(scheduledLang);
    // Re-arm for next day
    notifTimer = setTimeout(function repeat() {
      fireNotification(scheduledLang);
      notifTimer = setTimeout(repeat, 24 * 60 * 60 * 1000);
    }, 24 * 60 * 60 * 1000);
  }, delay);
}

self.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.type === 'SCHEDULE') {
    scheduledHour = e.data.hour;
    scheduledMin  = e.data.min;
    scheduledLang = e.data.lang || 'cs';
    armTimer();
  }
});

function fireNotification(lang) {
  const isCzech = lang === 'cs';
  self.registration.showNotification('Quoterly ✨', {
    body:     isCzech ? 'Tvůj dnešní citát je připraven.' : 'Your daily quote is ready.',
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
      for (const client of list) {
        if (client.url.includes('/Quoterly') && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow('/Quoterly/');
    })
  );
});
