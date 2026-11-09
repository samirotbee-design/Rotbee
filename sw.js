// Service Worker برای کارکرد آفلاین
const CACHE_NAME = 'rotbee-v2';
const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './styles.css',
  './app.js',
  './admin.js',
  './questions.json',
  './manifest.json',
  './manifest-admin.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg'
];

// نصب: ذخیره همه فایل‌ها در حافظه
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 ذخیره فایل‌ها در حافظه کش');
      return cache.addAll(ASSETS).catch(err => console.warn('بعضی فایل‌ها کش نشدند:', err));
    })
  );
  self.skipWaiting();
});

// فعال‌سازی: پاک کردن کش‌های قدیمی
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      );
    })
  );
  self.clients.claim();
});

// پاسخ‌گویی: اول از کش، بعد از شبکه
self.addEventListener('fetch', (event) => {
  // برای درخواست‌های گیت‌هاب (آپدیت) همیشه آنلاین چک کن
  if (event.request.url.includes('raw.githubusercontent.com')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // ذخیره پاسخ‌های جدید
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // اگر آفلاین بود و کش نبود، صفحه اصلی رو برگردون
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
