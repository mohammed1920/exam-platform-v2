(function () {
  'use strict';

  function initMizanLogo() {
    const container = document.getElementById('mizan-logo-animation');
    if (!container) return;

    // SVG is the single source of truth for the Mizan brand mark.
    // Do not load the experimental Lottie file here; malformed Lottie
    // geometry was causing random/incomplete symbols on some renderers.
    container.innerHTML =
      '<img src="assets/branding/mizan-logo.svg" alt="شعار ميزان" class="mizan-logo-fallback mizan-logo-static">';

    const logo = container.querySelector('img');
    if (!logo) return;

    logo.addEventListener('load', function () {
      logo.classList.add('mizan-logo-ready');
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMizanLogo, { once: true });
  } else {
    initMizanLogo();
  }
})();