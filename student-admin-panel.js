(function () {
  'use strict';

  const basePath = window.location.pathname.includes('/exam-platform-v2') ? '/exam-platform-v2' : '';
  const state = { isAdmin: false, students: [], loading: false };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[ch]));
  }

  function toDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value) {
    const date = toDate(value);
    if (!date) return '—';
    return new Intl.DateTimeFormat('ar-IQ', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }

  function isThisMonth(value) {
    const date = toDate(value);
    if (!date) return false;
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  async function getFirestore() {
    if (!window.publicAuth) return null;
    await window.publicAuth.whenReady();
    return window.publicAuth.firestore || null;
  }

  async function checkAdmin() {
    const db = await getFirestore();
    const user = window.publicAuth && window.publicAuth.user;
    if (!db || !user) return false;
    try {
      const snap = await db.collection('admins').doc(user.uid).get();
      state.isAdmin = snap.exists && snap.data()?.role === 'admin' && snap.data()?.enabled !== false;
      return state.isAdmin;
    } catch (error) {
      console.warn('Admin access check failed.');
      state.isAdmin = false;
      return false;
    }
  }

  function injectStyles() {
    if (document.getElementById('student-admin-panel-style')) return;
    const style = document.createElement('style');
    style.id = 'student-admin-panel-style';
    style.textContent = `
      #student-admin-section { display:none; margin:24px auto; max-width:1200px; padding:0 16px 32px; }
      #student-admin-section.is-visible { display:block; }
      .sap-card { background:rgba(15,23,42,.96); border:1px solid rgba(194,157,95,.25); border-radius:18px; padding:20px; box-shadow:0 12px 35px rgba(0,0,0,.18); }
      .sap-head { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; margin-bottom:18px; }
      .sap-title { margin:0; color:#c29d5f; font-size:22px; }
      .sap-subtitle { margin:5px 0 0; color:#94a3b8; font-size:13px; }
      .sap-refresh { border:1px solid #c29d5f; background:transparent; color:#c29d5f; border-radius:10px; padding:9px 14px; font-weight:700; cursor:pointer; }
      .sap-refresh:disabled { opacity:.55; cursor:wait; }
      .sap-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:18px; }
      .sap-stat { padding:16px; border-radius:14px; background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.07); }
      .sap-stat-label { color:#94a3b8; font-size:12px; }
      .sap-stat-value { display:block; color:#f8fafc; font-size:26px; font-weight:900; margin-top:5px; }
      .sap-table-wrap { overflow:auto; border-radius:14px; border:1px solid rgba(255,255,255,.07); }
      .sap-table { width:100%; border-collapse:collapse; min-width:680px; }
      .sap-table th,.sap-table td { padding:12px 13px; text-align:right; border-bottom:1px solid rgba(255,255,255,.06); }
      .sap-table th { color:#c29d5f; background:rgba(194,157,95,.06); font-size:13px; }
      .sap-table td { color:#e2e8f0; font-size:13px; }
      .sap-status { display:inline-flex; padding:4px 9px; border-radius:999px; font-size:11px; font-weight:800; }
      .sap-status.active { background:rgba(16,185,129,.13); color:#34d399; }
      .sap-status.suspended { background:rgba(239,68,68,.13); color:#f87171; }
      .sap-empty,.sap-error,.sap-loading { padding:20px; text-align:center; color:#94a3b8; }
      .sap-error { color:#f87171; }
      @media (max-width:700px) { .sap-stats { grid-template-columns:repeat(2,minmax(0,1fr)); } .sap-card { padding:14px; } }
    `;
    document.head.appendChild(style);
  }

  function createSection() {
    if (document.getElementById('student-admin-section')) return document.getElementById('student-admin-section');
    const section = document.createElement('section');
    section.id = 'student-admin-section';
    section.setAttribute('aria-hidden', 'true');
    section.innerHTML = `
      <div class="sap-card">
        <div class="sap-head">
          <div><h2 class="sap-title">إدارة الطلاب</h2><p class="sap-subtitle">معلومات الحسابات المسجلة في المنصة</p></div>
          <button type="button" class="sap-refresh" id="sap-refresh">↻ تحديث</button>
        </div>
        <div class="sap-stats" id="sap-stats"></div>
        <div id="sap-list"><div class="sap-loading">جاري التحميل...</div></div>
      </div>`;
    const target = document.querySelector('main.container') || document.body;
    target.appendChild(section);
    section.querySelector('#sap-refresh').addEventListener('click', loadStudents);
    return section;
  }

  function renderStats() {
    const total = state.students.length;
    const active = state.students.filter(s => s.status !== 'suspended').length;
    const suspended = state.students.filter(s => s.status === 'suspended').length;
    const thisMonth = state.students.filter(s => isThisMonth(s.createdAt)).length;
    document.getElementById('sap-stats').innerHTML = `
      <div class="sap-stat"><span class="sap-stat-label">إجمالي الطلاب</span><strong class="sap-stat-value">${total}</strong></div>
      <div class="sap-stat"><span class="sap-stat-label">الحسابات الفعالة</span><strong class="sap-stat-value">${active}</strong></div>
      <div class="sap-stat"><span class="sap-stat-label">هذا الشهر</span><strong class="sap-stat-value">${thisMonth}</strong></div>
      <div class="sap-stat"><span class="sap-stat-label">الموقوفة</span><strong class="sap-stat-value">${suspended}</strong></div>`;
  }

  function renderStudents() {
    const root = document.getElementById('sap-list');
    if (!state.students.length) {
      root.innerHTML = '<div class="sap-empty">لا توجد حسابات طلاب مسجلة حالياً.</div>';
      return;
    }
    root.innerHTML = `<div class="sap-table-wrap"><table class="sap-table"><thead><tr><th>الاسم</th><th>البريد الإلكتروني</th><th>تاريخ التسجيل</th><th>الحالة</th></tr></thead><tbody>${state.students.map(s => `
      <tr><td>${esc(s.displayName || 'طالب المنصة')}</td><td dir="ltr">${esc(s.email || '—')}</td><td>${formatDate(s.createdAt)}</td><td><span class="sap-status ${s.status === 'suspended' ? 'suspended' : 'active'}">${s.status === 'suspended' ? 'موقوف' : 'فعال'}</span></td></tr>`).join('')}</tbody></table></div>`;
  }

  async function loadStudents() {
    if (!state.isAdmin || state.loading) return;
    const db = await getFirestore();
    const button = document.getElementById('sap-refresh');
    if (!db) return;
    state.loading = true;
    if (button) button.disabled = true;
    document.getElementById('sap-list').innerHTML = '<div class="sap-loading">جاري تحديث بيانات الطلاب...</div>';
    try {
      const snap = await db.collection('students').orderBy('createdAt', 'desc').limit(2000).get();
      state.students = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderStats();
      renderStudents();
    } catch (error) {
      console.error('Student administration read failed:', error);
      document.getElementById('sap-list').innerHTML = '<div class="sap-error">تعذر تحميل بيانات الطلاب. تحقق من قواعد Firestore.</div>';
    } finally {
      state.loading = false;
      if (button) button.disabled = false;
    }
  }

  async function boot() {
    injectStyles();
    const section = createSection();
    await checkAdmin();
    if (!state.isAdmin) {
      section.remove();
      return;
    }
    section.classList.add('is-visible');
    section.setAttribute('aria-hidden', 'false');
    await loadStudents();
  }

  window.studentAdminPanel = { refresh: loadStudents, checkAdmin };

  if (window.publicAuth) {
    window.publicAuth.whenReady().then(boot);
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      const wait = window.setInterval(() => {
        if (window.publicAuth) { window.clearInterval(wait); window.publicAuth.whenReady().then(boot); }
      }, 100);
      window.setTimeout(() => window.clearInterval(wait), 15000);
    });
  }
})();
