/* إدارة الوضع الليلي والنهاري للمنصة */
(function(){
  'use strict';

  const STORAGE_KEY = 'platform-theme';

  function isLight(){
    return document.documentElement.getAttribute('data-theme') === 'light';
  }

  function applyTheme(theme){
    const light = theme === 'light';
    if (light) document.documentElement.setAttribute('data-theme','light');
    else document.documentElement.removeAttribute('data-theme');

    const button = document.getElementById('theme-toggle');
    if (button) {
      button.innerHTML = light
        ? '<i class="fas fa-moon" aria-hidden="true"></i>'
        : '<i class="fas fa-sun" aria-hidden="true"></i>';
      button.setAttribute('aria-label', light ? 'تفعيل الوضع الليلي' : 'تفعيل الوضع النهاري');
      button.setAttribute('title', light ? 'الوضع الليلي' : 'الوضع النهاري');
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#f5f7fb' : '#0f172a');

    document.documentElement.style.colorScheme = light ? 'light' : 'dark';
  }

  function toggle(){
    const next = isLight() ? 'dark' : 'light';
    try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
    applyTheme(next);
  }

  function init(){
    let saved = 'dark';
    try { saved = localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'; } catch (_) {}
    applyTheme(saved);

    const button = document.getElementById('theme-toggle');
    if (button) button.addEventListener('click', toggle);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }

  window.platformTheme = { applyTheme, toggle };
})();