/* إدارة الوضع الليلي والنهاري للمنصة */
(function(){
  'use strict';

  const STORAGE_KEY = 'platform-theme';

  function isLight(){
    return document.documentElement.getAttribute('data-theme') === 'light';
  }


  const icons = {
    sun: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path></svg>`,
    moon: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8 8.7 8.7 0 1 0 20.2 15.3Z"></path><path d="M16 3v4m-2-2h4"></path></svg>`
  };

  function applyTheme(theme){
    const light = theme === 'light';
    if (light) document.documentElement.setAttribute('data-theme','light');
    else document.documentElement.removeAttribute('data-theme');

    const button = document.getElementById('theme-toggle');
    if (button) {
      button.innerHTML = light ? icons.moon : icons.sun;
      button.setAttribute('aria-label', light ? 'تفعيل الوضع الليلي' : 'تفعيل الوضع النهاري');
      button.setAttribute('title', light ? 'الوضع الليلي' : 'الوضع النهاري');
      button.setAttribute('aria-pressed', String(light));
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#f5f7fb' : '#0f172a');

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