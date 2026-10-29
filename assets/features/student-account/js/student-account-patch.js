/* Student account behavior: after sign-out, close the sidebar and return to the home screen. */
(function () {
  'use strict';

  function install() {
    window.addEventListener('public-auth-state-changed', event => {
      if (!event.detail || event.detail.user !== null) return;

      const sidebar = document.getElementById('platform-sidebar');
      if (sidebar) {
        sidebar.classList.remove('is-open');
        sidebar.setAttribute('aria-hidden', 'true');
      }

      // بعد تسجيل الخروج نرجع دائماً للرئيسية، وليس لقسم الكتب.
      if (window.app && typeof window.app.backToHome === 'function') {
        window.app.backToHome();
      } else if (window.app && typeof window.app.navigateTo === 'function') {
        window.app.navigateTo('home');
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
