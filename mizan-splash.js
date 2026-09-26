(function () {
  'use strict';

  function hideMizanSplash() {
    const splash = document.getElementById('mizan-splash');
    if (!splash) return;

    window.setTimeout(function () {
      splash.classList.add('is-hidden');
      window.setTimeout(function () {
        splash.remove();
      }, 600);
    }, 2200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideMizanSplash, { once: true });
  } else {
    hideMizanSplash();
  }
})();