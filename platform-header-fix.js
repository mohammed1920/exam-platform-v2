(function () {
  'use strict';

  function mountMizanLogo() {
    const container = document.getElementById('mizan-header-logo');
    if (!container || !window.lottie) return;
    try {
      window.lottie.loadAnimation({
        container,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: 'assets/branding/meezan-assemble.json'
      });
    } catch (_) {
      /* لا يُعاد أي شعار قديم إذا تعذر تشغيل Lottie. */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountMizanLogo, { once: true });
  } else {
    mountMizanLogo();
  }
})();
