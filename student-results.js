/* Student Firestore results integration */
(function () {
  'use strict';

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function formatDate(value) {
    try {
      let date = value;
      if (value && typeof value.toDate === 'function') date = value.toDate();
      return new Intl.DateTimeFormat('ar-IQ', {
        year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }).format(new Date(date));
    } catch (_) { return '-'; }
  }

  function formatDuration(seconds) {
    const sec = Math.max(0, Number(seconds) || 0);
    const mins = Math.floor(sec / 60);
    const rest = sec % 60;
    return mins ? `${mins} د ${rest} ث` : `${rest} ث`;
  }

  async function getResults() {
    const auth = window.publicAuth;
    const user = auth && auth.user;
    const db = auth && auth.firestore;
    if (!user || !db) return [];
    try {
      const snapshot = await db.collection('examResults').where('uid', '==', user.uid).get();
      const rows = [];
      snapshot.forEach(doc => rows.push({ id: doc.id, ...doc.data() }));
      rows.sort((a, b) => {
        const av = a.completedAt && typeof a.completedAt.toMillis === 'function' ? a.completedAt.toMillis() : new Date(a.startedAt || 0).getTime();
        const bv = b.completedAt && typeof b.completedAt.toMillis === 'function' ? b.completedAt.toMillis() : new Date(b.startedAt || 0).getTime();
        return bv - av;
      });
      return rows;
    } catch (error) {
      console.error('تعذر تحميل نتائج الطالب من Firestore:', error);
      return [];
    }
  }

  function renderResultsPage(results) {
    const exams = results.length;
    const questions = results.reduce((sum, x) => sum + (Number(x.totalQuestions) || 0), 0);
    const avg = exams ? Math.round(results.reduce((sum, x) => sum + (Number(x.percentage) || 0), 0) / exams) : 0;
    const best = exams ? Math.max(...results.map(x => Number(x.percentage) || 0)) : 0;
    const passed = results.filter(x => (Number(x.percentage) || 0) >= 60).length;
    const passRate = exams ? Math.round((passed / exams) * 100) : 0;

    const cards = results.slice(0, 50).map(item => `
      <article class="history-item">
        <div class="history-icon">${Number(item.percentage) >= 90 ? '🏆' : Number(item.percentage) >= 80 ? '🥇' : Number(item.percentage) >= 70 ? '🥈' : Number(item.percentage) >= 60 ? '🥉' : '❌'}</div>
        <div class="history-main">
          <strong>${escapeHtml(item.bookTitle || 'اختبار')}</strong>
          <span>${item.custom ? 'اختبار عشوائي شامل' : `الفصل ${escapeHtml(item.chapter == null ? '-' : item.chapter)}`}</span>
          <small>${formatDate(item.completedAt || item.startedAt)} · ${formatDuration(item.duration)}</small>
        </div>
        <div class="history-score">
          <strong>${Number(item.percentage) || 0}%</strong>
          <span>${Number(item.score) || 0} / ${Number(item.totalQuestions) || 0}</span>
        </div>
      </article>`).join('');

    return `
      <div class="student-page-header"><div class="student-page-icon"><i class="fas fa-chart-line"></i></div><div><span>حساب الطالب</span><h2>نتائجي</h2><p>نتائج اختباراتك محفوظة في حسابك ويمكنك الوصول إليها من أي جهاز بعد تسجيل الدخول.</p></div></div>
      <div class="profile-stats-grid">
        <div class="profile-stat-card"><span>📝</span><strong>${exams}</strong><small>اختبار مكتمل</small></div>
        <div class="profile-stat-card"><span>❓</span><strong>${questions}</strong><small>سؤال</small></div>
        <div class="profile-stat-card"><span>📊</span><strong>${avg}%</strong><small>متوسط النتائج</small></div>
        <div class="profile-stat-card"><span>🏆</span><strong>${best}%</strong><small>أفضل نتيجة</small></div>
        <div class="profile-stat-card"><span>✅</span><strong>${passRate}%</strong><small>نسبة النجاح</small></div>
      </div>
      <div class="profile-panel">
        <div class="profile-panel-heading"><div><h3>سجل نتائجك</h3><p>هذه النتائج مرتبطة بحسابك في Firestore وليست مخزنة على هذا الجهاز فقط.</p></div></div>
        <div class="exam-history-list">${cards || '<div class="profile-empty">لا توجد نتائج مكتملة لهذا الحساب حتى الآن.</div>'}</div>
      </div>`;
  }

  async function refreshRemoteResults(target) {
    if (target !== 'results') return;
    const root = document.getElementById('student-dashboard-content');
    if (!root) return;
    const results = await getResults();
    if (results.length || (window.publicAuth && window.publicAuth.firestore)) {
      root.innerHTML = renderResultsPage(results);
    }
  }

  function install() {
    if (!window.studentDashboard || window.__studentFirestoreResultsInstalled) return;
    window.__studentFirestoreResultsInstalled = true;
    const dashboard = window.studentDashboard;
    const originalRender = dashboard.render;
    dashboard.render = function (target) {
      const result = originalRender.call(dashboard, target);
      window.setTimeout(() => refreshRemoteResults(target || 'profile'), 0);
      return result;
    };
    window.addEventListener('public-auth-state-changed', () => {
      const target = history.state && history.state.dashboardTarget;
      if (target === 'results') refreshRemoteResults('results');
    });
  }

  function waitForDashboard() {
    if (window.studentDashboard) { install(); return; }
    const timer = window.setInterval(() => {
      if (window.studentDashboard) { window.clearInterval(timer); install(); }
    }, 100);
    window.setTimeout(() => window.clearInterval(timer), 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForDashboard);
  else waitForDashboard();
})();
