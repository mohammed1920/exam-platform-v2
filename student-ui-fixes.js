/* Student account UI refinements: compact account trigger + sidebar access inside student pages. */
(function () {
  'use strict';

  function syncAccountTrigger() {
    const button = document.getElementById('account-btn');
    if (!button) return;
    const loggedIn = Boolean(window.publicAuth && window.publicAuth.user);
    button.innerHTML = loggedIn ? '<i class="fas fa-bars" aria-hidden="true"></i>' : '<i class="fas fa-lock" aria-hidden="true"></i>';
    button.setAttribute('aria-label', loggedIn ? 'فتح قائمة حسابي' : 'تسجيل الدخول');
    button.title = loggedIn ? 'قائمة حسابي' : 'تسجيل الدخول';
    button.classList.toggle('authenticated', loggedIn);
  }

  function ensureStudentPageMenu() {
    const section = document.getElementById('student-dashboard-section');
    if (!section || !section.classList.contains('active')) return;
    const content = document.getElementById('student-dashboard-content');
    if (!content) return;
    let button = document.getElementById('student-page-menu-btn');
    if (button) return;

    button = document.createElement('button');
    button.type = 'button';
    button.id = 'student-page-menu-btn';
    button.className = 'student-page-menu-btn';
    button.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i><span>قائمة حسابي</span>';
    button.addEventListener('click', () => {
      if (window.studentDashboard && typeof window.studentDashboard.openSidebar === 'function') {
        window.studentDashboard.openSidebar();
      }
    });
    section.insertBefore(button, content);
  }

  function removeStudentPageMenuWhenInactive() {
    const section = document.getElementById('student-dashboard-section');
    if (!section || section.classList.contains('active')) return;
    const button = document.getElementById('student-page-menu-btn');
    if (button) button.remove();
  }

  function sync() {
    syncAccountTrigger();
    ensureStudentPageMenu();
    removeStudentPageMenuWhenInactive();
  }

  function install() {
    sync();
    window.addEventListener('public-auth-state-changed', sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.setInterval(sync, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
