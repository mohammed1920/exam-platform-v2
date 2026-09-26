(function () {
  'use strict';

  function initMizanLogo() {
    const container = document.getElementById('mizan-logo-animation');
    if (!container) return;

    const fallback = () => {
      container.innerHTML = '<img src="assets/branding/mizan-logo.svg" alt="شعار ميزان" class="mizan-logo-fallback">';
    };

    if (!window.lottie) {
      fallback();
      return;
    }

    try {
      const animation = window.lottie.loadAnimation({
        container,
        renderer: 'svg',
        loop: false,
        autoplay: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        path: 'assets/branding/mizan-logo.json',
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet' }
      });
      animation.addEventListener('data_failed', fallback);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        animation.goToAndStop(89, true);
      }
    } catch (_) {
      fallback();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMizanLogo, { once: true });
  } else {
    initMizanLogo();
  }
})();