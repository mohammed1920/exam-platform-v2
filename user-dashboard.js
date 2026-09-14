/* Student account sidebar + separate student pages */
(function () {
  'use strict';

  const STORAGE_PREFIX = 'lawExam.studentHistory.v1';
  const MENU = [
    { id: 'profile', icon: 'fa-user', label: 'الملف الشخصي', target: 'profile' },
    { id: 'results', icon: 'fa-chart-line', label: 'نتائجي', target: 'results' },
    { id: 'history', icon: 'fa-clock-rotate-left', label: 'السجل والتقدم', target: 'history' },
    { id: 'wrong', icon: 'fa-circle-xmark', label: 'إجاباتي الخاطئة', target: 'wrong' },
    { id: 'favorites', icon: 'fa-bookmark', label: 'المفضلة', target: 'favorites' }
  ];

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
    } catch (_) { return []; }
  }

  function writeHistory(items) {
    try {
      const key = storageKey();
      if (key) localStorage.setItem(key, JSON.stringify(items.slice(0, 100)));
    } catch (error) { console.warn('تعذر حفظ سجل الاختبارات محلياً:', error); }
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
        year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }).format(new Date(value));
    } catch (_) { return value || '-'; }
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
    return { exams, questions, avg, best, passRate: exams ? Math.round((passed / exams) * 100) : 0 };
  }

  function ensureSidebar() {
    let sidebar = document.getElementById('student-account-sidebar');
    if (sidebar) return sidebar;
    sidebar = document.createElement('aside');
    sidebar.id = 'student-account-sidebar';
    sidebar.className = 'student-account-sidebar';
    sidebar.setAttribute('aria-hidden', 'true');
    sidebar.innerHTML = `
      <div class="student-sidebar-backdrop" data-sidebar-close></div>
      <div class="student-sidebar-panel" role="dialog" aria-modal="true" aria-label="حساب الطالب">
        <button type="button" class="student-sidebar-close" data-sidebar-close aria-label="إغلاق القائمة"><i class="fas fa-times"></i></button>
        <div class="student-sidebar-brand">
          <div class="student-sidebar-avatar" id="student-sidebar-avatar">ط</div>
          <div><strong id="student-sidebar-name">طالب المنصة</strong><span id="student-sidebar-email"></span></div>
        </div>
        <div class="student-sidebar-status"><span class="student-sidebar-status-dot"></span><span class="student-sidebar-status-text">حساب الطالب</span><button type="button" class="student-sidebar-login" id="student-sidebar-login">تسجيل الدخول</button></div>
        <nav class="student-sidebar-nav" aria-label="قائمة حساب الطالب">
          <div class="student-sidebar-heading">حسابي</div>
          ${MENU.map(item => `<button type="button" class="student-sidebar-item" data-sidebar-target="${item.target}"><i class="fas ${item.icon}"></i><span>${item.label}</span></button>`).join('')}
        </nav>
        <div class="student-sidebar-divider"></div>
        <button type="button" class="student-sidebar-item student-sidebar-home" data-sidebar-home><i class="fas fa-house"></i><span>الصفحة الرئيسية</span></button>
        <button type="button" class="student-sidebar-logout" id="student-sidebar-logout"><i class="fas fa-right-from-bracket"></i><span>تسجيل الخروج</span></button>
      </div>`;
    document.body.appendChild(sidebar);

    sidebar.querySelectorAll('[data-sidebar-close]').forEach(el => el.addEventListener('click', closeSidebar));
    sidebar.querySelectorAll('[data-sidebar-target]').forEach(btn => btn.addEventListener('click', () => {
      const target = btn.dataset.sidebarTarget;
      closeSidebar();
      openDashboard(target);
    }));
    const home = sidebar.querySelector('[data-sidebar-home]');
    if (home) home.addEventListener('click', () => { closeSidebar(); window.app && window.app.backToBooks(); });
    const logout = sidebar.querySelector('#student-sidebar-logout');
    if (logout) logout.addEventListener('click', () => window.publicAuth.signOut());
    const login = sidebar.querySelector('#student-sidebar-login');
    if (login) login.addEventListener('click', () => { closeSidebar(); window.publicAuth.openLogin(); });
    return sidebar;
  }

  function updateSidebarUser() {
    const user = window.publicAuth && window.publicAuth.user;
    if (!user) return;
    const name = user.displayName || 'طالب المنصة';
    const email = user.email || '';
    const avatar = document.getElementById('student-sidebar-avatar');
    const nameEl = document.getElementById('student-sidebar-name');
    const emailEl = document.getElementById('student-sidebar-email');
    if (avatar) avatar.textContent = name.trim().charAt(0).toUpperCase() || 'ط';
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;
  }

  function openSidebar() {
    if (!window.publicAuth || !window.publicAuth.user) { window.publicAuth.openLogin(); return; }
    const sidebar = ensureSidebar();
    updateSidebarUser();
    sidebar.classList.add('is-open');
    sidebar.setAttribute('aria-hidden', 'false');
    document.body.classList.add('student-sidebar-open');
  }

  function closeSidebar() {
    const sidebar = document.getElementById('student-account-sidebar');
    if (!sidebar) return;
    sidebar.classList.remove('is-open');
    sidebar.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('student-sidebar-open');
  }

  function syncActiveMenu(target) {
    const sidebar = document.getElementById('student-account-sidebar');
    if (!sidebar) return;
    sidebar.querySelectorAll('[data-sidebar-target]').forEach(button => {
      const active = button.dataset.sidebarTarget === target;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function ensureSection() {
    let section = document.getElementById('student-dashboard-section');
    if (section) return section;
    const main = document.querySelector('main.container');
    if (!main) return null;
    section = document.createElement('section');
    section.id = 'student-dashboard-section';
    section.className = 'view-section';
    section.innerHTML = `
      <button class="back-btn" id="student-dashboard-back"><i class="fas fa-arrow-right"></i> العودة للكتب</button>
      <div id="student-dashboard-content"></div>`;
    main.appendChild(section);
    const back = section.querySelector('#student-dashboard-back');
    if (back) back.onclick = () => window.app.backToBooks();
    return section;
  }

  function pageHeader(title, description, icon) {
    return `<div class="student-page-header"><div class="student-page-icon"><i class="fas ${icon}"></i></div><div><span>حساب الطالب</span><h2>${title}</h2><p>${description}</p></div></div>`;
  }

  function renderProfile(user) {
    const name = escapeHtml(user.displayName || 'طالب المنصة');
    const email = escapeHtml(user.email || '');
    const initial = escapeHtml((user.displayName || user.email || 'ط').trim().charAt(0).toUpperCase());
    return `${pageHeader('الملف الشخصي', 'معلومات حسابك في منصة الاختبارات القانونية.', 'fa-user')}
      <div class="student-profile-card">
        <div class="profile-avatar">${initial}</div>
        <div class="profile-identity"><h3>${name}</h3><p>${email}</p><span>🎓 حساب الطالب</span></div>
      </div>
      <div class="student-info-grid">
        <div><small>الاسم</small><strong>${name}</strong></div>
        <div><small>البريد الإلكتروني</small><strong>${email || '-'}</strong></div>
        <div><small>حالة الحساب</small><strong class="student-ok">نشط</strong></div>
      </div>
      <button type="button" class="profile-logout-btn" id="profile-logout-btn"><i class="fas fa-right-from-bracket"></i> تسجيل الخروج</button>`;
  }

  function renderResults(history) {
    const stats = getStats(history);
    return `${pageHeader('نتائجي', 'ملخص أدائك في الاختبارات التي أكملتها.', 'fa-chart-line')}
      <div class="profile-stats-grid">
        <div class="profile-stat-card"><span>📝</span><strong>${stats.exams}</strong><small>اختبار مكتمل</small></div>
        <div class="profile-stat-card"><span>❓</span><strong>${stats.questions}</strong><small>سؤال</small></div>
        <div class="profile-stat-card"><span>📊</span><strong>${stats.avg}%</strong><small>متوسط النتائج</small></div>
        <div class="profile-stat-card"><span>🏆</span><strong>${stats.best}%</strong><small>أفضل نتيجة</small></div>
        <div class="profile-stat-card"><span>✅</span><strong>${stats.passRate}%</strong><small>نسبة النجاح</small></div>
      </div>
      <div class="profile-panel student-highlight-panel"><h3>آخر نتيجة</h3>${history.length ? `<strong class="student-big-score">${Number(history[0].percentage) || 0}%</strong><p>${escapeHtml(history[0].bookTitle || 'اختبار')} · ${history[0].custom ? 'اختبار مخصص' : `الفصل ${escapeHtml(history[0].chapter || '-')}`}</p>` : '<p class="profile-empty">لم تكمل أي اختبار بعد.</p>'}</div>`;
  }

  function renderHistory(history) {
    const draft = window.app && typeof window.app.getExamDraftSummary === 'function' ? window.app.getExamDraftSummary() : null;
    const grouped = {};
    history.forEach(item => {
      const key = item.bookId || item.bookTitle || 'unknown';
      if (!grouped[key]) grouped[key] = { title: item.bookTitle || 'كتاب', exams: 0, total: 0, avg: 0 };
      grouped[key].exams += 1;
      grouped[key].total += Number(item.totalQuestions) || 0;
      grouped[key].avg += Number(item.percentage) || 0;
    });
    const progressRows = Object.values(grouped).map(row => ({ ...row, avg: Math.round(row.avg / row.exams) }));
    const draftHtml = draft ? `<div class="profile-panel resume-exam-panel"><div><span class="resume-exam-label">اختبار غير مكتمل</span><h3>${escapeHtml(draft.title)}</h3><p>وصلت إلى السؤال ${draft.questionNumber} من ${draft.totalQuestions} · ${draft.answered} إجابة محفوظة</p></div><button type="button" class="profile-resume-btn" id="resume-exam-btn"><i class="fas fa-play"></i> متابعة الاختبار</button></div>` : '';
    const progressHtml = `<div class="profile-panel"><div class="profile-panel-heading"><div><h3>تقدمك في الكتب</h3><p>متوسط نتائجك وعدد الاختبارات لكل كتاب.</p></div></div><div class="student-progress-list">${progressRows.length ? progressRows.map(row => `<div class="student-progress-item"><div class="student-progress-top"><strong>${escapeHtml(row.title)}</strong><span>${row.avg}%</span></div><div class="student-progress-bar"><i style="width:${Math.min(100, Math.max(0, row.avg))}%"></i></div><small>${row.exams} اختبار · ${row.total} سؤال</small></div>`).join('') : '<div class="profile-empty">ابدأ اختباراً في أحد الكتب ليظهر تقدمك هنا.</div>'}</div></div>`;
    return `${pageHeader('السجل والتقدم', 'راجع اختباراتك السابقة وتابع تقدمك أو أكمل اختباراً متوقفاً.', 'fa-clock-rotate-left')}
      ${draftHtml}
      ${progressHtml}
      <div class="profile-panel">
        <div class="profile-panel-heading"><div><h3>الاختبارات المكتملة</h3><p>${history.length} اختبار محفوظ على هذا الجهاز.</p></div>${history.length ? '<button type="button" id="clear-history-btn" class="profile-clear-btn">مسح السجل</button>' : ''}</div>
        <div class="exam-history-list">${history.length ? history.map(item => `<article class="history-item"><div class="history-icon">${escapeHtml(item.grade?.emoji || '📄')}</div><div class="history-main"><strong>${escapeHtml(item.bookTitle || 'اختبار')}</strong><span>${item.custom ? 'اختبار عشوائي شامل' : `الفصل ${escapeHtml(item.chapter || '-')}`}</span><small>${formatDate(item.createdAt)} · ${formatDuration(item.duration)}</small></div><div class="history-score"><strong>${Number(item.percentage) || 0}%</strong><span>${Number(item.score) || 0} / ${Number(item.totalQuestions) || 0}</span></div></article>`).join('') : '<div class="profile-empty">لا يوجد سجل اختبارات حتى الآن.</div>'}</div>
      </div>`;
  }

  function renderWrong(history) {
    const wrong = [];
    history.forEach(exam => (Array.isArray(exam.answers) ? exam.answers : []).forEach(answer => {
      if (!answer.isCorrect) wrong.push({ ...answer, bookTitle: exam.bookTitle, createdAt: exam.createdAt });
    }));
    return `${pageHeader('إجاباتي الخاطئة', 'راجع الأسئلة التي أخطأت فيها أثناء اختباراتك.', 'fa-circle-xmark')}
      <div class="profile-panel"><div class="exam-history-list">${wrong.length ? wrong.slice(0, 100).map((item, i) => `<article class="student-wrong-item"><div class="student-wrong-number">${i + 1}</div><div><strong>${escapeHtml(item.questionText || 'سؤال')}</strong><span>${escapeHtml(item.bookTitle || 'اختبار')} · إجابتك: ${escapeHtml(item.userAnswer || '-')}</span><small>الإجابة الصحيحة: ${escapeHtml(item.correctAnswer || '-')}</small></div></article>`).join('') : '<div class="profile-empty">ممتاز! لا توجد إجابات خاطئة محفوظة حتى الآن. 🎉</div>'}</div></div>`;
  }

  function renderProgress(history) {
    const grouped = {};
    history.forEach(item => {
      const key = item.bookId || item.bookTitle || 'unknown';
      if (!grouped[key]) grouped[key] = { title: item.bookTitle || 'كتاب', exams: 0, total: 0, avg: 0 };
      grouped[key].exams += 1;
      grouped[key].total += Number(item.totalQuestions) || 0;
      grouped[key].avg += Number(item.percentage) || 0;
    });
    const rows = Object.values(grouped).map(x => ({ ...x, avg: Math.round(x.avg / x.exams) }));
    return `${pageHeader('تقدمي في الكتب', 'ملخص تقدمك حسب الكتب التي اختبرت فيها.', 'fa-chart-pie')}
      <div class="profile-panel"><div class="student-progress-list">${rows.length ? rows.map(row => `<div class="student-progress-item"><div class="student-progress-top"><strong>${escapeHtml(row.title)}</strong><span>${row.avg}%</span></div><div class="student-progress-bar"><i style="width:${Math.min(100, Math.max(0, row.avg))}%"></i></div><small>${row.exams} اختبار · ${row.total} سؤال</small></div>`).join('') : '<div class="profile-empty">ابدأ اختباراً في أحد الكتب ليظهر تقدمك هنا.</div>'}</div></div>`;
  }

  function renderFavorites() {
    return `${pageHeader('المفضلة', 'الأسئلة التي تحفظها للوصول إليها بسرعة.', 'fa-bookmark')}
      <div class="profile-panel student-empty-feature"><div class="coming-icon">🔖</div><h3>لا توجد مفضلات بعد</h3><p>عند تفعيل حفظ الأسئلة، ستظهر الأسئلة التي تضيفها للمفضلة هنا فقط.</p></div>`;
  }

  function render(target = 'profile') {
    const section = ensureSection();
    const root = document.getElementById('student-dashboard-content');
    if (!section || !root) return;
    syncActiveMenu(target);
    const user = window.publicAuth && window.publicAuth.user;
    if (!user) { root.innerHTML = '<div class="profile-empty">🔐 سجّل الدخول أولاً للوصول إلى حسابك.</div>'; return; }
    const history = readHistory();
    if (target === 'results') root.innerHTML = renderResults(history);
    else if (target === 'history') root.innerHTML = renderHistory(history);
    else if (target === 'wrong') root.innerHTML = renderWrong(history);
    else if (target === 'progress') root.innerHTML = renderProgress(history);
    else if (target === 'favorites') root.innerHTML = renderFavorites();
    else root.innerHTML = renderProfile(user);

    const logout = document.getElementById('profile-logout-btn');
    if (logout) logout.onclick = () => window.publicAuth.signOut();
    const clear = document.getElementById('clear-history-btn');
    if (clear) clear.onclick = () => {
      if (confirm('هل تريد مسح سجل نتائج اختباراتك من هذا الجهاز؟')) {
        writeHistory([]);
        render('history');
      }
    };
    const resume = document.getElementById('resume-exam-btn');
    if (resume && window.app && typeof window.app.resumeSavedExam === 'function') resume.onclick = () => window.app.resumeSavedExam();
  }

  function openDashboard(target = 'profile') {
    if (!window.publicAuth || !window.publicAuth.user) { window.publicAuth.openLogin(); return; }
    if (window.app && window.app.examActive) {
      if (typeof window.app.saveExamDraft === 'function') window.app.saveExamDraft();
      clearInterval(window.app.timerInterval);
      window.app.examActive = false;
      document.body.classList.remove('exam-mode');
    }
    ensureSection();
    window.app.navigateTo('student-dashboard', { dashboardTarget: target });
    render(target);
  }

  function restoreDashboard(target = 'profile', pushState = false) {
    if (!window.publicAuth || !window.publicAuth.user) return;
    ensureSection();
    window.app.navigateTo('student-dashboard', { dashboardTarget: target }, pushState);
    render(target);
  }

  function install() {
    ensureSidebar();
    const account = document.getElementById('account-btn');
    if (account && !account.dataset.studentSidebarBound) {
      const replacement = account.cloneNode(true);
      account.replaceWith(replacement);
      replacement.dataset.studentSidebarBound = 'true';
      replacement.addEventListener('click', openSidebar);
    }
    window.addEventListener('student-history-updated', () => render());
    window.addEventListener('public-auth-state-changed', updateSidebarUser);
    updateSidebarUser();

    // حماية إضافية من حفظ نفس الاختبار مرتين بسبب أي استدعاء مزدوج.
    if (window.app && typeof window.app.endExam === 'function' && !window.app.__studentHistoryWrapped) {
      const originalEndExam = window.app.endExam.bind(window.app);
      window.app.endExam = function () {
        if (this.__studentHistorySaving) return originalEndExam();
        this.__studentHistorySaving = true;
        try {
          const result = window.examEngine.finishExam();
          saveExamResult(result, this);
          return originalEndExam();
        } finally {
          setTimeout(() => { this.__studentHistorySaving = false; }, 0);
        }
      };
      window.app.__studentHistoryWrapped = true;
    }
  }

  window.studentDashboard = { open: openDashboard, restore: restoreDashboard, openSidebar, closeSidebar, render, getHistory: readHistory };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
