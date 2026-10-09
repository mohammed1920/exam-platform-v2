/* Admin panel theme toggle. */
(function () {
  'use strict';

  const root = document.documentElement;
  const button = document.getElementById('admin-theme-toggle');

  function applyTheme(theme) {
    root.setAttribute('data-admin-theme', theme);

    if (!button) return;
    button.textContent = theme === 'light' ? '🌙' : '☀️';
    button.title = theme === 'light' ? 'الوضع الليلي' : 'الوضع النهاري';
  }

  let theme = 'dark';
  try {
    theme = localStorage.getItem('platform-theme') === 'light' ? 'light' : 'dark';
  } catch (_) {
    // Theme storage may be unavailable in restricted browser contexts.
  }

  applyTheme(theme);

  if (button) {
    button.addEventListener('click', () => {
      theme = root.getAttribute('data-admin-theme') === 'light' ? 'dark' : 'light';

      try {
        localStorage.setItem('platform-theme', theme);
      } catch (_) {
        // The current page still switches theme when persistence is unavailable.
      }

      applyTheme(theme);
    });
  }
})();
