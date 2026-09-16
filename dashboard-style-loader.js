(function () {
  'use strict';
  const basePath = window.location.pathname.includes('/exam-platform-v2') ? '/exam-platform-v2' : '';

  // Student UI assets. Firebase admin UI is loaded here only as a hidden tab;
  // the tab itself becomes visible after an admins/{uid} role check.
  ['user-dashboard.css?v=1.1','student-sidebar.css?v=1.3','student-ui-fixes.css?v=1.5','leaderboard.css?v=1.0'].forEach(file => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${basePath}/${file}`;
    document.head.appendChild(link);
  });

  ['student-ui-fixes.js?v=1.2', 'student-account-patch.js?v=1.1', 'leaderboard.js?v=1.0', 'wrong-answers-limit.js?v=1.0', 'platform-header-fix.js?v=1.0', 'firebase-admin-panel.js?v=1.0'].forEach(src => {
    const script = document.createElement('script');
    script.src = `${basePath}/${src}`;
    script.async = false;
    script.onerror = () => console.warn(`تعذر تحميل ${src}.`);
    document.head.appendChild(script);
  });
})();
