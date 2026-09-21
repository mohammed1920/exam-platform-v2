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
      const target = document.getElementById('books-section');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      const footer = document.querySelector('footer');
      if (footer) footer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const names = {
      judicial: 'اختبارات المعهد القضائي',
      laws: 'القوانين العراقية',
      procedures: 'إجراءات الدعاوى',
      petitions: 'العرائض والطلبات',
      lawyers: 'دليل المحامين'
    };
    if (names[action]) showNotice(names[action], 'هذا القسم قيد الإعداد وسيتم ربط محتواه لاحقاً دون التأثير على نظام الاختبارات الحالي.');
  }

  function syncVisibility() {
    const home = document.querySelector('.platform-home');
    const books = document.getElementById('books-section');
    if (!home || !books) return;
    home.style.display = books.classList.contains('active') ? '' : 'none';
  }

  function install() {
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
