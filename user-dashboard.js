/* Student account sidebar + dashboard */
(function () {
  'use strict';

  const STORAGE_PREFIX = 'lawExam.studentHistory.v1';
  const MENU = [
    { id: 'profile', icon: 'fa-user', label: 'الملف الشخصي', target: 'profile' },
    { id: 'results', icon: 'fa-chart-line', label: 'نتائجي', target: 'results' },
    { id: 'history', icon: 'fa-clock-rotate-left', label: 'سجل الاختبارات', target: 'results' },
    { id: 'wrong', icon: 'fa-circle-xmark', label: 'إجاباتي الخاطئة', target: 'coming' },
    { id: 'progress', icon: 'fa-chart-pie', label: 'تقدمي في الكتب', target: 'coming' },
    { id: 'favorites', icon: 'fa-bookmark', label: 'المفضلة', target: 'coming' }
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
    try { return new Intl.DateTimeFormat('ar-IQ', { year:'numeric', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(value)); }
    catch (_) { return value || '-'; }
  }
  function formatDuration(seconds) {
    const sec = Math.max(0, Number(seconds) || 0), mins = Math.floor(sec / 60), rest = sec % 60;
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
        <div class="student-sidebar-status"><span></span> حساب الطالب</div>
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
      <div class="student-dashboard-header"><span class="dashboard-kicker">حساب الطالب</span><h2>مركز الطالب</h2><p>تابع نتائجك وتقدمك في منصة الاختبارات القانونية.</p></div>
      <div id="student-dashboard-content"></div>`;
    main.appendChild(section);
    const back = section.querySelector('#student-dashboard-back');
    if (back) back.onclick = () => window.app.backToBooks();
    return section;
  }

  function render(target) {
    const section = ensureSection();
    const root = document.getElementById('student-dashboard-content');
    if (!section || !root) return;
    const user = window.publicAuth && window.publicAuth.user;
    if (!user) { root.innerHTML = '<div class="profile-empty">🔐 سجّل الدخول أولاً للوصول إلى حسابك.</div>'; return; }
    const history = readHistory();
    const stats = getStats(history);
    const name = escapeHtml(user.displayName || 'طالب المنصة');
    const email = escapeHtml(user.email || '');
    const initial = escapeHtml((user.displayName || user.email || 'ط').trim().charAt(0).toUpperCase());
    const focus = target === 'results' ? 'results' : target === 'coming' ? 'coming' : 'profile';

    root.innerHTML = `
      <div class="profile-hero" id="dashboard-profile">
        <div class="profile-avatar">${initial}</div>
        <div class="profile-identity"><h2>${name}</h2><p>${email}</p><span>🎓 حساب الطالب</span></div>
        <button type="button" class="profile-logout-btn" id="profile-logout-btn">تسجيل الخروج</button>
      </div>
      <div class="profile-stats-grid" id="dashboard-stats">
        <div class="profile-stat-card"><span>📝</span><strong>${stats.exams}</strong><small>اختبار مكتمل</small></div>
        <div class="profile-stat-card"><span>❓</span><strong>${stats.questions}</strong><small>سؤال تمت الإجابة عنه</small></div>
        <div class="profile-stat-card"><span>📊</span><strong>${stats.avg}%</strong><small>متوسط النتائج</small></div>
        <div class="profile-stat-card"><span>🏆</span><strong>${stats.best}%</strong><small>أفضل نتيجة</small></div>
        <div class="profile-stat-card"><span>✅</span><strong>${stats.passRate}%</strong><small>نسبة النجاح</small></div>
      </div>
      <div class="profile-panel" id="dashboard-results">
        <div class="profile-panel-heading"><div><h3>📚 سجل الاختبارات</h3><p>نتائج اختبارات هذا الحساب على هذا الجهاز حالياً.</p></div>${history.length ? '<button type="button" id="clear-history-btn" class="profile-clear-btn">مسح السجل</button>' : ''}</div>
        <div class="exam-history-list">${history.length ? history.slice(0, 20).map(item => `
          <article class="history-item"><div class="history-icon">${escapeHtml(item.grade?.emoji || '📄')}</div><div class="history-main"><strong>${escapeHtml(item.bookTitle || 'اختبار')}</strong><span>${item.custom ? 'اختبار عشوائي شامل' : `الفصل ${escapeHtml(item.chapter || '-')}`}</span><small>${formatDate(item.createdAt)} · ${formatDuration(item.duration)}</small></div><div class="history-score"><strong>${Number(item.percentage) || 0}%</strong><span>${Number(item.score) || 0} / ${Number(item.totalQuestions) || 0}</span></div></article>`).join('') : '<div class="profile-empty">لم تكمل أي اختبار بعد. ابدأ أول اختبار حتى يظهر سجل النتائج هنا 🚀</div>'}</div>
      </div>
      <div class="profile-panel profile-coming-soon" id="dashboard-coming"><div><span class="coming-icon">🔒</span><div><h3>مزايا الطالب القادمة</h3><p>المفضلة، الأسئلة الخاطئة، تقدم كل كتاب، والاشتراكات والصلاحيات ستضاف تباعاً.</p></div></div></div>`;

    const logout = document.getElementById('profile-logout-btn');
    if (logout) logout.onclick = () => window.publicAuth.signOut();
    const clear = document.getElementById('clear-history-btn');
    if (clear) clear.onclick = () => { if (confirm('هل تريد مسح سجل نتائج اختباراتك من هذا الجهاز؟')) { writeHistory([]); render('results'); } };

    if (focus === 'results') setTimeout(() => document.getElementById('dashboard-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
    if (focus === 'coming') setTimeout(() => document.getElementById('dashboard-coming')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
  }

  function openDashboard(target = 'profile') {
    if (!window.publicAuth || !window.publicAuth.user) { window.publicAuth.openLogin(); return; }
    if (window.app && window.app.examActive) return;
    ensureSection();
    window.app.navigateTo('student-dashboard');
    render(target);
  }

  function install() {
    ensureSidebar();
    const account = document.getElementById('account-btn');
    if (account) {
      const replacement = account.cloneNode(true);
      account.replaceWith(replacement);
      replacement.addEventListener('click', openSidebar);
    }
    window.addEventListener('student-history-updated', () => render());
    window.addEventListener('public-auth-state-changed', () => { updateSidebarUser(); });
    updateSidebarUser();

    // حفظ نتيجة الاختبار مرة واحدة؛ ExamEngine يحمي finishExam من الاستدعاء المكرر.
    if (window.app && typeof window.app.endExam === 'function' && !window.app.__studentHistoryWrapped) {
      const originalEndExam = window.app.endExam.bind(window.app);
      window.app.endExam = function () {
        const result = window.examEngine.finishExam();
        saveExamResult(result, this);
        originalEndExam();
      };
      window.app.__studentHistoryWrapped = true;
    }
  }

  window.studentDashboard = { open: openDashboard, openSidebar, closeSidebar, render, getHistory: readHistory };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
