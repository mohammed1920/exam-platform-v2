// service-worker.js
// استراتيجية التخزين المؤقت لمنصة الاختبارات القانونية
//
// ⚠️ مهم: كل مرة تعمل تحديث جوهري على ملفات ثابتة (app.js, style.css, examEngine.js)
// غيّر رقم CACHE_VERSION بالأسفل حتى يعرف المتصفح إنه يحتاج ينزّل نسخة جديدة.
// بيانات الأسئلة (data/*.json) ما تحتاج تغيير هذا الرقم، لأنها تُحدَّث تلقائيًا
// بكل مرة (استراتيجية Network First تشرح بالأسفل).

const CACHE_VERSION = 'v1';
const CACHE_NAME = `exam-platform-${CACHE_VERSION}`;

// الملفات الأساسية التي يحتاجها الموقع ليعمل حتى بدون إنترنت
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './engine/examEngine.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ---------- التثبيت: تخزين الملفات الأساسية أول مرة ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ---------- التفعيل: حذف أي نسخ كاش قديمة من إصدارات سابقة ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ---------- الطلبات: نوعين من الاستراتيجية ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // تجاهل أي طلب ليس GET (مثل طلبات لوحة الأدمن POST/PUT/DELETE)
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // لا نتدخل بطلبات خارجية (خطوط Google، أيقونات Font Awesome، GitHub API...)
  if (url.origin !== self.location.origin) return;

  // 1) ملفات بيانات الأسئلة: Network First
  //    نحاول الشبكة أولاً (نجيب آخر تحديث فعلي رفعته على GitHub)
  //    لو ما فيه إنترنت، نرجع للنسخة المخزنة سابقاً (تجاهل query string ?v=...)
  if (url.pathname.includes('/data/')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 2) باقي الملفات الثابتة (HTML/CSS/JS): Cache First + تحديث بالخلفية
  //    عرض سريع من الكاش فوراً، وبالتوازي تحديث النسخة المخزنة للمرة الجاية
  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    // نخزّن نسخة بدون query string حتى تُطابَق لاحقاً حتى لو تغيّر ?v=
    const urlNoQuery = new URL(request.url);
    urlNoQuery.search = '';
    cache.put(urlNoQuery.toString(), fresh.clone());
    return fresh;
  } catch (err) {
    const urlNoQuery = new URL(request.url);
    urlNoQuery.search = '';
    const cached = await cache.match(urlNoQuery.toString());
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || (await networkFetch) || Response.error();
}
