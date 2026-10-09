/* Main platform navigation - طبقة مستقلة عن نظام الاختبارات */
(function(){
  'use strict';

  const items={
    home:{label:'الرئيسية',icon:'fa-house'},
    books:{label:'كتب القانون',icon:'fa-book-open'},
    judicial:{label:'اختبارات المعهد القضائي',icon:'fa-landmark'},
    random:{label:'الاختبار العشوائي',icon:'fa-dice'},
    laws:{label:'القوانين العراقية',icon:'fa-scale-balanced'},
    procedures:{label:'إجراءات الدعاوى',icon:'fa-file-signature'},
    petitions:{label:'عرائض وطلبات',icon:'fa-file-lines'},
    lawyers:{label:'دليل المحامين',icon:'fa-user-tie'},
    'mizan-pulpit':{label:'منبر ميزان',icon:'fa-feather-pointed'},
    dashboard:{label:'لوحة الاختبارات',icon:'fa-chart-line'},
    about:{label:'عن المنصة',icon:'fa-circle-info'},
    contact:{label:'تواصل معنا',icon:'fa-headset'},
    help:{label:'المساعدة',icon:'fa-circle-question'}
  };

  function notice(action){
    const names={
      judicial:'اختبارات المعهد القضائي',
      laws:'القوانين العراقية',
      procedures:'إجراءات الدعاوى',
      petitions:'عرائض وطلبات',
      lawyers:'دليل المحامين',
      about:'عن المنصة',
      help:'المساعدة'
    };
    const text={
      judicial:'سيتم ربط هذا القسم بالمحتوى الخاص بالمعهد القضائي لاحقاً.',
      laws:'سيتم إنشاء مكتبة القوانين العراقية كقسم مستقل عن الاختبارات.',
      procedures:'سيتم تنظيم الإجراءات القضائية في قسم مستقل وقابل للتوسعة.',
      petitions:'سيتم إضافة نماذج العرائض والطلبات ضمن قسم مستقل.',
      lawyers:'سيتم تجهيز دليل المحامين وربطه ببياناته الخاصة لاحقاً.',
      about:'صفحة تعريفية بالمنصة وأهدافها ومجالات استخدامها قيد التجهيز.',
      help:'سيتم تجهيز مركز المساعدة والأسئلة الشائعة ضمن قسم مستقل.'
    };
    if(window.app && typeof window.app.showHomeNotice==='function') window.app.showHomeNotice(names[action]||'القسم',text[action]||'هذا القسم قيد الإعداد.');
  }

  function run(action){
    close();
    if(action==='home'){ if(window.app) window.app.navigateTo('home'); return; }
    if(action==='books'){ if(window.app) window.app.navigateTo('books'); return; }
    if(action==='random'){ if(window.app) window.app.showCustomExamSetup(); return; }
    if(action==='dashboard'){
      if(window.studentDashboard) window.studentDashboard.open('exam-dashboard');
      return;
    }
    if(action==='profile'){
      if(!window.publicAuth || !window.publicAuth.user){ window.publicAuth?.openLogin(); return; }
      if(window.studentDashboard) window.studentDashboard.open('profile');
      return;
    }
    if(action==='admin'){
      if(window.firebaseAdminPanel?.open) window.firebaseAdminPanel.open();
      return;
    }
    if(action==='contact'){
      if(window.app) window.app.navigateTo('contact');
      return;
    }
    if(action==='about'){
      if(window.app) window.app.navigateTo('about');
      return;
    }
    if(action==='help'){
      if(window.app) window.app.navigateTo('faq');
      return;
    }
    if(action==='lawyers'){
      if(typeof window.loadLawyerDirectory === 'function'){
        window.loadLawyerDirectory()
          .then(()=>window.app?.navigateTo('lawyers'))
          .catch(()=>window.app?.showHomeNotice?.('دليل المحامين','تعذر تحميل الدليل. تحقق من الاتصال ثم أعد المحاولة.'));
      } else {
        window.app?.showHomeNotice?.('دليل المحامين','جارٍ تجهيز الدليل، أعد المحاولة بعد لحظة.');
      }
      return;
    }
    if(action==='petitions'){
      if(typeof window.loadPetitions === 'function'){
        window.loadPetitions()
          .then(api => api?.open?.())
          .catch(()=>window.app?.showHomeNotice?.('العرائض والطلبات','تعذر تحميل القسم. تحقق من الاتصال ثم أعد المحاولة.'));
      } else {
        window.app?.showHomeNotice?.('العرائض والطلبات','جارٍ تجهيز القسم، أعد المحاولة بعد لحظة.');
      }
      return;
    }
    if(action==='mizan-pulpit'){
      if (typeof window.loadMizanPulpit === 'function') {
        window.loadMizanPulpit().then(api => api?.open?.()).catch(() => window.app?.showHomeNotice?.('منبر ميزان','تعذر تحميل المنبر. تحقق من الاتصال ثم أعد المحاولة.'));
      } else {
        window.app?.navigateTo('mizan-pulpit');
      }
      return;
    }
    notice(action);
  }

  function ensure(){
    if(document.getElementById('platform-sidebar')) return;
    const wrap=document.createElement('aside');
    wrap.id='platform-sidebar';
    wrap.className='platform-sidebar';
    wrap.setAttribute('aria-hidden','true');
    wrap.innerHTML=`
      <div class="platform-sidebar-backdrop" data-platform-close></div>
      <div class="platform-sidebar-panel" role="dialog" aria-modal="true" aria-label="التنقل في المنصة">
        <button type="button" class="platform-sidebar-close" data-platform-close aria-label="إغلاق"><i class="fas fa-times"></i></button>
        <div class="platform-sidebar-brand">
          <strong>ميزان</strong>
          <span>حيث يُقاس الفهم القانوني بدقة.</span>
        </div>

        <div class="platform-sidebar-heading">الرئيسية</div>
        <nav class="platform-sidebar-nav" aria-label="التنقل الرئيسي">
          <button class="platform-sidebar-item" data-platform-action="home"><i class="fas fa-house"></i><span>الرئيسية</span></button>
        </nav>

        <div class="platform-sidebar-heading">الاختبارات</div>
        <div class="platform-sidebar-nav">
          <button class="platform-sidebar-item" data-platform-action="books"><i class="fas fa-book-open"></i><span>اختبارات كتب القانون</span></button>
          <div class="platform-sidebar-sub">
            <button class="platform-sidebar-item" data-platform-action="random"><i class="fas fa-dice"></i><span>الاختبار العشوائي</span></button>
            <button class="platform-sidebar-item" data-platform-action="judicial"><i class="fas fa-landmark"></i><span>اختبارات المعهد القضائي</span></button>
          </div>
        </div>

        <div class="platform-sidebar-heading">المكتبة والخدمات القانونية</div>
        <div class="platform-sidebar-nav">
          <button class="platform-sidebar-item" data-platform-action="laws"><i class="fas fa-scale-balanced"></i><span>القوانين العراقية</span></button>
          <button class="platform-sidebar-item" data-platform-action="procedures"><i class="fas fa-file-signature"></i><span>إجراءات الدعاوى</span></button>
          <button class="platform-sidebar-item" data-platform-action="petitions"><i class="fas fa-file-lines"></i><span>عرائض وطلبات</span></button>
          <button class="platform-sidebar-item" data-platform-action="lawyers"><i class="fas fa-user-tie"></i><span>دليل المحامين</span></button>
          <button class="platform-sidebar-item" data-platform-action="mizan-pulpit"><i class="fas fa-feather-pointed"></i><span>منبر ميزان</span></button>
        </div>

        <div class="platform-sidebar-heading">الطالب</div>
        <div class="platform-sidebar-nav">
          <button class="platform-sidebar-item" data-platform-action="dashboard"><i class="fas fa-chart-line"></i><span>لوحة الاختبارات</span></button>
          <button class="platform-sidebar-item" data-platform-action="profile"><i class="fas fa-user"></i><span>الملف الشخصي</span></button>
          
        </div>

        <div class="platform-sidebar-account" id="platform-sidebar-account">
          <div class="platform-sidebar-account-user">
            <div class="platform-sidebar-account-avatar" id="platform-sidebar-avatar">👤</div>
            <div>
              <strong id="platform-sidebar-name">زائر</strong>
              <span id="platform-sidebar-email">سجّل الدخول للوصول إلى حسابك</span>
            </div>
          </div>
          <button type="button" class="platform-sidebar-account-action" id="platform-sidebar-login"><i class="fas fa-right-to-bracket"></i><span>تسجيل الدخول</span></button>
          <button type="button" class="platform-sidebar-account-action" id="platform-sidebar-logout" hidden><i class="fas fa-right-from-bracket"></i><span>تسجيل الخروج</span></button>
        </div>

        <div class="platform-sidebar-divider"></div>
        <div class="platform-sidebar-nav">
          <button class="platform-sidebar-item" data-platform-action="about"><i class="fas fa-circle-info"></i><span>عن المنصة</span></button>
          <button class="platform-sidebar-item" data-platform-action="contact"><i class="fas fa-headset"></i><span>تواصل معنا</span></button>
          <button class="platform-sidebar-item" data-platform-action="help"><i class="fas fa-circle-question"></i><span>المساعدة</span></button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.querySelectorAll('[data-platform-close]').forEach(el=>el.addEventListener('click',close));
    wrap.querySelectorAll('[data-platform-action]').forEach(btn=>btn.addEventListener('click',()=>run(btn.dataset.platformAction)));
    const loginBtn=wrap.querySelector('#platform-sidebar-login');
    const logoutBtn=wrap.querySelector('#platform-sidebar-logout');
    if(loginBtn) loginBtn.addEventListener('click',()=>{ close(); window.publicAuth?.openLogin(); });
    if(logoutBtn) logoutBtn.addEventListener('click',()=>{
      close();
      window.publicAuth?.signOut();
    });
    updateAccountState();
  }


  function ensureMobileNav(){
    if(document.getElementById('platform-mobile-nav')) return;
    const nav=document.createElement('nav');
    nav.id='platform-mobile-nav';
    nav.className='platform-mobile-nav';
    nav.setAttribute('aria-label','التنقل السريع');
    nav.innerHTML=`
      <button type="button" class="platform-mobile-nav-item" data-mobile-action="home" aria-label="الصفحة الرئيسية">
        <i class="fas fa-house" aria-hidden="true"></i><span>الرئيسية</span>
      </button>
      <button type="button" class="platform-mobile-nav-item" data-mobile-action="books" aria-label="اختبارات الكتب">
        <i class="fas fa-book-open" aria-hidden="true"></i><span>الكتب</span>
      </button>
      <button type="button" class="platform-mobile-nav-item" data-mobile-action="search" aria-label="البحث">
        <i class="fas fa-magnifying-glass" aria-hidden="true"></i><span>بحث</span>
      </button>
      <button type="button" class="platform-mobile-nav-item" data-mobile-action="profile" aria-label="الملف الشخصي">
        <i class="fas fa-user" aria-hidden="true"></i><span>حسابي</span>
      </button>`;
    document.body.appendChild(nav);
    document.body.classList.add('platform-mobile-nav-enabled');

    nav.querySelectorAll('[data-mobile-action]').forEach(btn=>btn.addEventListener('click',()=>{
      const action=btn.dataset.mobileAction;
      if(action==='search'){
        window.app?.navigateTo('home');
        close();
        const input=document.getElementById('search-input');
        if(input){
          input.focus({preventScroll:true});
          input.scrollIntoView({behavior:'smooth',block:'center'});
        }
        return;
      }
      run(action);
    }));

    const sync=()=>{
      const active=document.querySelector('.view-section.active');
      let current=active ? null : 'home';
      if(active && active.id==='student-dashboard-section') current='profile';
      if(active && ['books-section','chapters-section','exam-section','results-section','review-section','custom-exam-setup-section'].includes(active.id)) current='books';
      nav.querySelectorAll('[data-mobile-action]').forEach(btn=>{
        const selected=btn.dataset.mobileAction===current;
        btn.classList.toggle('is-active',selected);
        if(selected) btn.setAttribute('aria-current','page');
        else btn.removeAttribute('aria-current');
      });
    };
    const main=document.querySelector('main')||document.body;
    const viewObserver=new MutationObserver(sync);
    const observeViews=root=>{
      if(!root || root.nodeType!==1) return;
      if(root.matches('.view-section')) viewObserver.observe(root,{attributes:true,attributeFilter:['class']});
      root.querySelectorAll('.view-section').forEach(section=>viewObserver.observe(section,{attributes:true,attributeFilter:['class']}));
    };
    observeViews(main);
    const structureObserver=new MutationObserver(records=>{
      records.forEach(record=>record.addedNodes.forEach(observeViews));
      sync();
    });
    structureObserver.observe(main,{childList:true});
    sync();
  }

  function placeAdminTab(){
    const adminTab=document.getElementById('firebase-admin-tab');
    const header=document.querySelector('.mizan-header');
    if(adminTab && header && adminTab.parentElement!==header){
      header.appendChild(adminTab);
    }
  }

  function updateAdminEntry(){
    placeAdminTab();
    const el=document.getElementById('firebase-admin-tab');
    if(!el) return;
    const admin=window.firebaseAdminPanel && window.firebaseAdminPanel.isAdmin === true;
    el.hidden=!admin;
  }

  function updateAccountState(){
    updateAdminEntry();
    const wrap=document.getElementById('platform-sidebar');
    if(!wrap) return;
    const user=window.publicAuth && window.publicAuth.user;
    const avatar=wrap.querySelector('#platform-sidebar-avatar');
    const name=wrap.querySelector('#platform-sidebar-name');
    const email=wrap.querySelector('#platform-sidebar-email');
    const login=wrap.querySelector('#platform-sidebar-login');
    const logout=wrap.querySelector('#platform-sidebar-logout');
    if(avatar) avatar.textContent=user ? ((user.displayName||user.email||'ط').trim().charAt(0).toUpperCase()||'ط') : '👤';
    if(name) name.textContent=user ? (user.displayName||user.email||'طالب المنصة') : 'زائر';
    if(email) email.textContent=user ? (user.email||'حساب الطالب') : 'سجّل الدخول للوصول إلى حسابك';
    if(login) login.hidden=Boolean(user);
    if(logout) logout.hidden=!user;
  }

  function open(){ ensure(); updateAccountState(); const el=document.getElementById('platform-sidebar'); el.classList.add('is-open'); el.setAttribute('aria-hidden','false'); document.body.classList.add('platform-sidebar-open'); }
  function close(){ const el=document.getElementById('platform-sidebar'); if(!el)return; el.classList.remove('is-open'); el.setAttribute('aria-hidden','true'); document.body.classList.remove('platform-sidebar-open'); }

  function install(){
    ensure();
    ensureMobileNav();
    const header=document.querySelector('header');
    if(!header)return;
    if(!document.getElementById('platform-menu-trigger')){
      const b=document.createElement('button');
      b.id='platform-menu-trigger';
      b.className='platform-menu-trigger';
      b.type='button';
      b.title='قائمة المنصة';
      b.setAttribute('aria-label','فتح قائمة المنصة');
      b.innerHTML='<i class="fas fa-bars-staggered" aria-hidden="true"></i>';
      b.addEventListener('click',open);
      header.appendChild(b);
    }
    const menu=document.getElementById('platform-menu-trigger');
    const theme=document.getElementById('theme-toggle');
    if(menu && menu.parentElement!==header) header.appendChild(menu);
    if(theme && theme.parentElement!==header) header.appendChild(theme);
    placeAdminTab();
    updateAdminEntry();
  }

  window.addEventListener('public-auth-state-changed',updateAccountState);
  window.addEventListener('firebase-admin-state-changed',updateAdminEntry);
  window.platformNavigation={open,close,run,ensure,updateAccountState,updateAdminEntry};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();