/* Student account UI refinements: compact account trigger only. */
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

  function install() {
    syncAccountTrigger();
    window.addEventListener('public-auth-state-changed', syncAccountTrigger);
    const observer = new MutationObserver(syncAccountTrigger);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
