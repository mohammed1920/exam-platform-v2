/* Student dashboard - phase 1
 * Stores the signed-in student's exam history locally.
 * Phase 2 can replace the storage adapter with Firestore without changing the UI.
 */
(function () {
  'use strict';

  const STORAGE_PREFIX = 'lawExam.studentHistory.v1';

  function getUserKey() {
    const user = window.publicAuth && window.publicAuth.user;
    return user ? String(user.uid || user.email || 'user') : null;
  }

  function storageKey() {
    const key = getUserKey();
    return key ? `${STORAGE_PREFIX}.${key}` : null;
  }

  function readHistory() {
    try {
      const key = storageKey();
      if (!key) return [];
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  function writeHistory(items) {
    try {
      const key = storageKey();
      if (!key) return;
      localStorage.setItem(key, JSON.stringify(items.slice(0, 100)));
    } catch (error) {
      console.warn('تعذر حفظ سجل الاختبارات محلياً:', error);
    }
  }

  function saveExamResult(result, app) {
    const user = window.publicAuth && window.publicAuth.user;
    if (!user || !result) return;

    const book = app && app.currentBook;
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      bookId: book && book.id ? book.id : null,
      bookTitle: book && book.title ? book.title : 'اختبار عشوائي مخصص',
      chapter: app && app.currentChapter ? app.currentChapter : null,
      custom: Boolean(app && app.isCustomExam),
      score: Number(result.score) || 0,
      totalQuestions: Number(result.totalQuestions) || 0,
      percentage: Number(result.percentage) || 0,
      grade: result.grade || { grade: '-', emoji: '📄' },
      duration: Number(result.duration) || 0,
      wrongCount: Array.isArray(result.answers) ? result.answers.filter(a => !a.isCorrect).length : 0,
      answers: Array.isArray(result.answers) ? result.answers : []
    };

    const history = readHistory();
    history.unshift(entry);
    writeHistory(history);
    window.dispatchEvent(new CustomEvent('student-history-updated'));
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat('ar-IQ', {
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(new Date(value));
    } catch (_) {
      return value || '-';
    }
  }

  function formatDuration(seconds) {
    const sec = Math.max(0, Number(seconds) || 0);
    const mins = Math.floor(sec / 60);
    const rest = sec % 60;
    return mins ? `${mins} د ${rest} ث` : `${rest} ث`;
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function getStats(history) {
    const exams = history.length;
    const questions = history.reduce((sum, x) => sum + (Number(x.totalQuestions) || 0), 0);
    const avg = exams ? Math.round(history.reduce((sum, x) => sum + (Number(x.percentage) || 0), 0) / exams) : 0;
    const best = exams ? Math.max(...history.map(x => Number(x.percentage) || 0)) : 0;
    const passed = history.filter(x => (Number(x.percentage) || 0) >= 60).length;
    const passRate = exams ? Math.round((passed / exams) * 100) : 0;
    return { exams, questions, avg, best, passRate };
  }

  function render() {
    const root = document.getElementById('student-dashboard-content');
    if (!root) return;

    const user = window.publicAuth && window.publicAuth.user;
    if (!user) {
      root.innerHTML = '<div class="profile-empty">🔐 سجّل الدخول أولاً للوصول إلى حسابك.</div>';
      return;
    }

    const history = readHistory();
    const stats = getStats(history);
    const name = escapeHtml(user.displayName || 'طالب المنصة');
    const email = escapeHtml(user.email || '');
    const initial = escapeHtml((user.displayName || user.email || 'ط').trim().charAt(0).toUpperCase());

    root.innerHTML = `
      <div class="profile-hero">
        <div class="profile-avatar">${initial}</div>
        <div class="profile-identity">
          <h2>${name}</h2>
          <p>${email}</p>
          <span>🎓 حساب الطالب</span>
        </div>
        <button type="button" class="profile-logout-btn" id="profile-logout-btn">تسجيل الخروج</button>
      </div>

      <div class="profile-stats-grid">
        <div class="profile-stat-card"><span>📝</span><strong>${stats.exams}</strong><small>اختبار مكتمل</small></div>
        <div class="profile-stat-card"><span>❓</span><strong>${stats.questions}</strong><small>سؤال تمت الإجابة عنه</small></div>
        <div class="profile-stat-card"><span>📊</span><strong>${stats.avg}%</strong><small>متوسط النتائج</small></div>
        <div class="profile-stat-card"><span>🏆</span><strong>${stats.best}%</strong><small>أفضل نتيجة</small></div>
        <div class="profile-stat-card"><span>✅</span><strong>${stats.passRate}%</strong><small>نسبة النجاح</small></div>
      </div>

      <div class="profile-panel">
        <div class="profile-panel-heading">
          <div><h3>📚 سجل الاختبارات</h3><p>آخر نتائجك محفوظة لهذا الحساب على هذا الجهاز حالياً.</p></div>
          ${history.length ? '<button type="button" id="clear-history-btn" class="profile-clear-btn">مسح السجل</button>' : ''}
        </div>
        <div class="exam-history-list">
          ${history.length ? history.slice(0, 20).map((item, index) => `
            <article class="history-item">
              <div class="history-icon">${escapeHtml(item.grade?.emoji || '📄')}</div>
              <div class="history-main">
                <strong>${escapeHtml(item.bookTitle || 'اختبار')}</strong>
                <span>${item.custom ? 'اختبار عشوائي شامل' : `الفصل ${escapeHtml(item.chapter || '-')}`}</span>
                <small>${formatDate(item.createdAt)} · ${formatDuration(item.duration)}</small>
              </div>
              <div class="history-score">
                <strong>${Number(item.percentage) || 0}%</strong>
                <span>${Number(item.score) || 0} / ${Number(item.totalQuestions) || 0}</span>
              </div>
            </article>
          `).join('') : '<div class="profile-empty">لم تكمل أي اختبار بعد. ابدأ أول اختبار حتى يظهر سجل النتائج هنا 🚀</div>'}
        </div>
      </div>

      <div class="profile-panel profile-coming-soon">
        <div><span class="coming-icon">🔒</span><div><h3>المزايا القادمة</h3><p>سنضيف لاحقاً المفضلة، الأسئلة الخاطئة، تقدم كل كتاب، والاشتراكات والصلاحيات.</p></div></div>
      </div>
    `;

    const logout = document.getElementById('profile-logout-btn');
    if (logout) logout.onclick = () => window.publicAuth.signOut();

    const clear = document.getElementById('clear-history-btn');
    if (clear) clear.onclick = () => {
      if (confirm('هل تريد مسح سجل نتائج اختباراتك من هذا الجهاز؟')) {
        writeHistory([]);
        render();
      }
    };
  }

  function openDashboard() {
    if (!window.publicAuth || !window.publicAuth.user) {
      window.publicAuth.openLogin();
      return;
    }
    if (window.app && window.app.examActive) return;
    window.app.navigateTo('student-dashboard');
    render();
  }

  function install() {
    const account = document.getElementById('account-btn');
    if (account) {
      const replacement = account.cloneNode(true);
      account.replaceWith(replacement);
      replacement.addEventListener('click', openDashboard);
    }

    if (window.app && typeof window.app.endExam === 'function') {
      const originalEndExam = window.app.endExam.bind(window.app);
      window.app.endExam = function () {
        const result = window.examEngine.finishExam();
        saveExamResult(result, this);
        originalEndExam();
      };
    }

    window.addEventListener('student-history-updated', render);
    window.addEventListener('public-auth-state-changed', () => {
      const account = document.getElementById('account-btn');
      if (account && window.publicAuth.user) account.textContent = `👤 ${window.publicAuth.displayName(window.publicAuth.user)}`;
    });
  }

  window.studentDashboard = {
    open: openDashboard,
    render,
    getHistory: readHistory
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
