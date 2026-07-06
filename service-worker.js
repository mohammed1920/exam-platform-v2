// service-worker.js
// استراتيجية التخزين المؤقت لمنصة الاختبارات القانونية
//
// ⚠️ مهم: كل مرة تعمل تحديث جوهري على ملفات ثابتة (app.js, style.css, examEngine.js)
// غيّر رقم CACHE_VERSION بالأسفل حتى يعرف المتصفح إنه يحتاج ينزّل نسخة جديدة.
// بيانات الأسئلة (data/*.json) ما تحتاج تغيير هذا الرقم، لأنها تُحدَّث تلقائيًا
// بكل مرة (استراتيجية Network First تشرح بالأسفل).

const CACHE_VERSION = 'v2';
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

// ---------- التفعيل: حذف الكاش القديم + تحميل مسبق لكل بيانات الأسئلة ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1) حذف نسخ كاش قديمة من إصدارات سابقة
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
      // 2) تحميل كل بيانات الكتب والفصول بالخلفية (حتى الفصول التي لم تُفتح بعد)
      //    هذا يضمن عمل كل الفصول بدون إنترنت من أول تثبيت، لا فقط ما تمت زيارته.
      await precacheAllData();
    })()
  );
  self.clients.claim();
});

async function precacheAllData() {
  const cache = await caches.open(CACHE_NAME);
  try {
    const booksRes = await fetch('./data/books.json');
    if (!booksRes.ok) return;
    const booksClone = booksRes.clone();
    await cache.put('./data/books.json', booksClone);
    const books = await booksRes.json();

    // نجيب كل فصول كل كتاب بالتوازي (105 ملف فقط، ~9 ميجا إجمالي، سريع)
    const tasks = [];
    for (const book of books) {
      const chapterCount = book.chapters || 0;
      for (let i = 1; i <= chapterCount; i++) {
        const url = `./data/${book.id}/chapter_${i}.json`;
        tasks.push(
          fetch(url)
            .then((res) => {
              if (res.ok) cache.put(url, res.clone());
            })
            .catch(() => {}) // نتجاهل فصل واحد يفشل، ونكمل الباقي
        );
      }
    }
    await Promise.all(tasks);
  } catch (err) {
    console.warn('فشل التحميل المسبق لبيانات الأسئلة:', err);
  }
}

// ---------- استقبال طلب تحديث يدوي من الصفحة (يُستخدم لتحديث كل البيانات بصمت) ----------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'REFRESH_DATA') {
    event.waitUntil(precacheAllData());
  }
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
