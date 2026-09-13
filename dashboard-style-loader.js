(function () {
  'use strict';
  const basePath = window.location.pathname.includes('/exam-platform-v2') ? '/exam-platform-v2' : '';
  ['user-dashboard.css?v=1.0','student-sidebar.css?v=1.0'].forEach(file => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${basePath}/${file}`;
    document.head.appendChild(link);
  });
})();
