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

  let mizanPulpitLoadPromise = null;

  function loadMizanPulpit() {
    if (window.mizanPulpit && typeof window.mizanPulpit.open === 'function') return Promise.resolve(window.mizanPulpit);
    if (mizanPulpitLoadPromise) return mizanPulpitLoadPromise;
    if (!document.querySelector('link[data-mizan-pulpit-css]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'mizan-pulpit.css?v=2.4';
      css.dataset.mizanPulpitCss = '1';
      document.head.appendChild(css);
    }
    mizanPulpitLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-mizan-pulpit-loader]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.mizanPulpit), { once: true });
        existing.addEventListener('error', () => reject(new Error('تعذر تحميل منبر ميزان')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'mizan-pulpit.js?v=1.2';
      script.dataset.mizanPulpitLoader = '1';
      script.onload = () => resolve(window.mizanPulpit);
      script.onerror = () => reject(new Error('تعذر تحميل منبر ميزان'));
      document.body.appendChild(script);
    }).catch(error => { mizanPulpitLoadPromise = null; throw error; });
    return mizanPulpitLoadPromise;
  }

  window.loadMizanPulpit = loadMizanPulpit;

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
    if (action === 'mizan-pulpit') { loadMizanPulpit().then(api => api?.open?.()).catch(() => showNotice('منبر ميزان', 'تعذر تحميل المنبر. تحقق من الاتصال ثم أعد المحاولة.')); return; }
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
      loadLawyerDirectory()
        .then(() => window.app?.navigateTo('lawyers'))
        .catch(() => showNotice('دليل المحامين', 'تعذر تحميل الدليل. تحقق من الاتصال ثم أعد المحاولة.'));
      return;
    }
    if (action === 'petitions') {
      loadPetitions()
        .then(api => api?.open?.())
        .catch(() => showNotice('العرائض والطلبات', 'تعذر تحميل القسم. تحقق من الاتصال ثم أعد المحاولة.'));
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

  let lawyerDirectoryLoadPromise = null;
  function loadLawyerDirectory() {
    if (window.lawyerDirectory) return Promise.resolve(window.lawyerDirectory);
    if (lawyerDirectoryLoadPromise) return lawyerDirectoryLoadPromise;
    lawyerDirectoryLoadPromise = new Promise((resolve, reject) => {
      const finish = () => window.lawyerDirectory ? resolve(window.lawyerDirectory) : reject(new Error('تعذر تحميل دليل المحامين'));
      const injectDirectory = () => {
        if (!document.querySelector('link[data-lawyer-directory-css]')) {
          const css = document.createElement('link');
          css.rel = 'stylesheet';
          css.href = 'lawyer-directory.css?v=2.2';
          css.dataset.lawyerDirectoryCss = '1';
          document.head.appendChild(css);
        }
        const existing = document.querySelector('script[data-lawyer-directory]');
        if (existing) {
          existing.addEventListener('load', finish, { once: true });
          existing.addEventListener('error', () => reject(new Error('تعذر تحميل دليل المحامين')), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.src = 'lawyer-directory.js?v=1.0';
        script.dataset.lawyerDirectory = '1';
        script.onload = finish;
        script.onerror = () => reject(new Error('تعذر تحميل دليل المحامين'));
        document.body.appendChild(script);
      };
      const existingStorage = document.querySelector('script[data-lawyer-storage-loader]');
      if (existingStorage) {
        existingStorage.addEventListener('load', injectDirectory, { once: true });
        existingStorage.addEventListener('error', () => reject(new Error('تعذر تحميل خدمات دليل المحامين')), { once: true });
        return;
      }
      const storage = document.createElement('script');
      storage.src = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage-compat.js';
      storage.dataset.lawyerStorageLoader = '1';
      storage.onload = injectDirectory;
      storage.onerror = () => reject(new Error('تعذر تحميل خدمات دليل المحامين'));
      document.head.appendChild(storage);
    }).catch(error => {
      lawyerDirectoryLoadPromise = null;
      throw error;
    });
    return lawyerDirectoryLoadPromise;
  }

  window.loadLawyerDirectory = loadLawyerDirectory;

  let petitionsLoadPromise = null;
  function loadPetitions() {
    if (window.petitions && typeof window.petitions.open === 'function') return Promise.resolve(window.petitions);
    if (petitionsLoadPromise) return petitionsLoadPromise;
    if (!document.querySelector('link[data-petitions-css]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'petitions.css?v=2.6';
      css.dataset.petitionsCss = '1';
      document.head.appendChild(css);
    }
    petitionsLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-petitions-loader]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.petitions), { once: true });
        existing.addEventListener('error', () => reject(new Error('تعذر تحميل قسم العرائض والطلبات')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'petitions.js?v=1.7';
      script.dataset.petitionsLoader = '1';
      script.onload = () => resolve(window.petitions);
      script.onerror = () => reject(new Error('تعذر تحميل قسم العرائض والطلبات'));
      document.body.appendChild(script);
    }).catch(error => {
      petitionsLoadPromise = null;
      throw error;
    });
    return petitionsLoadPromise;
  }

  window.loadPetitions = loadPetitions;

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

(function setupFooterLinks(){
  const routes = {about:'about',terms:'terms',privacy:'privacy',disclaimer:'disclaimer',faq:'faq'};
  function installFooter(){
    document.addEventListener('click', event => {
      const link = event.target.closest('[data-footer-action]');
      if(link){
        const view = routes[link.dataset.footerAction];
        if(view && window.app?.navigateTo) window.app.navigateTo(view);
        return;
      }
      if(event.target.closest('[data-footer-back]') && window.app?.navigateTo){
        window.app.navigateTo('home');
      }
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installFooter);
  else installFooter();
})();
