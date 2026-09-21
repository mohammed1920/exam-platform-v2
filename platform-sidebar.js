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
    dashboard:{label:'لوحة الاختبارات',icon:'fa-chart-line'},
    leaderboard:{label:'المتصدرون',icon:'fa-trophy'},
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
    if(action==='leaderboard'){
      if(!window.publicAuth || !window.publicAuth.user){ window.publicAuth && window.publicAuth.openLogin(); return; }
      if(window.app) window.app.navigateTo('student-dashboard',{dashboardTarget:'leaderboard'});
      if(window.studentLeaderboard) window.studentLeaderboard.render();
      return;
    }
    if(action==='contact'){
      document.querySelector('footer')?.scrollIntoView({behavior:'smooth',block:'start'});
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
          <strong>⚖️ المنصة القانونية العراقية</strong>
          <span>تنقل منظم بين الاختبارات والمكتبة والأقسام القانونية.</span>
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
        </div>

        <div class="platform-sidebar-heading">الطالب</div>
        <div class="platform-sidebar-nav">
          <button class="platform-sidebar-item" data-platform-action="dashboard"><i class="fas fa-chart-line"></i><span>لوحة الاختبارات</span></button>
          <button class="platform-sidebar-item" data-platform-action="leaderboard"><i class="fas fa-trophy"></i><span>المتصدرون</span></button>
        </div>

        <div class="platform-sidebar-divider"></div>
        <div class="platform-sidebar-nav">
          <button class="platform-sidebar-item" data-platform-action="about"><i class="fas fa-circle-info"></i><span>عن المنصة</span></button>
          <button class="platform-sidebar-item" data-platform-action="contact"><i class="fas fa-headset"></i><span>تواصل معنا</span></button>
          <button class="platform-sidebar-item" data-platform-action="help"><i class="fas fa-circle-question"></i><span>المساعدة</span></button>
        </div>
        <div class="platform-sidebar-note">
          <strong>تنظيم المنصة</strong>
          نتائج الطالب وسجله وتقدمه والإجابات الخاطئة والمفضلة كلها داخل لوحة الاختبارات، حتى تبقى القائمة الرئيسية مختصرة وواضحة.
        </div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.querySelectorAll('[data-platform-close]').forEach(el=>el.addEventListener('click',close));
    wrap.querySelectorAll('[data-platform-action]').forEach(btn=>btn.addEventListener('click',()=>run(btn.dataset.platformAction)));
  }

  function open(){ ensure(); const el=document.getElementById('platform-sidebar'); el.classList.add('is-open'); el.setAttribute('aria-hidden','false'); document.body.classList.add('platform-sidebar-open'); }
  function close(){ const el=document.getElementById('platform-sidebar'); if(!el)return; el.classList.remove('is-open'); el.setAttribute('aria-hidden','true'); document.body.classList.remove('platform-sidebar-open'); }

  function install(){
    ensure();
    const header=document.querySelector('header');
    if(!header)return;
    if(!document.getElementById('platform-menu-trigger')){
      const b=document.createElement('button');
      b.id='platform-menu-trigger';
      b.className='platform-menu-trigger';
      b.type='button';
      b.title='قائمة المنصة';
      b.setAttribute('aria-label','فتح قائمة المنصة');
      b.innerHTML='<i class="fas fa-bars"></i>';
      b.addEventListener('click',open);
      header.appendChild(b);
    }
  }

  window.platformNavigation={open,close,run,ensure};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install); else install();
})();
