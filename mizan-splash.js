(function () {
  'use strict';

  function hideMizanSplash() {
    const splash = document.getElementById('mizan-splash');
    if (!splash) return;

    // Keep the splash visible until the logo and all brand text finish entering.
    window.setTimeout(function () {
      splash.classList.add('is-hidden');
      window.setTimeout(function () {
        splash.remove();
      }, 600);
    }, 1850);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideMizanSplash, { once: true });
  } else {
    hideMizanSplash();
  }
})();
