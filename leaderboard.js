/* Student Leaderboard - Top 20 per book */
(function () {
  'use strict';

  const TOP_LIMIT = 20;
  const MIN_CHAPTERS = 3;
  let initialized = false;

  function auth() { return window.publicAuth || null; }
  function db() { const a = auth(); return a && a.firestore ? a.firestore : null; }
  function user() { const a = auth(); return a && a.user ? a.user : null; }
  function books() { return window.app && Array.isArray(window.app.books) ? window.app.books : []; }
  function bookById(id) { return books().find(book => book.id === id) || null; }
  function esc(value) { const div = document.createElement('div'); div.textContent = value == null ? '' : String(value); return div.innerHTML; }

  function scoreFromResults(results, book) {
    const bestByChapter = {};
    results.forEach(doc => {
      const data = doc.data() || {};
      if (data.bookId !== book.id || data.custom || data.chapter == null) return;
      const chapter = Number(data.chapter);
      if (!Number.isFinite(chapter) || chapter < 1) return;
      const score = Number(data.score) || 0;
      const total = Number(data.totalQuestions) || 0;
      if (total <= 0) return;
      const current = bestByChapter[chapter];
      if (!current || score / total > current.score / current.total ||
          (score / total === current.score / current.total && total > current.total)) {
        bestByChapter[chapter] = { score, total };
      }
    });

    const chapters = Object.keys(bestByChapter).map(Number);
    const completedChapters = chapters.length;
    const totalCorrect = chapters.reduce((sum, n) => sum + bestByChapter[n].score, 0);
    const totalQuestions = chapters.reduce((sum, n) => sum + bestByChapter[n].total, 0);
    const weightedSuccess = totalQuestions ? totalCorrect / totalQuestions : 0;
    const performanceScore = Math.round(weightedSuccess * 700 * 100) / 100;
    const totalBookChapters = Math.max(0, Number(book.chapters) || 0);
    const coverageScore = totalBookChapters
      ? Math.round(Math.min(1, completedChapters / totalBookChapters) * 300 * 100) / 100
      : 0;
    const finalScore = Math.round((performanceScore + coverageScore) * 100) / 100;

    return { completedChapters, totalBookChapters, totalCorrect, totalQuestions,
      weightedSuccess, performanceScore, coverageScore, finalScore,
      eligible: completedChapters >= MIN_CHAPTERS };
  }

  async function syncBook(book) {
    const currentUser = user();
    const firestore = db();
    if (!currentUser || !firestore || !book) return null;

    const snapshot = await firestore.collection('examResults').where('uid', '==', currentUser.uid).get();
    const stats = scoreFromResults(snapshot.docs, book);
    const profile = {
      uid: currentUser.uid,
      displayName: currentUser.displayName || currentUser.email || 'طالب',
      bookId: book.id,
      bookTitle: book.title || book.id,
      completedChapters: stats.completedChapters,
      totalBookChapters: stats.totalBookChapters,
      totalCorrect: stats.totalCorrect,
      totalQuestions: stats.totalQuestions,
      weightedSuccess: stats.weightedSuccess,
      performanceScore: stats.performanceScore,
      coverageScore: stats.coverageScore,
      finalScore: stats.finalScore,
      eligible: stats.eligible,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      version: 1
    };

    await firestore.collection('leaderboards').doc(book.id).collection('entries').doc(currentUser.uid)
      .set(profile, { merge: true });
    return profile;
  }

  async function loadTop20(book) {
    const firestore = db();
    if (!firestore || !book) return [];
    // One ordered query, capped at 20 reads. Ineligible entries are filtered locally.
    const snap = await firestore.collection('leaderboards').doc(book.id).collection('entries')
      .orderBy('finalScore', 'desc').limit(TOP_LIMIT).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(entry => entry.eligible).slice(0, TOP_LIMIT);
  }

  function medal(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `<span class="leaderboard-rank-number">${rank}</span>`;
  }
  function pageHeader() {
    return `<div class="student-page-header"><div class="student-page-icon"><i class="fas fa-trophy"></i></div><div><span>حساب الطالب</span><h2>🏆 المتصدرون</h2><p>أفضل 20 طالبًا في كل كتاب وفق نظام النقاط المعتمد.</p></div></div>`;
  }
  function renderLoading(root) {
    root.innerHTML = `${pageHeader()}<div class="profile-panel leaderboard-loading"><div class="leaderboard-spinner"></div><p>جاري تحديث قائمة المتصدرين...</p></div>`;
  }
  function bookSelector(selectedId) {
    return `<div class="leaderboard-book-picker"><label for="leaderboard-book-select">اختر الكتاب</label><select id="leaderboard-book-select">${books().map(book => `<option value="${esc(book.id)}" ${book.id === selectedId ? 'selected' : ''}>${esc(book.title || book.id)}</option>`).join('')}</select></div>`;
  }

  function renderTable(entries, own, book) {
    if (!entries.length) return `<div class="profile-panel leaderboard-empty"><div class="leaderboard-empty-icon">🏆</div><h3>لم تبدأ المنافسة بعد</h3><p>أكمل 3 فصول على الأقل لتدخل الترتيب الرسمي.</p></div>`;
    const rows = entries.map((entry, index) => {
      const rank = index + 1;
      const isMe = own && entry.uid === own.uid;
      const name = isMe ? 'أنت' : (entry.displayName || 'طالب');
      return `<article class="leaderboard-row ${isMe ? 'is-me' : ''}"><div class="leaderboard-rank">${medal(rank)}</div><div class="leaderboard-student"><strong>${esc(name)}</strong><small>${Number(entry.completedChapters) || 0} فصول مكتملة · ${Number(entry.weightedSuccess * 100 || 0).toFixed(1)}%</small></div><div class="leaderboard-score"><strong>${Number(entry.finalScore || 0).toFixed(1)}</strong><small>/ 1000</small></div></article>`;
    }).join('');
    const inTop = own && entries.some(entry => entry.uid === own.uid);
    const ownCard = own ? (inTop
      ? `<div class="leaderboard-own-card in-top"><span>⭐ ترتيبك الحالي</span><strong>ضمن أفضل 20</strong><small>درجتك: ${Number(own.finalScore || 0).toFixed(1)} / 1000 · ${own.completedChapters} فصول</small></div>`
      : `<div class="leaderboard-own-card outside-top"><span>📈 ترتيبك الحالي</span><strong>أنت خارج أفضل 20</strong><small>درجتك: ${Number(own.finalScore || 0).toFixed(1)} / 1000 · أكمل المزيد من الفصول وحسّن نتائجك للوصول إلى القائمة.</small></div>`)
      : `<div class="leaderboard-own-card outside-top"><span>📚 ترتيبك الحالي</span><strong>أكمل 3 فصول أولاً</strong><small>يظهر ترتيبك الرسمي بعد إكمال 3 فصول في هذا الكتاب.</small></div>`;
    return `<div class="profile-panel leaderboard-panel"><div class="leaderboard-panel-heading"><div><h3>أفضل 20</h3><p>${esc(book.title || book.id)}</p></div><span class="leaderboard-limit-badge">20 فقط</span></div><div class="leaderboard-list">${rows}</div></div>${ownCard}`;
  }

  async function render(bookId) {
    const root = document.getElementById('student-dashboard-content');
    if (!root) return;
    const currentUser = user();
    if (!currentUser) { root.innerHTML = '<div class="profile-empty">🔐 سجّل الدخول أولاً للوصول إلى المتصدرين.</div>'; return; }
    const book = bookById(bookId) || books()[0];
    if (!book) { root.innerHTML = `${pageHeader()}<div class="profile-empty">لا توجد كتب متاحة حاليًا.</div>`; return; }
    renderLoading(root);
    try {
      const own = await syncBook(book);
      const top20 = await loadTop20(book);
      root.innerHTML = `${pageHeader()}${bookSelector(book.id)}${renderTable(top20, own, book)}`;
      const select = document.getElementById('leaderboard-book-select');
      if (select) select.onchange = () => render(select.value);
    } catch (error) {
      console.error('Leaderboard load failed:', error);
      root.innerHTML = `${pageHeader()}${bookSelector(book.id)}<div class="profile-panel leaderboard-error"><h3>تعذر تحميل المتصدرين</h3><p>قد تحتاج صلاحيات Firestore إلى التحديث. حاول مرة أخرى بعد نشر قواعد Leaderboard.</p><button type="button" id="leaderboard-retry" class="profile-resume-btn">إعادة المحاولة</button></div>`;
      const retry = document.getElementById('leaderboard-retry');
      if (retry) retry.onclick = () => render(book.id);
    }
  }

  function injectMenu() {
    const nav = document.querySelector('#student-account-sidebar .student-sidebar-nav');
    if (!nav || nav.querySelector('[data-sidebar-target="leaderboard"]')) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'student-sidebar-item'; button.dataset.sidebarTarget = 'leaderboard';
    button.innerHTML = '<i class="fas fa-trophy"></i><span>المتصدرون</span>';
    nav.appendChild(button);
    button.addEventListener('click', () => {
      const sidebar = document.getElementById('student-account-sidebar');
      if (sidebar) { sidebar.classList.remove('is-open'); sidebar.setAttribute('aria-hidden', 'true'); }
      document.body.classList.remove('student-sidebar-open');
      if (window.app) window.app.navigateTo('student-dashboard', { dashboardTarget: 'leaderboard' });
      render();
    });
  }

  function install() {
    if (initialized) return;
    initialized = true;
    const wait = setInterval(() => injectMenu(), 100);
    setTimeout(() => clearInterval(wait), 10000);
    window.addEventListener('public-auth-state-changed', injectMenu);
    window.addEventListener('firestore-exam-result-saved', event => {
      const bookId = event.detail && event.detail.bookId;
      const book = bookById(bookId);
      if (book && user()) syncBook(book).catch(error => console.warn('Leaderboard sync failed:', error));
    });
    window.studentLeaderboard = { render, syncBook, loadTop20 };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
