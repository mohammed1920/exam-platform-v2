(function () {
  'use strict';
  const basePath = window.location.pathname.includes('/exam-platform-v2') ? '/exam-platform-v2' : '';
  ['user-dashboard.css?v=1.1','student-sidebar.css?v=1.1','student-ui-fixes.css?v=1.0'].forEach(file => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${basePath}/${file}`;
    document.head.appendChild(link);
  });

  const script = document.createElement('script');
  script.src = `${basePath}/student-ui-fixes.js?v=1.0`;
  script.async = false;
  script.onerror = () => console.warn('تعذر تحميل تحسينات واجهة حساب الطالب.');
  document.head.appendChild(script);
})();
