// هذا Service Worker مؤقت لتنظيف أي نسخة Offline قديمة.
// المنصة الآن Online Only ولا يتم تخزين أو تحميل بيانات الأسئلة مسبقاً.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('exam-platform-'))
        .map((key) => caches.delete(key))
    );
    await self.registration.unregister();
  })());
});

// لا يوجد fetch handler عمداً: كل طلب يذهب مباشرة إلى الشبكة.
