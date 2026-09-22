/* Student account behavior refinements */
(function () {
  'use strict';

  function currentUser() {
    return window.publicAuth && window.publicAuth.user;
  }

  function syncSidebarUser() {
    const sidebar = document.getElementById('student-account-sidebar') || document.getElementById('platform-sidebar');
    if (!sidebar) return;
    const user = currentUser();
    const name = user && (user.displayName || user.email) ? (user.displayName || user.email) : 'زائر';
    const email = user && user.email ? user.email : 'سجّل الدخول للوصول إلى ميزات الحساب';
    const avatar = document.getElementById('student-sidebar-avatar');
    const nameEl = document.getElementById('student-sidebar-name');
    const emailEl = document.getElementById('student-sidebar-email');
    const status = sidebar.querySelector('.student-sidebar-status');
    const statusText = sidebar.querySelector('.student-sidebar-status-text');
    const login = document.getElementById('student-sidebar-login');
    const logout = document.getElementById('student-sidebar-logout');

    const setText = (element, value) => {
      if (element && element.textContent !== value) element.textContent = value;
    };
    const setHtml = (element, value) => {
      if (element && element.innerHTML !== value) element.innerHTML = value;
    };
    setText(avatar, user ? name.trim().charAt(0).toUpperCase() || 'ط' : '👤');
    setText(nameEl, name);
    setText(emailEl, email);
    setText(statusText, user ? 'حساب الطالب' : 'تسجيل الدخول مطلوب');
    if (login) login.hidden = Boolean(user);
    if (logout) {
      logout.hidden = !user;
      setHtml(logout, '<i class="fas fa-right-from-bracket"></i><span>تسجيل الخروج</span>');
    }
  }

  function openSidebarForCurrentState() {
    const user = currentUser();
    if (!user) {
      if (window.publicAuth?.openLogin) window.publicAuth.openLogin();
      return;
    }
    if (window.platformNavigation && typeof window.platformNavigation.open === 'function') {
      window.platformNavigation.open();
      return;
    }
    const sidebar = document.getElementById('student-account-sidebar');
    if (!sidebar) return;
    syncSidebarUser();
    sidebar.classList.add('is-open');
    sidebar.setAttribute('aria-hidden', 'false');
    document.body.classList.add('student-sidebar-open');
  }

  function bindAccountButton() {
    const account = document.getElementById('account-btn');
    if (!account || account.dataset.accountPatchBound === 'true') return;
    const replacement = account.cloneNode(true);
    account.replaceWith(replacement);
    replacement.dataset.accountPatchBound = 'true';
    replacement.addEventListener('click', openSidebarForCurrentState);
  }

  function updateAccountButton() {
    const button = document.getElementById('account-btn');
    if (!button) return;
    const user = currentUser();
    if (user) {
      const desiredMarkup = '<i class="fas fa-bars" aria-hidden="true"></i>';
      if (button.innerHTML !== desiredMarkup) button.innerHTML = desiredMarkup;
      button.setAttribute('aria-label', 'فتح قائمة حسابي');
      button.title = 'قائمة حسابي';
      button.classList.add('authenticated');
    } else {
      if (button.textContent !== '🔐 تسجيل الدخول') button.textContent = '🔐 تسجيل الدخول';
      button.setAttribute('aria-label', 'سجل الدخول');
      button.title = 'سجل الدخول';
      button.classList.remove('authenticated');
    }
  }

  function updateSidebarLogoutAction() {
    const button = document.getElementById('student-sidebar-logout');
    if (!button || button.dataset.accountPatchAction === 'true') return;
    button.dataset.accountPatchAction = 'true';
    button.addEventListener('click', event => {
      if (currentUser()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.publicAuth && window.publicAuth.openLogin();
    }, true);
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function removeLegacySidebar() {
    const legacy = document.getElementById('student-account-sidebar');
    if (legacy) legacy.remove();
    document.body.classList.remove('student-sidebar-open');
  }

  function install() {
    removeLegacySidebar();
    bindAccountButton();
    updateAccountButton();
    syncSidebarUser();
    updateSidebarLogoutAction();

    // لا نراقب document.body بالكامل؛ هذا كان يعيد تشغيل التحديثات مع كل تغيير DOM
    // وقد يسبب حلقة تحديث/تجمّد للواجهة. التحديثات هنا تُدار عند بدء الصفحة
    // وعند تغيّر حالة تسجيل الدخول فقط.
    window.addEventListener('public-auth-state-changed', event => {
      updateAccountButton();
      syncSidebarUser();
      if (event.detail && event.detail.user === null) {
        const sidebar = document.getElementById('student-account-sidebar') || document.getElementById('platform-sidebar');
        if (sidebar) {
          sidebar.classList.remove('is-open');
          sidebar.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('student-sidebar-open');
        if (window.app && typeof window.app.backToBooks === 'function') window.app.backToBooks();
      }
      removeLegacySidebar();
      updateSidebarLogoutAction();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
