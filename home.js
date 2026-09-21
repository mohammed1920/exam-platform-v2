/* الصفحة الرئيسية: طبقة تنقل مستقلة عن محرك الاختبارات. */
(function () {
  'use strict';

  function showNotice(title, text) {
    let box = document.getElementById('home-notice');
    if (!box) {
      box = document.createElement('div');
      box.id = 'home-notice';
      box.className = 'home-notice';
      document.body.appendChild(box);
    }
    box.innerHTML = '<strong>' + title + '</strong><span>' + text + '</span>';
    box.classList.add('is-visible');
    clearTimeout(box._timer);
    box._timer = setTimeout(() => box.classList.remove('is-visible'), 2600);
  }

  function run(action) {
    if (action === 'books') {
      if (window.app && typeof window.app.navigateTo === 'function') window.app.navigateTo('books');
      return;
    }
    if (action === 'random') {
      if (window.app && typeof window.app.showCustomExamSetup === 'function') window.app.showCustomExamSetup();
      return;
    }
    if (action === 'dashboard') {
      if (window.studentDashboard) window.studentDashboard.open('exam-dashboard');
      else showNotice('لوحة الاختبارات', 'جارٍ تجهيز حساب الطالب، حاول مرة أخرى.');
      return;
    }
    if (action === 'leaderboard') {
      if (!window.publicAuth || !window.publicAuth.user) {
        window.publicAuth && window.publicAuth.openLogin();
        return;
      }
      if (window.app) window.app.navigateTo('student-dashboard', { dashboardTarget: 'leaderboard' });
      if (window.studentLeaderboard) window.studentLeaderboard.render();
      return;
    }
    if (action === 'contact') {
      if (window.app && typeof window.app.navigateTo === 'function') window.app.navigateTo('contact');
      return;
    }
    const names = {
      judicial: 'اختبارات المعهد القضائي',
      laws: 'القوانين العراقية',
      procedures: 'إجراءات الدعاوى',
      petitions: 'العرائض والطلبات',
      lawyers: 'دليل المحامين'
    };
    if (action === 'lawyers') {
      loadLawyerDirectory();
      const open = () => window.app?.navigateTo('lawyers');
      if (window.lawyerDirectory) open();
      else window.setTimeout(open, 250);
      return;
    }
    if (names[action]) showNotice(names[action], 'هذا القسم قيد الإعداد وسيتم ربط محتواه لاحقاً دون التأثير على نظام الاختبارات الحالي.');
  }

  function syncVisibility() {
    const home = document.querySelector('.platform-home');
    const books = document.getElementById('books-section');
    if (!home || !books) return;
    // app.js هو المسؤول عن تحديد الشاشة الحالية؛ لا نعيد إظهار الكتب فوق الصفحة الرئيسية.
    if (books.classList.contains('active')) home.style.display = 'none';
    else if (history.state && history.state.view === 'home') home.style.display = '';
  }

  window.app = window.app || {};
  window.app.showHomeNotice = showNotice;

  function loadLawyerDirectory() {
    if (window.lawyerDirectory || document.querySelector('script[data-lawyer-directory]')) return;
    const storage = document.createElement('script');
    storage.src = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage-compat.js';
    storage.onload = () => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'lawyer-directory.css?v=1.0'; css.dataset.lawyerDirectoryCss = '1';
      document.head.appendChild(css);
      const script = document.createElement('script');
      script.src = 'lawyer-directory.js?v=1.0'; script.dataset.lawyerDirectory = '1';
      document.body.appendChild(script);
    };
    document.head.appendChild(storage);
  }

  function install() {
    loadLawyerDirectory();
    syncVisibility();
    const observer = new MutationObserver(syncVisibility);
    document.querySelectorAll('.view-section').forEach(section => observer.observe(section, { attributes: true, attributeFilter: ['class'] }));
    document.addEventListener('click', event => {
      const trigger = event.target.closest('[data-home-action]');
      if (trigger) run(trigger.dataset.homeAction);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
