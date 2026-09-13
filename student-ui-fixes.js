/* Student account UI refinements: compact account trigger only. */
(function () {
  'use strict';

  function syncAccountTrigger() {
    const button = document.getElementById('account-btn');
    if (!button) return;
    const loggedIn = Boolean(window.publicAuth && window.publicAuth.user);
    const desiredMarkup = loggedIn
      ? '<i class="fas fa-bars" aria-hidden="true"></i>'
      : 'سجل الدخول';
    if (button.innerHTML !== desiredMarkup) button.innerHTML = desiredMarkup;
    button.setAttribute('aria-label', loggedIn ? 'فتح قائمة حسابي' : 'سجل الدخول');
    button.title = loggedIn ? 'قائمة حسابي' : 'سجل الدخول';
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
