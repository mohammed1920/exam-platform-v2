(function () {
  'use strict';
  const basePath = window.location.pathname.includes('/exam-platform-v2') ? '/exam-platform-v2' : '';
  ['user-dashboard.css?v=1.1','student-sidebar.css?v=1.2','student-ui-fixes.css?v=1.3'].forEach(file => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${basePath}/${file}`;
    document.head.appendChild(link);
  });

  ['student-ui-fixes.js?v=1.2', 'student-account-patch.js?v=1.1'].forEach(src => {
    const script = document.createElement('script');
    script.src = `${basePath}/${src}`;
    script.async = false;
    script.onerror = () => console.warn(`تعذر تحميل ${src}.`);
    document.head.appendChild(script);
  });
})();
