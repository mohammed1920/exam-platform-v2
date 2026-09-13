(function () {
  'use strict';
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `${window.location.pathname.includes('/exam-platform-v2') ? '/exam-platform-v2' : ''}/user-dashboard.css?v=1.0`;
  document.head.appendChild(link);
})();
