/* Firebase admin tab for the student SPA. Visible only to users listed as admins/{uid}. */
(function () {
  'use strict';
  let isAdmin=false,panelOpen=false,mainViewState=[],els={};
  let lawyerApplications=[],lawyerProfiles=[];
  function publishAdminState(){ window.firebaseAdminPanel={open:openPanel,isAdmin}; window.dispatchEvent(new CustomEvent('firebase-admin-state-changed',{detail:{isAdmin}})); }
  const esc=v=>String(v??'—').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  function dateValue(v){if(!v)return'—';const d=v&&typeof v.toDate==='function'?v.toDate():new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('ar-IQ',{year:'numeric',month:'short',day:'numeric'});}
  function timeValue(v){const d=v&&typeof v.toDate==='function'?v.toDate():new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleTimeString('ar-IQ',{hour:'2-digit',minute:'2-digit'});}
  function buildUI(){
    const existingTab=document.getElementById('firebase-admin-tab');
    const existingSection=document.getElementById('firebase-admin-section');
    if(existingTab&&existingSection){
      els.tab=existingTab;
      els.section=existingSection;
      return;
    }
    if(!document.querySelector('link[data-lawyer-admin-css]')){const css=document.createElement('link');css.rel='stylesheet';css.href='assets/features/lawyers/css/lawyer-admin.css?v=1.32';css.dataset.lawyerAdminCss='1';document.head.appendChild(css);}
    const header=document.querySelector('header');if(!header)return;
    const tab=existingTab||document.createElement('button');
    if(!existingTab){
      tab.id='firebase-admin-tab';tab.type='button';tab.className='firebase-admin-tab';
      tab.innerHTML='<i class="fas fa-crown" aria-hidden="true"></i><span>الإدارة</span>';
      tab.title='لوحة إدارة Firebase';tab.setAttribute('aria-label','لوحة إدارة Firebase');
      tab.hidden=true;tab.addEventListener('click',openPanel);header.appendChild(tab);
    }
    const main=document.querySelector('main.container');if(!main)return;const section=document.createElement('section');section.id='firebase-admin-section';section.className='view-section firebase-admin-view';section.hidden=true;
    section.innerHTML=`<div class="firebase-admin-shell">
<aside class="firebase-admin-sidebar" aria-label="قائمة الإدارة">
<div class="firebase-admin-sidebar-brand"><span class="firebase-admin-brand-mark"><i class="fas fa-crown" aria-hidden="true"></i></span><div><strong>ميزان</strong><small>مركز الإدارة التنفيذية</small></div></div>
<nav id="fa-admin-navigation" class="firebase-admin-navigation">
<button type="button" class="firebase-admin-nav-item is-active" data-admin-home aria-current="page"><i class="fas fa-chart-pie" aria-hidden="true"></i><span>لوحة المعلومات</span></button>
<span class="firebase-admin-nav-heading">إدارة المستخدمين</span>
<button type="button" class="firebase-admin-nav-item" data-admin-view="students"><i class="fas fa-users" aria-hidden="true"></i><span>الطلاب المسجلون</span></button>
<span class="firebase-admin-nav-heading">إدارة الخدمات</span>
<button type="button" class="firebase-admin-nav-item" data-admin-view="lawyers"><i class="fas fa-user-tie" aria-hidden="true"></i><span>دليل المحامين</span><span class="firebase-admin-nav-count" id="fa-nav-lawyers-count" hidden>0</span></button>
<button type="button" class="firebase-admin-nav-item" data-admin-view="procedures"><i class="fas fa-file-signature" aria-hidden="true"></i><span>إجراءات الدعاوى</span><span class="firebase-admin-nav-count" id="fa-nav-procedures-count" hidden>0</span></button>
<button type="button" class="firebase-admin-nav-item" data-admin-view="petitions"><i class="fas fa-file-alt" aria-hidden="true"></i><span>العرائض والطلبات</span><span class="firebase-admin-nav-count" id="fa-nav-petitions-count" hidden>0</span></button>
</nav>
<button id="firebase-admin-back" class="firebase-admin-exit" type="button"><i class="fas fa-arrow-right-from-bracket" aria-hidden="true"></i><span>العودة إلى المنصة</span></button>
</aside>
<button id="firebase-admin-sidebar-backdrop" class="firebase-admin-sidebar-backdrop" type="button" aria-label="إغلاق قائمة الإدارة" tabindex="-1"></button>
<div class="firebase-admin-workspace">
<header class="firebase-admin-topbar">
<button id="firebase-admin-nav-toggle" class="firebase-admin-nav-toggle" type="button" aria-label="فتح قائمة الإدارة" aria-expanded="false"><i class="fas fa-bars" aria-hidden="true"></i></button>
<div class="firebase-admin-head"><div><div class="firebase-admin-kicker">MIZAN EXECUTIVE</div><h2>مركز الإدارة التنفيذية</h2><p id="firebase-admin-welcome">تم التحقق من صلاحية الإدارة.</p></div><button id="firebase-admin-refresh" class="firebase-admin-action" type="button"><i class="fas fa-rotate" aria-hidden="true"></i><span>تحديث البيانات</span></button></div>
</header>
<div id="firebase-admin-status" class="firebase-admin-status" role="status" aria-live="polite" hidden></div>
<div id="fa-admin-home" class="firebase-admin-home">
<div class="firebase-admin-overview-intro"><div><span class="firebase-admin-overview-eyebrow">نظرة عامة</span><h2>مرحباً بك في إدارة ميزان</h2><p>تابع المستخدمين والخدمات والطلبات من مكان واحد.</p></div><span class="firebase-admin-overview-emblem"><i class="fas fa-scale-balanced" aria-hidden="true"></i></span></div>
<div class="firebase-admin-overview-stats">
<article class="firebase-admin-overview-stat"><span class="firebase-admin-stat-icon"><i class="fas fa-users" aria-hidden="true"></i></span><div><strong id="fa-dashboard-students-count">—</strong><span>الطلاب المسجلون</span></div></article>
<article class="firebase-admin-overview-stat"><span class="firebase-admin-stat-icon"><i class="fas fa-user-clock" aria-hidden="true"></i></span><div><strong id="fa-dashboard-lawyer-pending">—</strong><span>طلبات المحامين</span></div></article>
<article class="firebase-admin-overview-stat"><span class="firebase-admin-stat-icon"><i class="fas fa-user-check" aria-hidden="true"></i></span><div><strong id="fa-dashboard-lawyer-published">—</strong><span>ملفات المحامين المنشورة</span></div></article>
<article class="firebase-admin-overview-stat"><span class="firebase-admin-stat-icon"><i class="fas fa-pen-to-square" aria-hidden="true"></i></span><div><strong id="fa-dashboard-lawyer-edits">—</strong><span>طلبات تعديل المحامين</span></div></article>
</div>
<section class="firebase-admin-overview-section"><div class="firebase-admin-overview-section-head"><div><h3>الوصول السريع</h3><p>انتقل مباشرة إلى الوحدة التي تريد إدارتها.</p></div></div>
<div class="firebase-admin-shortcuts">
<button type="button" class="firebase-admin-shortcut" data-admin-view="students"><span><i class="fas fa-users" aria-hidden="true"></i></span><strong>الطلاب المسجلون</strong><small>عرض حسابات الطلاب</small><i class="fas fa-arrow-left firebase-admin-shortcut-arrow" aria-hidden="true"></i></button>
<button type="button" class="firebase-admin-shortcut" data-admin-view="lawyers"><span><i class="fas fa-user-tie" aria-hidden="true"></i></span><strong>دليل المحامين <span class="firebase-admin-shortcut-count" data-admin-count="lawyers" hidden></span></strong><small>الطلبات والملفات والتعديلات</small><i class="fas fa-arrow-left firebase-admin-shortcut-arrow" aria-hidden="true"></i></button>
<button type="button" class="firebase-admin-shortcut" data-admin-view="procedures"><span><i class="fas fa-file-signature" aria-hidden="true"></i></span><strong>إجراءات الدعاوى <span class="firebase-admin-shortcut-count" data-admin-count="procedures" hidden></span></strong><small>طلبات الوصول والمحتوى</small><i class="fas fa-arrow-left firebase-admin-shortcut-arrow" aria-hidden="true"></i></button>
<button type="button" class="firebase-admin-shortcut" data-admin-view="petitions"><span><i class="fas fa-file-alt" aria-hidden="true"></i></span><strong>العرائض والطلبات <span class="firebase-admin-shortcut-count" data-admin-count="petitions" hidden></span></strong><small>الصلاحيات والنماذج</small><i class="fas fa-arrow-left firebase-admin-shortcut-arrow" aria-hidden="true"></i></button>
<button type="button" class="firebase-admin-shortcut" data-mizan-open><span><i class="fas fa-feather-pointed" aria-hidden="true"></i></span><strong>منبر ميزان <span class="firebase-admin-shortcut-count" data-admin-count="forum" hidden></span></strong><small>المساهمون والمقالات والنشر</small><i class="fas fa-arrow-left firebase-admin-shortcut-arrow" aria-hidden="true"></i></button>
</div></section>
<div class="firebase-admin-overview-footnote"><i class="fas fa-shield-halved" aria-hidden="true"></i><span>تُعرض المؤشرات من البيانات التي تحملها وحدات الإدارة الحالية دون إضافة استعلامات مستقلة.</span></div>
</div>
<div class="firebase-admin-subviews"><section id="fa-admin-view-students" class="firebase-admin-subview"><button type="button" class="firebase-admin-subview-back" data-admin-home>← العودة لأقسام الإدارة</button><div class="firebase-admin-stats"><div class="firebase-admin-stat"><span>إجمالي الطلاب</span><strong id="fa-students-count">—</strong></div></div><div class="firebase-admin-card"><div class="firebase-admin-card-head"><h3>👥 الطلاب المسجلون</h3><span id="fa-students-updated"></span></div><div id="fa-students-body" class="firebase-admin-record-list"><p class="firebase-admin-list-state">جارٍ التحميل...</p></div></div></section><section id="fa-admin-view-lawyers" class="firebase-admin-subview"><button type="button" class="firebase-admin-subview-back" data-admin-home>← العودة لأقسام الإدارة</button><div class="firebase-admin-card lawyer-admin-card">
      <div class="firebase-admin-card-head"><h3>👨‍⚖️ إدارة دليل المحامين</h3><span>الطلبات والملفات المنشورة</span></div>
      <div class="lawyer-admin-tabs">
        <button type="button" class="lawyer-admin-tab active" data-lawyer-view="pending">الطلبات <span id="fa-lawyers-pending-count">0</span></button>
        <button type="button" class="lawyer-admin-tab" data-lawyer-view="published">المحامون المنشورون <span id="fa-lawyers-published-count">0</span></button>
        <button type="button" class="lawyer-admin-tab" data-lawyer-view="edits">طلبات التعديل <span id="fa-lawyer-edit-requests-count">0</span></button>
      </div>
      <div id="fa-lawyers-pending-panel">
        <div class="firebase-admin-table-wrap"><table class="lawyer-admin-table"><thead><tr><th>المحامي</th><th>الموقع</th><th>الاختصاص</th><th>التقديم</th><th>الهوية</th><th>الإجراء</th></tr></thead><div id="fa-lawyers-body" class="firebase-admin-record-list"><p class="firebase-admin-list-state">جارٍ التحميل...</p></div></table></div>
      </div>
      <div id="fa-lawyers-edit-requests-panel" hidden>
        <div class="firebase-admin-table-wrap"><table class="lawyer-admin-table"><thead><tr><th>المحامي</th><th>التعديلات</th><th>التاريخ</th><th>الإجراء</th></tr></thead><div id="fa-lawyer-edit-requests-body" class="firebase-admin-record-list"><p class="firebase-admin-list-state">جارٍ التحميل...</p></div></table></div>
      </div>
      <div id="fa-lawyers-published-panel" hidden>
        <div class="firebase-admin-table-wrap"><table class="lawyer-admin-table"><thead><tr><th>المحامي</th><th>الموقع</th><th>الاختصاص</th><th>الحالة</th><th>الإجراء</th></tr></thead><div id="fa-lawyers-published-body" class="firebase-admin-record-list"><p class="firebase-admin-list-state">جارٍ التحميل...</p></div></table></div>
      </div>
      <div id="fa-lawyer-edit" class="lawyer-admin-edit" hidden>
        <div class="firebase-admin-card-head"><h3 id="fa-lawyer-edit-title">تعديل بيانات المحامي</h3><button id="fa-lawyer-edit-close" type="button">×</button></div>
        <form id="fa-lawyer-edit-form">
          <input type="hidden" name="id">
          <div class="lawyer-admin-form-grid">
            <label>الاسم<input name="name" required></label><label>المحافظة<input name="governorate" required></label><label>القضاء/المنطقة<input name="district"></label><label>الهاتف<input name="phone"></label><label>المكتب<input name="office"></label><label>العنوان<input name="address"></label><label>الاختصاصات<input name="specializations"></label><label>ساعات العمل<input name="workingHours"></label><label class="full">الوصف<textarea name="description"></textarea></label><label class="full">رابط شعار المحامي<input name="logoUrl" placeholder="https://.../logo.png"></label>
          </div>
          <div class="lawyer-admin-form-actions"><button type="submit" class="approve">حفظ</button><button id="fa-lawyer-edit-cancel" type="button">إلغاء</button></div>
        </form>
      </div>
      <p class="lawyer-admin-note"><i class="fas fa-shield-halved"></i> هوية النقابة لا تُخزّن داخل المنصة. يرسلها المتقدم مباشرة للأدمن عبر واتساب أو تلغرام، ثم تتم مطابقة الهوية مع الطلب قبل النشر.</p>
    </section>
    <section id="fa-admin-view-procedures" class="firebase-admin-subview">
      <button type="button" class="firebase-admin-subview-back" data-admin-home>← العودة لأقسام الإدارة</button>
      <div class="firebase-admin-card lawyer-admin-card">
        <div class="firebase-admin-card-head"><h3>🔐 طلبات الوصول إلى إجراءات الدعاوى <span class="firebase-admin-inline-count" id="fa-procedures-access-count" hidden>0</span></h3><span>الموافقة اليدوية وإدارة الصلاحيات</span></div>
        <p class="lawyer-admin-note">لا يحصل المستخدم على الوصول إلا بعد منح الصلاحية. سحب الصلاحية يمنع قراءة محتوى الإجراءات المحمي في Firestore.</p>
        <div id="fa-procedures-requests-body" class="firebase-admin-record-list"><p class="firebase-admin-list-state">اختر هذا القسم لتحميل الطلبات.</p></div>
      </div>
      <div class="firebase-admin-card lawyer-admin-card procedures-admin-management">
        <div class="firebase-admin-card-head"><h3>إدارة محتوى الإجراءات</h3><span>التفاصيل والفهرس في Firebase</span></div>
        <form id="fa-procedure-form" class="procedures-admin-form">
          <input type="hidden" name="id">
          <label>عنوان الإجراء *<input name="title" required maxlength="180"></label>
          <label>تصنيف الدعوى *
            <select name="category" required>
              <option value="">اختر تصنيف الدعوى</option>
              <option value="civil">الدعاوى المدنية</option>
              <option value="criminal">الدعاوى الجزائية</option>
              <option value="administrative">الدعاوى الإدارية</option>
              <option value="personal">دعاوى الأحوال الشخصية</option>
            </select>
          </label>
          <label>نبذة عن الإجراء<textarea name="summary" rows="2" maxlength="2000"></textarea></label>
          <label>الشروط والاختصاص<textarea name="requirements" rows="3"></textarea></label>
          <label>المستندات المطلوبة<textarea name="documents" rows="3"></textarea></label>
          <label>خطوات الإجراء<textarea name="steps" rows="5"></textarea></label>
          <label>السند القانوني<textarea name="legalBasis" rows="3"></textarea></label>
          <label>الرسوم<input name="fees" maxlength="500"></label>
          <label>المدد القانونية أو المتوقعة<input name="duration" maxlength="500"></label>
          <label><input type="checkbox" name="published" checked> نشر الإجراء وإظهاره في الفهرس</label>
          <div class="lawyer-admin-actions"><button class="approve" type="submit">حفظ الإجراء</button><button type="button" id="fa-procedure-reset">جديد / إلغاء التعديل</button></div>
          <p class="lawyer-admin-note">تُحدّث قائمة العناوين المنشورة تلقائياً في Firebase عند حفظ الإجراء أو نشره أو إخفائه أو حذفه، ولا تُحمّل تفاصيل الإجراءات إلا عند فتحها.</p>
        </form>
        <div id="fa-procedures-content-body" class="firebase-admin-record-list"><p class="firebase-admin-list-state">اختر هذا القسم لتحميل الإجراءات.</p></div>
      </div>
    </section>
    <section id="fa-admin-view-petitions" class="firebase-admin-subview">
      <button type="button" class="firebase-admin-subview-back" data-admin-home>← العودة لأقسام الإدارة</button>
      <div class="firebase-admin-card lawyer-admin-card">
        <div class="firebase-admin-card-head"><h3>🔐 طلبات الوصول إلى العرائض <span class="firebase-admin-inline-count" id="fa-petitions-access-count" hidden>0</span></h3><span>موافقة دائمة قابلة للسحب</span></div>
        <p class="lawyer-admin-note">لا يستطيع المستخدم قراءة النصوص إلا بعد موافقة الإدارة. تبقى الصلاحية سارية حتى سحبها.</p>
        <div id="fa-petitions-requests-body" class="firebase-admin-record-list"><p class="firebase-admin-list-state">اختر هذا القسم لتحميل الطلبات.</p></div>
      </div>
      <div class="firebase-admin-card lawyer-admin-card procedures-admin-management">
        <div class="firebase-admin-card-head"><h3>إدارة نماذج العرائض</h3><span>تخزين النصوص في Firestore</span></div>
        <form id="fa-petition-form" class="procedures-admin-form">
          <input type="hidden" name="id">
          <label>عنوان العريضة *<input name="title" required maxlength="180"></label>
          <label>التصنيف *<select name="category" required><option value="">اختر التصنيف</option><option value="family">عرائض أحوال شخصية</option><option value="civil">عرائض البداءة (الدعاوى المدنية)</option><option value="criminal">عرائض جزائية وتحقيق</option><option value="administrative">عرائض إدارية</option></select></label>
          <label>وصف مختصر<input name="description" maxlength="1000"></label>
          <label>الأيقونة (اختياري)<input name="icon" maxlength="100" value="fas fa-file-signature"></label>
          <label>نص العريضة *<textarea name="body" rows="12" required maxlength="50000"></textarea></label>
          <label><input type="checkbox" name="published" checked> نشر العريضة وإظهار عنوانها للمصرّح لهم</label>
          <div class="lawyer-admin-actions"><button class="approve" type="submit">حفظ العريضة</button><button type="button" id="fa-petition-reset">جديد / إلغاء التعديل</button></div>
          <p class="lawyer-admin-note">النص الكامل في مجموعة محمية، والفهرس العام يعرض البيانات التعريفية فقط.</p>
        </form>
        <div id="fa-petitions-content-body" class="firebase-admin-record-list"><p class="firebase-admin-list-state">اختر هذا القسم لتحميل النماذج.</p></div>
      </div>
    </section></div>
    </div></div>`
    const footer=document.querySelector('footer');if(footer&&footer.parentNode)footer.parentNode.insertBefore(section,footer);else document.body.appendChild(section);
    els={tab,section,status:section.querySelector('#firebase-admin-status'),welcome:section.querySelector('#firebase-admin-welcome'),refresh:section.querySelector('#firebase-admin-refresh'),back:section.querySelector('#firebase-admin-back'),studentsCount:section.querySelector('#fa-students-count'),studentsUpdated:section.querySelector('#fa-students-updated'),studentsBody:section.querySelector('#fa-students-body'),proceduresRequestsBody:section.querySelector('#fa-procedures-requests-body'),procedureForm:section.querySelector('#fa-procedure-form'),proceduresContentBody:section.querySelector('#fa-procedures-content-body'),procedureReset:section.querySelector('#fa-procedure-reset'),petitionsRequestsBody:section.querySelector('#fa-petitions-requests-body'),petitionForm:section.querySelector('#fa-petition-form'),petitionsContentBody:section.querySelector('#fa-petitions-content-body'),petitionReset:section.querySelector('#fa-petition-reset'),lawyersBody:section.querySelector('#fa-lawyers-body'),lawyersPublishedBody:section.querySelector('#fa-lawyers-published-body'),lawyersPendingCount:section.querySelector('#fa-lawyers-pending-count'),lawyersPublishedCount:section.querySelector('#fa-lawyers-published-count'),lawyerEditRequestsBody:section.querySelector('#fa-lawyer-edit-requests-body'),lawyerEditRequestsCount:section.querySelector('#fa-lawyer-edit-requests-count'),lawyerEdit:section.querySelector('#fa-lawyer-edit'),lawyerEditForm:section.querySelector('#fa-lawyer-edit-form'),lawyerEditTitle:section.querySelector('#fa-lawyer-edit-title'),lawyerEditClose:section.querySelector('#fa-lawyer-edit-close'),lawyerEditCancel:section.querySelector('#fa-lawyer-edit-cancel'),dashboardStudentsCount:section.querySelector('#fa-dashboard-students-count'),dashboardLawyerPending:section.querySelector('#fa-dashboard-lawyer-pending'),dashboardLawyerPublished:section.querySelector('#fa-dashboard-lawyer-published'),dashboardLawyerEdits:section.querySelector('#fa-dashboard-lawyer-edits'),navLawyersCount:section.querySelector('#fa-nav-lawyers-count'),navProceduresCount:section.querySelector('#fa-nav-procedures-count'),navPetitionsCount:section.querySelector('#fa-nav-petitions-count'),proceduresAccessCount:section.querySelector('#fa-procedures-access-count'),petitionsAccessCount:section.querySelector('#fa-petitions-access-count'),navToggle:section.querySelector('#firebase-admin-nav-toggle'),sidebarBackdrop:section.querySelector('#firebase-admin-sidebar-backdrop')};

  function setupAdminWorkspaceTabs(){
    const definitions=[
      {view:'petitions',labels:[['access','طلبات الوصول'],['create','إضافة عريضة'],['library','نماذج العرائض']],titles:['طلبات الوصول','إنشاء عريضة جديدة','مكتبة نماذج العرائض']},
      {view:'procedures',labels:[['access','طلبات الوصول'],['create','إضافة إجراء'],['library','مكتبة الإجراءات']],titles:['طلبات الوصول','إضافة إجراء جديد','مكتبة الإجراءات']},
      {view:'procedures',labels:[['access','طلبات الوصول'],['create','إضافة إجراء'],['library','مكتبة الإجراءات']],titles:['طلبات الوصول','إضافة إجراء جديد','مكتبة الإجراءات']}
    ];
    definitions.forEach(def=>{
      const view=els.section.querySelector('#fa-admin-view-'+def.view);
      if(!view||view.querySelector('.firebase-admin-inner-tabs'))return;
      const cards=[...view.querySelectorAll(':scope > .firebase-admin-card')];
      if(cards.length<2)return;
      const accessCard=cards[0],managementCard=cards[1];
      const form=managementCard.querySelector('form');
      const records=managementCard.querySelector('.firebase-admin-record-list, .firebase-admin-table-wrap');
      if(!form||!records)return;
      const heading=managementCard.querySelector('.firebase-admin-card-head');
      const tabs=document.createElement('div');
      tabs.className='firebase-admin-inner-tabs';
      tabs.setAttribute('role','tablist');
      tabs.setAttribute('aria-label',def.view==='petitions'?'إدارة العرائض':'إدارة إجراءات الدعاوى');
      const panels=document.createElement('div');
      panels.className='firebase-admin-inner-panels';
      const accessPanel=document.createElement('section');
      accessPanel.className='firebase-admin-inner-panel';
      accessPanel.dataset.adminPanel='access';
      accessPanel.id='fa-'+def.view+'-panel-access';
      accessPanel.setAttribute('role','tabpanel');
      accessPanel.append(accessCard);
      const createPanel=document.createElement('section');
      createPanel.className='firebase-admin-inner-panel';
      createPanel.dataset.adminPanel='create';
      createPanel.id='fa-'+def.view+'-panel-create';
      createPanel.setAttribute('role','tabpanel');
      const createCard=document.createElement('div');
      createCard.className='firebase-admin-card lawyer-admin-card procedures-admin-management';
      const createHeading=heading?heading.cloneNode(true):document.createElement('div');
      if(createHeading.querySelector('h3'))createHeading.querySelector('h3').textContent=def.titles[1];
      createCard.append(createHeading,form);
      createPanel.append(createCard);
      const libraryPanel=document.createElement('section');
      libraryPanel.className='firebase-admin-inner-panel';
      libraryPanel.dataset.adminPanel='library';
      libraryPanel.id='fa-'+def.view+'-panel-library';
      libraryPanel.setAttribute('role','tabpanel');
      const libraryCard=document.createElement('div');
      libraryCard.className='firebase-admin-card lawyer-admin-card';
      const libraryHeading=heading?heading.cloneNode(true):document.createElement('div');
      if(libraryHeading.querySelector('h3'))libraryHeading.querySelector('h3').textContent=def.titles[2];
      const description=libraryHeading.querySelector('span');
      if(description)description.textContent='إدارة المحتوى المنشور والمسودات';
      libraryCard.append(libraryHeading,records);
      libraryPanel.append(libraryCard);
      panels.append(accessPanel,createPanel,libraryPanel);
      def.labels.forEach(([key,label],index)=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='firebase-admin-inner-tab'+(index===0?' active':'');
        button.dataset.adminTab=key;
        button.id='fa-'+def.view+'-tab-'+key;
        button.setAttribute('role','tab');
        button.setAttribute('aria-controls','fa-'+def.view+'-panel-'+key);
        button.setAttribute('aria-selected',index===0?'true':'false');
        button.tabIndex=index===0?0:-1;
        button.textContent=label;
        tabs.append(button);
      });
      accessPanel.hidden=false;
      createPanel.hidden=true;
      libraryPanel.hidden=true;
      managementCard.remove();
      const backButton=view.querySelector('.firebase-admin-subview-back');
      if(backButton){
        view.insertBefore(tabs,backButton.nextSibling);
        view.insertBefore(panels,tabs.nextSibling);
      }else{
        view.prepend(panels);
        view.prepend(tabs);
      }
      tabs.addEventListener('click',event=>{
        const button=event.target.closest('[data-admin-tab]');
        if(!button||!tabs.contains(button))return;
        const selected=button.dataset.adminTab;
        tabs.querySelectorAll('[data-admin-tab]').forEach(tab=>{
          const active=tab===button;
          tab.classList.toggle('active',active);
          tab.setAttribute('aria-selected',active?'true':'false');
          tab.tabIndex=active?0:-1;
        });
        panels.querySelectorAll('[data-admin-panel]').forEach(panel=>{
          panel.hidden=panel.dataset.adminPanel!==selected;
        });
        if(selected==='create'){
          const firstField=form.querySelector('input:not([type="hidden"]),select,textarea');
          if(firstField)firstField.focus({preventScroll:true});
        }
      });
      tabs.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        const buttons=[...tabs.querySelectorAll('[data-admin-tab]')];
        const current=buttons.indexOf(document.activeElement);
        const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(current+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
        event.preventDefault();
        buttons[next].focus();
        buttons[next].click();
      });
    });
  }

    setupAdminWorkspaceTabs();
    els.refresh?.addEventListener('click',loadDashboard);els.back?.addEventListener('click',closePanel);els.navToggle?.addEventListener('click',()=>toggleMobileSidebar());els.sidebarBackdrop?.addEventListener('click',()=>toggleMobileSidebar(false));els.section.querySelector('#fa-admin-navigation')?.addEventListener('click',event=>{if(event.target.closest('.firebase-admin-nav-item'))toggleMobileSidebar(false);});document.addEventListener('keydown',event=>{if(event.key==='Escape')toggleMobileSidebar(false);});
    els.section.querySelectorAll('[data-admin-view]').forEach(btn=>btn.addEventListener('click',()=>switchAdminView(btn.dataset.adminView)));
    els.section.querySelectorAll('[data-admin-home]').forEach(btn=>btn.addEventListener('click',showAdminHome));
els.lawyerEditClose?.addEventListener('click',closeLawyerEdit);els.lawyerEditCancel?.addEventListener('click',closeLawyerEdit);els.lawyerEditForm?.addEventListener('submit',saveLawyerEdit);
els.section.querySelectorAll('[data-lawyer-view]').forEach(btn=>btn.addEventListener('click',()=>switchLawyerView(btn.dataset.lawyerView)));
     els.procedureForm?.addEventListener('submit',saveLegalProcedure);els.procedureReset?.addEventListener('click',resetLegalProcedure);els.petitionForm?.addEventListener('submit',savePetition);els.petitionReset?.addEventListener('click',resetPetition);
  }
  function setStatus(text,error){if(!els.status)return;els.status.textContent=text||'';els.status.hidden=!text;els.status.classList.toggle('error',Boolean(error));}
  function switchLawyerView(view){
    const panels={
      pending:els.section.querySelector('#fa-lawyers-pending-panel'),
      published:els.section.querySelector('#fa-lawyers-published-panel'),
      edits:els.section.querySelector('#fa-lawyers-edit-requests-panel')
    };
    if(!Object.prototype.hasOwnProperty.call(panels,view))return;
    Object.entries(panels).forEach(([name,panel])=>{if(panel)panel.hidden=name!==view;});
    els.section.querySelectorAll('[data-lawyer-view]').forEach(btn=>{
      const active=btn.dataset.lawyerView===view;
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-selected',active?'true':'false');
    });
    if(els.lawyerEdit)closeLawyerEdit();
  }
  function toggleMobileSidebar(force){
    if(!els.section)return;
    const open=typeof force==='boolean'?force:!els.section.classList.contains('is-sidebar-open');
    els.section.classList.toggle('is-sidebar-open',open);
    els.navToggle?.setAttribute('aria-expanded',open?'true':'false');
  }
  function setActiveNavigation(view){
    els.section?.querySelectorAll('.firebase-admin-nav-item').forEach(item=>{
      const active=view==='home'?item.hasAttribute('data-admin-home'):item.dataset.adminView===view;
      item.classList.toggle('is-active',active);
      if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
    });
  }
  function switchAdminView(view){
    const home=els.section.querySelector('#fa-admin-home');
    if(home)home.hidden=true;
    setActiveNavigation(view);
    els.section.querySelectorAll('.firebase-admin-subview').forEach(panel=>{
      const active=panel.id==='fa-admin-view-'+view;
      panel.hidden=!active;
      panel.classList.toggle('active',active);
    });
    if(view!=='lawyers'&&els.lawyerEdit)closeLawyerEdit();
    if(view==='procedures'){loadProcedureAccessRequests();loadLegalProcedures();}if(view==='petitions'){loadPetitionAccessRequests();loadPetitions();}
  }
  function setPendingCount(key,count){
    const value=Math.max(0,Number(count)||0);
    const targets={
      lawyers:[els.navLawyersCount,...els.section.querySelectorAll('[data-admin-count="lawyers"]')],
      procedures:[els.navProceduresCount,els.proceduresAccessCount,...els.section.querySelectorAll('[data-admin-count="procedures"]')],
      petitions:[els.navPetitionsCount,els.petitionsAccessCount,...els.section.querySelectorAll('[data-admin-count="petitions"]')],
      forum:[...els.section.querySelectorAll('[data-admin-count="forum"]')]
    }[key]||[];
    targets.forEach(node=>{if(!node)return;node.textContent=String(value);node.hidden=value===0;});
  }
  async function refreshPendingAdminCounts(){
    if(!isAdmin||!window.publicAuth?.firestore||!els.section)return;
    try{
      const db=window.publicAuth.firestore;
      const [procedureSnap,petitionSnap]=await Promise.all([
        db.collection('procedureAccessRequests').where('status','==','pending').get(),
        db.collection('petitionAccessRequests').where('status','==','pending').get()
      ]);
      const lawyerCount=lawyerApplications.length+(Number(els.lawyerEditRequestsCount?.textContent)||0);
      setPendingCount('lawyers',lawyerCount);
      setPendingCount('procedures',procedureSnap.size);
      setPendingCount('petitions',petitionSnap.size);
      window.dispatchEvent(new CustomEvent('mizan:refresh-forum-pending-counts'));
    }catch(error){console.warn('تعذر تحديث مؤشرات الطلبات المعلقة:',error);}
  }
  function showAdminHome(){
    const home=els.section.querySelector('#fa-admin-home');
    if(home)home.hidden=false;
    setActiveNavigation('home');
    els.section.querySelectorAll('.firebase-admin-subview').forEach(panel=>{panel.hidden=true;panel.classList.remove('active');});
    if(els.lawyerEdit)closeLawyerEdit();
  }
  function showTab(show){if(!els.tab)return;els.tab.hidden=!show;els.tab.setAttribute('aria-hidden',show?'false':'true');}
  async function checkAdmin(user){if(!user||!window.publicAuth?.firestore)return false;try{const snap=await window.publicAuth.firestore.collection('admins').doc(user.uid).get();const data=snap.exists?snap.data():null;return Boolean(data&&data.role==='admin'&&data.enabled!==false);}catch(e){console.warn('تعذر التحقق من صلاحية admin:',e);return false;}}
  function rememberMainView(){const main=document.querySelector('main.container');if(!main)return;mainViewState=[...main.children].filter(el=>el.id!=='firebase-admin-section').map(el=>({el,hidden:el.hidden,active:el.classList.contains('active')}));}
  function hideMainViews(){const main=document.querySelector('main.container');if(!main)return;[...main.children].forEach(el=>{if(el.id==='firebase-admin-section')return;el.hidden=true;el.classList.remove('active');});}
  function restoreMainViews(){mainViewState.forEach(({el,hidden,active})=>{if(!el)return;el.hidden=hidden;el.classList.toggle('active',active);});mainViewState=[];}
  function openPanel(){
     if(!isAdmin||!els.section)return;
     const footer=document.querySelector('footer');
     if(!panelOpen){
       rememberMainView();
       hideMainViews();
     }
     panelOpen=true;
     els.section.hidden=false;
     toggleMobileSidebar(false);
     showAdminHome();
     if(footer)footer.hidden=true;
     if(window.app?.navigateTo){
       window.app.navigateTo('firebase-admin');
     }else{
       document.querySelectorAll('.view-section').forEach(s=>{if(s!==els.section)s.classList.remove('active');});
       const home=document.querySelector('.platform-home');if(home)home.style.display='none';
       els.section.classList.add('active');
       window.scrollTo({top:0,behavior:'smooth'});
     }
     loadDashboard();
   }
  function closePanel(fromNavigation=false){
     if(!panelOpen)return;
     const routed=history.state?.view==='firebase-admin';
     const footer=document.querySelector('footer');
     els.section.hidden=true;
     els.section.classList.remove('active','is-sidebar-open');
     els.navToggle?.setAttribute('aria-expanded','false');
     if(footer)footer.hidden=false;
     panelOpen=false;
     if(routed&&!fromNavigation&&window.app?.navigateTo){
       window.app.navigateTo('home');
       restoreMainViews();
       return;
     }
     restoreMainViews();
   }
  async function loadDashboard(){if(!isAdmin||!window.publicAuth?.firestore)return;setStatus('جارٍ تحميل بيانات الطلاب...');try{const db=window.publicAuth.firestore;const studentsSnap=await db.collection('students').get();const students=studentsSnap.docs.map(d=>d.data());els.studentsCount.textContent=students.length;students.sort((a,b)=>String(a.email||'').localeCompare(String(b.email||'')));els.studentsBody.innerHTML=students.length?students.map(s=>'<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">طالب مسجل</span><h4>'+esc(s.displayName||'بدون اسم')+'</h4></div></div><div class="firebase-admin-record-field"><span>البريد الإلكتروني</span><strong>'+esc(s.email||'غير متوفر')+'</strong></div><div class="firebase-admin-record-meta">تاريخ التسجيل: '+esc(dateValue(s.createdAt))+'</div></article>').join(''):'<p class="firebase-admin-list-state">لا يوجد طلاب مسجلون.</p>';els.studentsUpdated.textContent=timeValue(new Date());await loadLawyerManagement();if(els.dashboardStudentsCount)els.dashboardStudentsCount.textContent=String(students.length);if(els.dashboardLawyerPending)els.dashboardLawyerPending.textContent=String(lawyerApplications.length);if(els.dashboardLawyerPublished)els.dashboardLawyerPublished.textContent=String(lawyerProfiles.filter(profile=>profile.published===true).length);if(els.dashboardLawyerEdits)els.dashboardLawyerEdits.textContent=els.lawyerEditRequestsCount?.textContent||'0';if(els.navLawyersCount)els.navLawyersCount.textContent=String(lawyerApplications.length+(Number(els.lawyerEditRequestsCount?.textContent)||0));await refreshPendingAdminCounts();setStatus('');}catch(e){console.error(e);setStatus('تعذر تحميل بيانات الإدارة. تحقق من قواعد Firestore وصلاحية الحساب.',true);}}  async function loadLawyerManagement(){
    await Promise.all([loadLawyerApplications(),loadLawyerProfiles()]);
    await loadLawyerEditRequests();
  }

  async function loadLawyerEditRequests(){
    if(!isAdmin||!window.publicAuth?.firestore||!els.lawyerEditRequestsBody)return;
    try{
      const snap=await window.publicAuth.firestore.collection('lawyerEditRequests').get();
      const requests=snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>String(r.status||'').toLowerCase()==='pending');
      requests.sort((a,b)=>{const av=a.createdAt&&typeof a.createdAt.toMillis==='function'?a.createdAt.toMillis():0,bv=b.createdAt&&typeof b.createdAt.toMillis==='function'?b.createdAt.toMillis():0;return bv-av;});
      if(els.lawyerEditRequestsCount)els.lawyerEditRequestsCount.textContent=requests.length;
      setPendingCount('lawyers',lawyerApplications.length+requests.length);
      const profilesById=new Map(lawyerProfiles.map(p=>[p.id,p]));
      els.lawyerEditRequestsBody.innerHTML=requests.length?requests.map(r=>{
        const p=profilesById.get(r.profileId)||{};
        const d=r.data||{};
        const changes=['phone','address','office','workingHours','specializations','governorate','district','name'].filter(k=>String(d[k]??'')!==String(p[k]??''));
        const labels={phone:'الهاتف',address:'العنوان',office:'المكتب',workingHours:'الدوام',specializations:'الاختصاصات',governorate:'المحافظة',district:'القضاء/المنطقة',name:'الاسم'};
        return '<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">طلب تعديل بيانات</span><h4>'+esc(p.name||d.name||'المحامي')+'</h4><span class="firebase-admin-record-sub">'+esc(r.applicantEmail||'')+'</span></div><span class="lawyer-admin-status is-off">قيد المراجعة</span></div><div class="firebase-admin-record-field"><span>الحقول المطلوب تعديلها</span><p>'+esc(changes.map(k=>labels[k]).join('، ')||'تحديث بيانات')+'</p></div><div class="firebase-admin-record-meta">تاريخ الطلب: '+esc(dateValue(r.createdAt))+'</div><div class="lawyer-admin-actions"><button class="approve" data-lawyer-edit-approve="'+esc(r.id)+'">اعتماد التعديل</button><button class="reject" data-lawyer-edit-reject="'+esc(r.id)+'">رفض</button></div></article>';
      }).join(''):'<p class="firebase-admin-list-state">لا توجد طلبات تعديل قيد المراجعة.</p>';
      els.lawyerEditRequestsBody.querySelectorAll('[data-lawyer-edit-approve]').forEach(el=>el.onclick=()=>approveLawyerEditRequest(requests.find(x=>x.id===el.dataset.lawyerEditApprove)));
      els.lawyerEditRequestsBody.querySelectorAll('[data-lawyer-edit-reject]').forEach(el=>el.onclick=()=>rejectLawyerEditRequest(requests.find(x=>x.id===el.dataset.lawyerEditReject)));
    }catch(e){console.error('Lawyer edit requests load failed:',e);els.lawyerEditRequestsBody.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل طلبات التعديل.</p>';}
  }

  async function loadLawyerApplications(){
    if(!isAdmin||!window.publicAuth?.firestore||!els.lawyersBody)return;
    try{
      const snap=await window.publicAuth.firestore.collection('lawyerApplications').where('status','==','pending').get();
      lawyerApplications=snap.docs.map(d=>({id:d.id,...d.data()}));
      lawyerApplications.sort((a,b)=>{const av=a.createdAt&&typeof a.createdAt.toMillis==='function'?a.createdAt.toMillis():0,bv=b.createdAt&&typeof b.createdAt.toMillis==='function'?b.createdAt.toMillis():0;return bv-av;});
      if(els.lawyersPendingCount)els.lawyersPendingCount.textContent=lawyerApplications.length;
      setPendingCount('lawyers',lawyerApplications.length+(Number(els.lawyerEditRequestsCount?.textContent)||0));
      els.lawyersBody.innerHTML=lawyerApplications.length?lawyerApplications.map(a=>'<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">طلب انضمام إلى الدليل</span><h4>'+esc(a.name||'محامٍ')+'</h4><span class="firebase-admin-record-sub">'+esc(a.applicantEmail||'')+'</span></div><span class="lawyer-admin-status is-off">قيد المراجعة</span></div><div class="firebase-admin-record-field"><span>الموقع والهاتف</span><p>'+esc([a.governorate,a.district].filter(Boolean).join(' — ')||'غير محدد')+' · '+esc(a.phone||'غير متوفر')+'</p></div><div class="firebase-admin-record-field"><span>الاختصاصات</span><p>'+esc((a.specializations||[]).join('، ')||'غير محددة')+'</p></div><div class="firebase-admin-record-meta">تاريخ التقديم: '+esc(dateValue(a.createdAt))+' · الهوية تُرسل خارج المنصة</div><div class="lawyer-admin-actions"><button class="approve" data-lawyer-approve="'+esc(a.id)+'">موافقة ونشر</button><button class="reject" data-lawyer-reject="'+esc(a.id)+'">رفض</button><button data-lawyer-edit-app="'+esc(a.id)+'">تعديل</button><button class="reject" data-lawyer-delete-app="'+esc(a.id)+'">حذف</button></div></article>').join(''):'<p class="firebase-admin-list-state">لا توجد طلبات قيد المراجعة.</p>';
      els.lawyersBody.querySelectorAll('[data-lawyer-approve]').forEach(el=>el.onclick=()=>approveLawyer(lawyerApplications.find(x=>x.id===el.dataset.lawyerApprove)));
      els.lawyersBody.querySelectorAll('[data-lawyer-reject]').forEach(el=>el.onclick=()=>rejectLawyer(lawyerApplications.find(x=>x.id===el.dataset.lawyerReject)));
      els.lawyersBody.querySelectorAll('[data-lawyer-edit-app]').forEach(el=>el.onclick=()=>openLawyerEdit(lawyerApplications.find(x=>x.id===el.dataset.lawyerEditApp),'application'));
      els.lawyersBody.querySelectorAll('[data-lawyer-delete-app]').forEach(el=>el.onclick=()=>deleteLawyerApplication(lawyerApplications.find(x=>x.id===el.dataset.lawyerDeleteApp)));
    }catch(e){console.error('Lawyer applications load failed:',e);els.lawyersBody.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل طلبات المحامين. تحقق من القواعد.</p>';}
  }

  async function loadLawyerProfiles(){
    if(!isAdmin||!window.publicAuth?.firestore||!els.lawyersPublishedBody)return;
    try{
      const snap=await window.publicAuth.firestore.collection('lawyerProfiles').get();
      lawyerProfiles=snap.docs.map(d=>({id:d.id,...d.data()}));
      lawyerProfiles.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ar'));
      if(els.lawyersPublishedCount)els.lawyersPublishedCount.textContent=lawyerProfiles.length;
      els.lawyersPublishedBody.innerHTML=lawyerProfiles.length?lawyerProfiles.map(p=>'<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">ملف في دليل المحامين</span><h4>'+esc(p.name||'محامٍ')+'</h4></div><span class="lawyer-admin-status '+(p.published?'is-live':'is-off')+'">'+(p.published?'ظاهر للطلاب':'معطّل عن الظهور')+'</span></div><div class="firebase-admin-record-field"><span>الموقع والهاتف</span><p>'+esc([p.governorate,p.district].filter(Boolean).join(' — ')||'غير محدد')+' · '+esc(p.phone||'غير متوفر')+'</p></div><div class="firebase-admin-record-field"><span>الاختصاصات</span><p>'+esc((p.specializations||[]).join('، ')||'غير محددة')+'</p></div><div class="lawyer-admin-actions"><button data-lawyer-edit-profile="'+esc(p.id)+'">تعديل</button><button class="'+(p.published?'reject':'approve')+'" data-lawyer-toggle="'+esc(p.id)+'">'+(p.published?'تعطيل الظهور':'إعادة التفعيل')+'</button><button class="reject" data-lawyer-delete-profile="'+esc(p.id)+'">حذف</button></div></article>').join(''):'<p class="firebase-admin-list-state">لا توجد ملفات محامين.</p>';
      els.lawyersPublishedBody.querySelectorAll('[data-lawyer-edit-profile]').forEach(el=>el.onclick=()=>openLawyerEdit(lawyerProfiles.find(x=>x.id===el.dataset.lawyerEditProfile),'profile'));
      els.lawyersPublishedBody.querySelectorAll('[data-lawyer-toggle]').forEach(el=>el.onclick=()=>toggleLawyerVisibility(lawyerProfiles.find(x=>x.id===el.dataset.lawyerToggle)));
      els.lawyersPublishedBody.querySelectorAll('[data-lawyer-delete-profile]').forEach(el=>el.onclick=()=>deleteLawyerProfile(lawyerProfiles.find(x=>x.id===el.dataset.lawyerDeleteProfile)));
    }catch(e){console.error('Lawyer profiles load failed:',e);els.lawyersPublishedBody.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل ملفات المحامين. تحقق من قواعد Firestore.</p>';}
  }

  function resetLegalProcedure(){if(!els.procedureForm)return;els.procedureForm.reset();els.procedureForm.elements.id.value='';els.procedureForm.elements.category.value='';els.procedureForm.elements.published.checked=true;}
  async function syncPublicProcedureIndex(items){
    const db=window.publicAuth?.firestore;
    if(!isAdmin||!db)return false;
    const categoryTitles={civil:'الدعاوى المدنية',criminal:'الدعاوى الجزائية',administrative:'الدعاوى الإدارية',personal:'دعاوى الأحوال الشخصية'};
    const published=items.filter(item=>item.published===true&&typeof item.title==='string'&&item.title.trim()&&Object.prototype.hasOwnProperty.call(categoryTitles,item.category))
      .map(item=>({id:item.id,title:item.title.trim(),category:item.category,categoryTitle:categoryTitles[item.category]}))
      .sort((a,b)=>a.title.localeCompare(b.title,'ar'));
    const indexRef=db.collection('publicIndexes').doc('procedures');
    const indexSnap=await indexRef.get();
    const current=indexSnap.exists&&Array.isArray(indexSnap.data()?.items)?indexSnap.data().items:[];
    if(JSON.stringify(current)!==JSON.stringify(published)){
      await indexRef.set({items:published,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    }
    return true;
  }

  async function loadLegalProcedures(){
    if(!isAdmin||!window.publicAuth?.firestore||!els.proceduresContentBody)return false;
    const body=els.proceduresContentBody;body.innerHTML='<p class="firebase-admin-list-state">جارٍ تحميل الإجراءات...</p>';
    try{
      const snap=await window.publicAuth.firestore.collection('legalProcedures').get();
      const items=snap.docs.map(doc=>({id:doc.id,...doc.data()})).sort((a,b)=>String(a.title||'').localeCompare(String(b.title||''),'ar'));
      let indexSynced=false;
      try{indexSynced=await syncPublicProcedureIndex(items);}catch(indexError){console.error('Public procedure index sync failed:',indexError);}
      body.innerHTML=items.length?items.map(item=>'<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">إجراء قانوني</span><h4>'+esc(item.title||'بدون عنوان')+'</h4></div><span class="lawyer-admin-status '+(item.published?'is-live':'is-off')+'">'+(item.published?'منشور':'مسودة / مخفي')+'</span></div><div class="firebase-admin-record-field"><span>نبذة عن الإجراء</span><p>'+esc(item.summary||'لا توجد نبذة مختصرة')+'</p></div><div class="firebase-admin-record-meta">آخر تحديث: '+esc(dateValue(item.updatedAt))+'</div><div class="lawyer-admin-actions"><button type="button" data-procedure-edit="'+esc(item.id)+'">تعديل</button><button type="button" class="'+(item.published?'reject':'approve')+'" data-procedure-toggle="'+esc(item.id)+'">'+(item.published?'إخفاء':'نشر')+'</button><button type="button" class="reject" data-procedure-delete="'+esc(item.id)+'">حذف</button></div></article>').join(''):'<p class="firebase-admin-list-state">لا توجد إجراءات بعد. أضف أول إجراء من تبويب الإضافة.</p>';
      body.querySelectorAll('[data-procedure-edit]').forEach(btn=>btn.addEventListener('click',()=>{const item=items.find(x=>x.id===btn.dataset.procedureEdit);if(!item)return;const f=els.procedureForm;f.elements.id.value=item.id;f.elements.title.value=item.title||'';f.elements.category.value=item.category||'';f.elements.summary.value=item.summary||'';f.elements.requirements.value=item.requirements||'';f.elements.documents.value=item.documents||'';f.elements.steps.value=item.steps||'';f.elements.legalBasis.value=item.legalBasis||'';f.elements.fees.value=item.fees||'';f.elements.duration.value=item.duration||'';f.elements.published.checked=item.published===true;f.scrollIntoView({behavior:'smooth',block:'start'});}));
      body.querySelectorAll('[data-procedure-toggle]').forEach(btn=>btn.addEventListener('click',async()=>{const item=items.find(x=>x.id===btn.dataset.procedureToggle);if(!item)return;try{await window.publicAuth.firestore.collection('legalProcedures').doc(item.id).update({published:item.published!==true,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});const synced=await loadLegalProcedures();setStatus(synced?'تم تحديث حالة الإجراء والفهرس العام في Firebase.':'تم تحديث حالة الإجراء، لكن تعذر تحديث الفهرس العام. تحقق من قواعد Firestore المنشورة.',!synced);}catch(e){console.error(e);setStatus('تعذر تحديث حالة الإجراء.',true);}}));
      body.querySelectorAll('[data-procedure-delete]').forEach(btn=>btn.addEventListener('click',async()=>{const item=items.find(x=>x.id===btn.dataset.procedureDelete);if(!item||!confirm('حذف هذا الإجراء نهائياً؟'))return;try{await window.publicAuth.firestore.collection('legalProcedures').doc(item.id).delete();resetLegalProcedure();const synced=await loadLegalProcedures();setStatus(synced?'تم حذف الإجراء وتحديث الفهرس العام.':'تم حذف الإجراء، لكن تعذر تحديث الفهرس العام. تحقق من قواعد Firestore المنشورة.',!synced);}catch(e){console.error(e);setStatus('تعذر حذف الإجراء.',true);}}));
      return indexSynced;
    }catch(e){console.error('Legal procedures load failed:',e);body.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل الإجراءات. تحقق من قواعد Firestore المنشورة.</p>';return false;}
  }


  function resetPetition(){if(!els.petitionForm)return;els.petitionForm.reset();els.petitionForm.elements.id.value='';els.petitionForm.elements.icon.value='fas fa-file-signature';els.petitionForm.elements.published.checked=true;}
  async function syncPublicPetitionIndex(items){
    const db=window.publicAuth?.firestore;if(!isAdmin||!db)return false;
    const names={family:'عرائض أحوال شخصية',civil:'عرائض البداءة (الدعاوى المدنية)',criminal:'عرائض جزائية وتحقيق',administrative:'عرائض إدارية'};
    const published=items.filter(x=>x.published===true&&x.title&&names[x.categoryId]).map(x=>({uid:x.id,name:x.title.trim(),categoryId:x.categoryId,category:names[x.categoryId],description:x.description||'',icon:x.icon||'fas fa-file-signature'})).sort((a,b)=>a.name.localeCompare(b.name,'ar'));
    const ref=db.collection('publicIndexes').doc('petitions'),snap=await ref.get(),current=snap.exists&&Array.isArray(snap.data()?.items)?snap.data().items:[];
    if(JSON.stringify(current)!==JSON.stringify(published))await ref.set({items:published,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});return true;
  }
  async function loadPetitions(){
    if(!isAdmin||!window.publicAuth?.firestore||!els.petitionsContentBody)return false;
    const body=els.petitionsContentBody;body.innerHTML='<p class="firebase-admin-list-state">جارٍ تحميل نماذج العرائض...</p>';
    try{
      const snap=await window.publicAuth.firestore.collection('petitionDocuments').get(),items=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.title||'').localeCompare(String(b.title||''),'ar'));
      const synced=await syncPublicPetitionIndex(items),labels={family:'أحوال شخصية',civil:'مدنية',criminal:'جزائية',administrative:'إدارية'};
      body.innerHTML=items.length?items.map(x=>'<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">نموذج عريضة</span><h4>'+esc(x.title||'بدون عنوان')+'</h4></div><span class="lawyer-admin-status '+(x.published?'is-live':'is-off')+'">'+(x.published?'منشورة':'مسودة / مخفية')+'</span></div><div class="firebase-admin-record-field"><span>التصنيف</span><strong>'+esc(labels[x.categoryId]||x.categoryId||'—')+'</strong></div><div class="firebase-admin-record-field"><span>الوصف</span><p>'+esc(x.description||'لا يوجد وصف مختصر')+'</p></div><div class="firebase-admin-record-field"><span>معاينة نص العريضة</span><div class="firebase-admin-record-content">'+esc((x.body||'لا يوجد نص محفوظ').slice(0,220))+(x.body&&x.body.length>220?'…':'')+'</div>'+(x.body&&x.body.length>220?'<details class="firebase-admin-record-details"><summary>عرض النص الكامل</summary><div class="firebase-admin-record-content">'+esc(x.body)+'</div></details>':'')+'</div><div class="firebase-admin-record-meta">آخر تحديث: '+esc(dateValue(x.updatedAt))+'</div><div class="lawyer-admin-actions"><button type="button" data-petition-edit="'+esc(x.id)+'">تعديل</button><button type="button" class="'+(x.published?'reject':'approve')+'" data-petition-toggle="'+esc(x.id)+'">'+(x.published?'إخفاء':'نشر')+'</button><button type="button" class="reject" data-petition-delete="'+esc(x.id)+'">حذف</button></div></article>').join(''):'<p class="firebase-admin-list-state">لا توجد نماذج في Firestore بعد. أضف أول عريضة من النموذج أعلاه.</p>';
      body.querySelectorAll('[data-petition-edit]').forEach(b=>b.onclick=()=>{const x=items.find(v=>v.id===b.dataset.petitionEdit);if(!x)return;const f=els.petitionForm;f.elements.id.value=x.id;f.elements.title.value=x.title||'';f.elements.category.value=x.categoryId||'';f.elements.description.value=x.description||'';f.elements.icon.value=x.icon||'fas fa-file-signature';f.elements.body.value=x.body||'';f.elements.published.checked=x.published===true;f.scrollIntoView({behavior:'smooth',block:'start'});});
      body.querySelectorAll('[data-petition-toggle]').forEach(b=>b.onclick=async()=>{const x=items.find(v=>v.id===b.dataset.petitionToggle);if(!x)return;try{await window.publicAuth.firestore.collection('petitionDocuments').doc(x.id).update({published:x.published!==true,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});await loadPetitions();setStatus('تم تحديث حالة العريضة والفهرس العام.',false);}catch(e){console.error(e);setStatus('تعذر تحديث حالة العريضة.',true);}});
      body.querySelectorAll('[data-petition-delete]').forEach(b=>b.onclick=async()=>{const x=items.find(v=>v.id===b.dataset.petitionDelete);if(!x||!confirm('حذف هذه العريضة نهائياً؟'))return;try{await window.publicAuth.firestore.collection('petitionDocuments').doc(x.id).delete();resetPetition();await loadPetitions();setStatus('تم حذف العريضة وتحديث الفهرس.',false);}catch(e){console.error(e);setStatus('تعذر حذف العريضة.',true);}});
      return synced;
    }catch(e){console.error('Petitions load failed:',e);body.innerHTML='<tr><td colspan="5">تعذر تحميل نماذج العرائض. تحقق من قواعد Firestore المنشورة.</td></tr>';return false;}
  }
  async function savePetition(event){
    event.preventDefault();if(!isAdmin||!window.publicAuth?.firestore||!window.publicAuth?.user)return;
    const f=els.petitionForm,id=String(f.elements.id.value||'').trim(),categoryId=String(f.elements.category.value||'').trim();
    if(!['family','civil','criminal','administrative'].includes(categoryId)){setStatus('اختر تصنيف العريضة الصحيح.',true);return;}
    const data={title:String(f.elements.title.value||'').trim().slice(0,180),categoryId,description:String(f.elements.description.value||'').trim().slice(0,1000),icon:String(f.elements.icon.value||'fas fa-file-signature').trim().slice(0,100),body:String(f.elements.body.value||'').trim().slice(0,50000),published:Boolean(f.elements.published.checked)};
    if(data.title.length<3||data.body.length<10){setStatus('عنوان العريضة والنص الكامل مطلوبان.',true);return;}
    setStatus('جارٍ حفظ العريضة في Firestore...',false);
    try{const db=window.publicAuth.firestore,stamp=firebase.firestore.FieldValue.serverTimestamp();if(id)await db.collection('petitionDocuments').doc(id).update({...data,updatedAt:stamp});else{const ref=db.collection('petitionDocuments').doc();await ref.set({...data,createdAt:stamp,createdBy:window.publicAuth.user.uid,updatedAt:stamp});}resetPetition();const synced=await loadPetitions();setStatus(synced?'تم حفظ العريضة وتحديث الفهرس العام.':'تم حفظ العريضة لكن تعذر تحديث الفهرس العام.',!synced);}
    catch(e){console.error('Petition save failed:',e);setStatus('تعذر حفظ العريضة في Firestore. '+String(e.message||''),true);}
  }
  async function loadPetitionAccessRequests(){
    if(!isAdmin||!window.publicAuth?.firestore||!els.petitionsRequestsBody)return;
    const body=els.petitionsRequestsBody;body.innerHTML='<p class="firebase-admin-list-state">جارٍ تحميل طلبات الوصول...</p>';
    try{
      const db=window.publicAuth.firestore,[rs,gs]=await Promise.all([db.collection('petitionAccessRequests').get(),db.collection('petitionAccess').get()]);
      const grants=new Map(gs.docs.map(d=>[d.id,{id:d.id,...d.data()}])),requests=rs.docs.map(d=>({id:d.id,...d.data()}));
      setPendingCount('petitions',requests.filter(r=>r.status==='pending'&&grants.get(r.uid||r.id)?.enabled!==true).length);
      requests.sort((a,b)=>{const x=a.createdAt&&typeof a.createdAt.toMillis==='function'?a.createdAt.toMillis():0,y=b.createdAt&&typeof b.createdAt.toMillis==='function'?b.createdAt.toMillis():0;return y-x;});
      body.innerHTML=requests.length?requests.map(r=>{const uid=r.uid||r.id,g=grants.get(uid),enabled=g?.enabled===true,status=enabled?'الصلاحية مفعّلة':r.status==='pending'?'قيد المراجعة':r.status==='rejected'?'مرفوض':r.status==='revoked'?'تم سحب الصلاحية':esc(r.status||'غير محدد');const actions=enabled?'<button class="reject" data-petition-revoke="'+esc(uid)+'">سحب الصلاحية</button>':'<button class="approve" data-petition-approve="'+esc(uid)+'">'+(r.status==='pending'?'✓ موافقة':'إعادة منح الوصول')+'</button>'+(r.status==='pending'?'<button class="reject" data-petition-reject="'+esc(uid)+'">✕ رفض</button>':'');return '<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">مستخدم ميزان</span><h4>'+esc(r.displayName||'مستخدم ميزان')+'</h4><span class="firebase-admin-record-sub">'+esc(r.email||'البريد غير متوفر')+'</span></div><span class="lawyer-admin-status '+(enabled?'is-live':r.status==='pending'?'is-off':'')+'">'+status+'</span></div><div class="firebase-admin-record-field"><span>سبب الطلب</span><p>'+esc(r.reason||'لم يذكر سبباً')+'</p></div><div class="firebase-admin-record-meta">تاريخ الطلب: '+esc(dateValue(r.createdAt))+'</div><div class="lawyer-admin-actions">'+actions+'</div></article>';}).join(''):'<p class="firebase-admin-list-state">لا توجد طلبات وصول حتى الآن.</p>';
      body.querySelectorAll('[data-petition-approve]').forEach(b=>b.onclick=()=>approvePetitionAccess(requests.find(r=>(r.uid||r.id)===b.dataset.petitionApprove)));
      body.querySelectorAll('[data-petition-reject]').forEach(b=>b.onclick=()=>rejectPetitionAccess(requests.find(r=>(r.uid||r.id)===b.dataset.petitionReject)));
      body.querySelectorAll('[data-petition-revoke]').forEach(b=>b.onclick=()=>revokePetitionAccess(requests.find(r=>(r.uid||r.id)===b.dataset.petitionRevoke),grants.get(b.dataset.petitionRevoke)));
    }catch(e){console.error('Petition access requests load failed:',e);body.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل الطلبات. تحقق من قواعد Firestore المنشورة.</p>';}
  }
  async function approvePetitionAccess(r){
    if(!isAdmin||!r||!confirm('منح هذا المستخدم صلاحية دائمة للوصول إلى العرائض؟'))return;
    try{const db=window.publicAuth.firestore,uid=r.uid||r.id,rr=db.collection('petitionAccessRequests').doc(uid),ar=db.collection('petitionAccess').doc(uid);await db.runTransaction(async tx=>{const s=await tx.get(rr);if(!s.exists)throw Error('طلب الوصول غير موجود.');const fresh=s.data()||{};if(fresh.uid!==uid||!['pending','rejected','revoked'].includes(fresh.status))throw Error('الطلب غير صالح أو تمت مراجعته.');tx.set(ar,{uid,enabled:true,grantedBy:window.publicAuth.user.uid,grantedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});tx.update(rr,{status:'approved',reviewedBy:window.publicAuth.user.uid,reviewedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});});await loadPetitionAccessRequests();setStatus('تمت الموافقة ومنح صلاحية دائمة للوصول إلى العرائض.',false);}
    catch(e){console.error('Petition access approval failed:',e);setStatus('تعذرت الموافقة على طلب العرائض.',true);}
  }
  async function rejectPetitionAccess(r){
    if(!isAdmin||!r||!confirm('رفض طلب الوصول إلى العرائض؟'))return;
    try{await window.publicAuth.firestore.collection('petitionAccessRequests').doc(r.uid||r.id).update({status:'rejected',reviewedBy:window.publicAuth.user.uid,reviewedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});await loadPetitionAccessRequests();setStatus('تم رفض طلب الوصول إلى العرائض.',false);}
    catch(e){console.error(e);setStatus('تعذر رفض طلب الوصول.',true);}
  }
  async function revokePetitionAccess(r,g){
    if(!isAdmin||!r||!g||!confirm('سحب صلاحية هذا المستخدم؟ لن يستطيع فتح نصوص العرائض بعد ذلك.'))return;
    try{const db=window.publicAuth.firestore,uid=r.uid||r.id;await db.runTransaction(async tx=>{const rr=db.collection('petitionAccessRequests').doc(uid),ar=db.collection('petitionAccess').doc(uid),rs=await tx.get(rr),as=await tx.get(ar);if(!rs.exists||!as.exists)throw Error('تعذر العثور على الطلب أو الصلاحية.');tx.update(ar,{enabled:false,revokedBy:window.publicAuth.user.uid,revokedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});tx.update(rr,{status:'revoked',reviewedBy:window.publicAuth.user.uid,reviewedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});});await loadPetitionAccessRequests();setStatus('تم سحب صلاحية الوصول إلى العرائض.',false);}
    catch(e){console.error(e);setStatus('تعذر سحب صلاحية الوصول.',true);}
  }

  async function saveLegalProcedure(event){
    event.preventDefault();
    if(!isAdmin||!window.publicAuth?.firestore||!window.publicAuth?.user)return;
    const f=els.procedureForm,id=String(f.elements.id.value||'').trim();
    const category=String(f.elements.category.value||'').trim();
    const validCategories=['civil','criminal','administrative','personal'];
    if(!validCategories.includes(category)){
      setStatus('اختر تصنيف الدعوى الصحيح قبل حفظ الإجراء.',true);
      f.elements.category.focus();
      return;
    }
    const data={
      title:String(f.elements.title.value||'').trim().slice(0,180),
      category,
      summary:String(f.elements.summary.value||'').trim().slice(0,2000),
      requirements:String(f.elements.requirements.value||'').trim().slice(0,5000),
      documents:String(f.elements.documents.value||'').trim().slice(0,5000),
      steps:String(f.elements.steps.value||'').trim().slice(0,10000),
      legalBasis:String(f.elements.legalBasis.value||'').trim().slice(0,5000),
      fees:String(f.elements.fees.value||'').trim().slice(0,500),
      duration:String(f.elements.duration.value||'').trim().slice(0,500),
      published:Boolean(f.elements.published.checked)
    };
    if(data.title.length<3){
      setStatus('عنوان الإجراء مطلوب ويجب ألا يقل عن 3 محارف.',true);
      return;
    }
    setStatus('جارٍ حفظ الإجراء في Firebase...',false);
    try{
      const db=window.publicAuth.firestore;
      if(id){
        await db.collection('legalProcedures').doc(id).update({...data,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      }else{
        data.createdAt=firebase.firestore.FieldValue.serverTimestamp();
        data.createdBy=window.publicAuth.user.uid;
        data.updatedAt=firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('legalProcedures').add(data);
      }
      resetLegalProcedure();
      const indexSynced=await loadLegalProcedures();
      setStatus(
        indexSynced
          ? 'تم حفظ الإجراء في Firebase وتحديث الفهرس.'
          : 'تم حفظ الإجراء في Firebase، لكن تعذر تحديث الفهرس العام.',
        !indexSynced
      );
    }catch(e){
      console.error('Legal procedure save failed:',e);
      setStatus('تعذر حفظ الإجراء في Firebase. '+String(e.message||''),true);
    }
  }

  async function loadProcedureAccessRequests(){
    if(!isAdmin||!window.publicAuth?.firestore||!els.proceduresRequestsBody)return;
    const body=els.proceduresRequestsBody;
    body.innerHTML='<tr><td colspan="5">جارٍ تحميل طلبات الوصول...</td></tr>';
    try{
      const db=window.publicAuth.firestore;
      const [requestsSnap,accessSnap]=await Promise.all([
        db.collection('procedureAccessRequests').get(),
        db.collection('procedureAccess').get()
      ]);
      const grants=new Map(accessSnap.docs.map(doc=>[doc.id,{id:doc.id,...doc.data()}]));
      const requests=requestsSnap.docs.map(doc=>({id:doc.id,...doc.data()}));
      setPendingCount('procedures',requests.filter(r=>r.status==='pending'&&grants.get(r.uid||r.id)?.enabled!==true).length);
      requests.sort((a,b)=>{
        const av=a.createdAt&&typeof a.createdAt.toMillis==='function'?a.createdAt.toMillis():0;
        const bv=b.createdAt&&typeof b.createdAt.toMillis==='function'?b.createdAt.toMillis():0;
        return bv-av;
      });
      body.innerHTML=requests.length?requests.map(request=>{
        const uid=request.uid||request.id;
        const grant=grants.get(uid);
        const enabled=Boolean(grant&&grant.enabled===true);
        const status=enabled?'الصلاحية مفعّلة':request.status==='pending'?'قيد المراجعة':request.status==='rejected'?'مرفوض':request.status==='revoked'?'تم سحب الصلاحية':esc(request.status||'غير محدد');
        let actions='';
        if(enabled) actions='<button class="reject" data-procedure-revoke="'+esc(uid)+'">سحب الصلاحية</button>';
        else {
          actions='<button class="approve" data-procedure-approve="'+esc(uid)+'">'+(request.status==='pending'?'✓ موافقة':'إعادة منح الوصول')+'</button>';
          if(request.status==='pending') actions+='<button class="reject" data-procedure-reject="'+esc(uid)+'">✕ رفض</button>';
        }
        return '<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">مستخدم ميزان</span><h4>'+esc(request.displayName||'مستخدم ميزان')+'</h4><span class="firebase-admin-record-sub">'+esc(request.email||'البريد غير متوفر')+'</span></div><span class="lawyer-admin-status '+(enabled?'is-live':request.status==='pending'?'is-off':'')+'">'+status+'</span></div><div class="firebase-admin-record-field"><span>سبب الطلب</span><p>'+esc(request.reason||'لم يذكر سبباً')+'</p></div><div class="firebase-admin-record-meta">تاريخ الطلب: '+esc(dateValue(request.createdAt))+'</div><div class="lawyer-admin-actions">'+actions+'</div></article>';
      }).join(''):'<p class="firebase-admin-list-state">لا توجد طلبات وصول حتى الآن.</p>';
      body.querySelectorAll('[data-procedure-approve]').forEach(button=>button.addEventListener('click',()=>{
        const request=requests.find(item=>(item.uid||item.id)===button.dataset.procedureApprove);
        approveProcedureAccess(request);
      }));
      body.querySelectorAll('[data-procedure-reject]').forEach(button=>button.addEventListener('click',()=>{
        const request=requests.find(item=>(item.uid||item.id)===button.dataset.procedureReject);
        rejectProcedureAccess(request);
      }));
      body.querySelectorAll('[data-procedure-revoke]').forEach(button=>button.addEventListener('click',()=>{
        const request=requests.find(item=>(item.uid||item.id)===button.dataset.procedureRevoke);
        revokeProcedureAccess(request,grants.get(request?.uid||request?.id));
      }));
    }catch(error){
      console.error('Procedure access requests load failed:',error);
      body.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل الطلبات. تحقق من قواعد Firestore المنشورة.</p>';
    }
  }

  async function approveProcedureAccess(request){
    if(!isAdmin||!request||!confirm('منح هذا المستخدم صلاحية الدخول إلى إجراءات الدعاوى؟'))return;
    try{
      const db=window.publicAuth.firestore;
      const uid=request.uid||request.id;
      const requestRef=db.collection('procedureAccessRequests').doc(uid);
      const accessRef=db.collection('procedureAccess').doc(uid);
      await db.runTransaction(async transaction=>{
        const snapshot=await transaction.get(requestRef);
        if(!snapshot.exists)throw new Error('طلب الوصول غير موجود.');
        const fresh=snapshot.data()||{};
        if(fresh.uid!==uid)throw new Error('معرّف المستخدم لا يطابق الطلب.');
        transaction.set(accessRef,{
          uid:fresh.uid,
          enabled:true,
          grantedBy:window.publicAuth.user.uid,
          grantedAt:firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt:firebase.firestore.FieldValue.serverTimestamp()
        },{merge:true});
        transaction.update(requestRef,{
          status:'approved',
          reviewedBy:window.publicAuth.user.uid,
          reviewedAt:firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt:firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      await loadProcedureAccessRequests();
      setStatus('تمت الموافقة ومنح صلاحية الوصول.',false);
    }catch(error){
      console.error('Procedure access approval failed:',error);
      setStatus('تعذر منح الصلاحية. تحقق من قواعد Firestore المنشورة.',true);
    }
  }

  async function rejectProcedureAccess(request){
    if(!isAdmin||!request||!confirm('رفض طلب الوصول إلى إجراءات الدعاوى؟'))return;
    try{
      await window.publicAuth.firestore.collection('procedureAccessRequests').doc(request.uid||request.id).update({
        status:'rejected',
        reviewedBy:window.publicAuth.user.uid,
        reviewedAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      await loadProcedureAccessRequests();
      setStatus('تم رفض طلب الوصول.',false);
    }catch(error){
      console.error('Procedure access rejection failed:',error);
      setStatus('تعذر رفض الطلب.',true);
    }
  }

  async function revokeProcedureAccess(request,grant){
    if(!isAdmin||!request||!grant||!confirm('سحب صلاحية هذا المستخدم؟ لن يتمكن من قراءة محتوى الإجراءات المحمي بعد تطبيق التغيير.'))return;
    try{
      const db=window.publicAuth.firestore;
      const uid=request.uid||request.id;
      await db.runTransaction(async transaction=>{
        const requestRef=db.collection('procedureAccessRequests').doc(uid);
        const accessRef=db.collection('procedureAccess').doc(grant.uid||grant.id);
        const requestSnap=await transaction.get(requestRef);
        const accessSnap=await transaction.get(accessRef);
        if(!requestSnap.exists||!accessSnap.exists)throw new Error('تعذر العثور على الطلب أو الصلاحية.');
        transaction.update(accessRef,{enabled:false,revokedBy:window.publicAuth.user.uid,revokedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
        transaction.update(requestRef,{status:'revoked',reviewedBy:window.publicAuth.user.uid,reviewedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      });
      await loadProcedureAccessRequests();
      setStatus('تم سحب صلاحية الوصول.',false);
    }catch(error){
      console.error('Procedure access revocation failed:',error);
      setStatus('تعذر سحب الصلاحية. تحقق من قواعد Firestore المنشورة.',true);
    }
  }

  function openLawyerEdit(item,type){
    if(!item||!els.lawyerEditForm)return;
    els.lawyerEdit.dataset.type=type;els.lawyerEdit.hidden=false;
    els.lawyerEditTitle.textContent='تعديل بيانات '+(item.name||'المحامي');
    const f=els.lawyerEditForm;
    f.elements.id.value=item.id||'';
    f.elements.name.value=item.name||'';f.elements.governorate.value=item.governorate||'';f.elements.district.value=item.district||'';f.elements.phone.value=item.phone||'';f.elements.office.value=item.office||'';f.elements.address.value=item.address||'';f.elements.specializations.value=Array.isArray(item.specializations)?item.specializations.join('، '):String(item.specializations||'');f.elements.workingHours.value=item.workingHours||'';f.elements.description.value=item.description||'';f.elements.logoUrl.value=item.logoUrl||'';
    els.lawyerEdit.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function closeLawyerEdit(){if(els.lawyerEdit)els.lawyerEdit.hidden=true;}

  async function saveLawyerEdit(e){
    e.preventDefault();const f=e.currentTarget,id=f.elements.id.value,type=els.lawyerEdit.dataset.type;if(!id||!type)return;
    const data={name:String(f.elements.name.value||'').trim(),governorate:String(f.elements.governorate.value||'').trim(),district:String(f.elements.district.value||'').trim(),phone:String(f.elements.phone.value||'').trim(),office:String(f.elements.office.value||'').trim(),address:String(f.elements.address.value||'').trim(),specializations:String(f.elements.specializations.value||'').split(/[،,]/).map(v=>v.trim()).filter(Boolean).slice(0,10),workingHours:String(f.elements.workingHours.value||'').trim(),description:String(f.elements.description.value||'').trim(),logoUrl:String(f.elements.logoUrl?.value||'').trim(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
    if(!data.name||!data.governorate){setStatus('الاسم والمحافظة مطلوبان.',true);return;}
    try{
      const db=window.publicAuth.firestore;
      await db.collection(type==='profile'?'lawyerProfiles':'lawyerApplications').doc(id).update(data);
      if(type==='profile'){const appId=lawyerProfiles.find(p=>p.id===id)?.applicationId;if(appId)await db.collection('lawyerApplications').doc(appId).update({...data,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});}
      closeLawyerEdit();await loadLawyerManagement();if(window.lawyerDirectory?.load)window.lawyerDirectory.load();setStatus('تم حفظ تعديلات المحامي.',false);
    }catch(e){console.error(e);setStatus('تعذر حفظ تعديلات المحامي. تحقق من الصلاحيات.',true);}
  }

  async function approveLawyerEditRequest(request){
    if(!request||!confirm('هل تريد اعتماد تعديلات بيانات هذا المحامي ونشرها؟'))return;
    try{
      const db=window.publicAuth.firestore;
      const requestRef=db.collection('lawyerEditRequests').doc(request.id);
      const profileRef=db.collection('lawyerProfiles').doc(request.profileId);
      const applicationId=String(request.applicationId||'').trim();
      if(!applicationId)throw new Error('طلب التعديل لا يرتبط بطلب محامٍ صالح.');
      const applicationRef=db.collection('lawyerApplications').doc(applicationId);
      const allowedFields=['name','governorate','district','phone','office','address','specializations','workingHours','description','logoUrl'];

      await db.runTransaction(async transaction=>{
        const requestSnap=await transaction.get(requestRef);
        const profileSnap=await transaction.get(profileRef);
        const applicationSnap=await transaction.get(applicationRef);
        if(!requestSnap.exists||!profileSnap.exists||!applicationSnap.exists){
          throw new Error('تعذر العثور على الطلب أو الملف أو طلب المحامي المرتبط.');
        }

        const freshRequest=requestSnap.data()||{};
        const profile=profileSnap.data()||{};
        const application=applicationSnap.data()||{};
        if(String(freshRequest.status||'').toLowerCase()!=='pending'){
          throw new Error('تمت مراجعة هذا الطلب مسبقاً.');
        }
        if(freshRequest.profileId!==profileRef.id||freshRequest.applicationId!==applicationRef.id){
          throw new Error('معرّفات الطلب لا تتطابق مع السجلات المستهدفة.');
        }
        if(!freshRequest.applicantUid
          || freshRequest.applicantUid!==profile.applicantUid
          || freshRequest.applicantUid!==application.applicantUid
          || profile.applicationId!==applicationRef.id){
          throw new Error('ملكية طلب التعديل لا تطابق ملف المحامي وطلبه.');
        }

        const submitted=freshRequest.data&&typeof freshRequest.data==='object'?freshRequest.data:{};
        const updateData={};
        const stringFields=['name','governorate','district','phone','office','address','workingHours','description','logoUrl'];
        stringFields.forEach(key=>{
          if(!Object.prototype.hasOwnProperty.call(submitted,key))return;
          if(typeof submitted[key]!=='string')throw new Error('حقل غير صالح: '+key);
          updateData[key]=submitted[key].trim();
        });
        if(Object.prototype.hasOwnProperty.call(submitted,'specializations')){
          if(!Array.isArray(submitted.specializations)||!submitted.specializations.every(value=>typeof value==='string')){
            throw new Error('قائمة الاختصاصات غير صالحة.');
          }
          updateData.specializations=submitted.specializations.map(value=>value.trim()).filter(Boolean).slice(0,10);
        }
        if(!Object.keys(updateData).length)throw new Error('لا توجد حقول صالحة للتحديث.');
        if(!String(updateData.name||profile.name||'').trim()||!String(updateData.governorate||profile.governorate||'').trim()){
          throw new Error('اسم المحامي والمحافظة مطلوبان.');
        }
        updateData.updatedAt=firebase.firestore.FieldValue.serverTimestamp();

        transaction.update(profileRef,updateData);
        transaction.update(applicationRef,updateData);
        transaction.update(requestRef,{
          status:'approved',
          reviewedBy:window.publicAuth.user.uid,
          reviewedAt:firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt:firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      await loadLawyerManagement();
      if(window.lawyerDirectory?.load)window.lawyerDirectory.load();
      setStatus('تم اعتماد تعديل بيانات المحامي.',false);
    }catch(e){
      console.error('Lawyer edit request approval failed:',e);
      setStatus('تعذر اعتماد التعديل. تحقق من ارتباط الطلب بملف المحامي وطلبه الأصلي.',true);
    }
  }

  async function rejectLawyerEditRequest(request){
    if(!request||!confirm('هل تريد رفض طلب تعديل بيانات هذا المحامي؟'))return;
    try{
      await window.publicAuth.firestore.collection('lawyerEditRequests').doc(request.id).update({status:'rejected',reviewedBy:window.publicAuth.user.uid,reviewedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      await loadLawyerEditRequests();setStatus('تم رفض طلب التعديل.',false);
    }catch(e){console.error(e);setStatus('تعذر رفض التعديل.',true);}
  }

  async function deleteLawyerApplication(app){
    if(!app||!confirm('سيتم حذف طلب المحامي نهائياً. هل أنت متأكد؟'))return;
    try{await window.publicAuth.firestore.collection('lawyerApplications').doc(app.id).delete();await loadLawyerApplications();setStatus('تم حذف طلب المحامي.',false);}
    catch(e){console.error(e);setStatus('تعذر حذف الطلب.',true);}
  }

  async function toggleLawyerVisibility(profile){
    if(!profile)return;const next=!profile.published;
    if(!confirm(next?'إعادة تفعيل ظهور هذا المحامي للطلاب؟':'تعطيل ظهور هذا المحامي للطلاب؟'))return;
    try{await window.publicAuth.firestore.collection('lawyerProfiles').doc(profile.id).update({published:next,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});await loadLawyerProfiles();if(window.lawyerDirectory?.load)window.lawyerDirectory.load();setStatus(next?'تمت إعادة تفعيل ظهور المحامي.':'تم تعطيل ظهور المحامي دون حذف بياناته.',false);}
    catch(e){console.error(e);setStatus('تعذر تغيير حالة الظهور.',true);}
  }

  async function deleteLawyerProfile(profile){
    if(!profile||!confirm('سيتم حذف ملف المحامي من الدليل. هل تريد حذف معلوماته نهائياً؟'))return;
    try{
      const db=window.publicAuth.firestore;
      await db.collection('lawyerProfiles').doc(profile.id).delete();
      if(profile.applicationId)await db.collection('lawyerApplications').doc(profile.applicationId).delete();
      await loadLawyerManagement();if(window.lawyerDirectory?.load)window.lawyerDirectory.load();setStatus('تم حذف معلومات المحامي وطلبه نهائياً.',false);
    }catch(e){console.error(e);setStatus('تعذر حذف معلومات المحامي.',true);}
  }

  async function approveLawyer(app){
    if(!app||!confirm('هل تمت مراجعة بيانات المحامي وهوية النقابة المرسلة عبر واتساب/تلغرام والموافقة على نشر الملف؟'))return;
    try{
      const db=window.publicAuth.firestore;
      await db.collection('lawyerProfiles').doc(app.id).set({name:app.name,governorate:app.governorate||'',district:app.district||'',phone:app.phone||'',office:app.office||'',address:app.address||'',specializations:Array.isArray(app.specializations)?app.specializations:[],workingHours:app.workingHours||'',description:app.description||'',logoUrl:app.logoUrl||'',published:true,applicationId:app.id,applicantUid:app.applicantUid||'',approvedAt:firebase.firestore.FieldValue.serverTimestamp()});
      await db.collection('lawyerApplications').doc(app.id).update({status:'approved',approvedBy:window.publicAuth.user.uid,approvedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      await loadLawyerManagement();if(window.lawyerDirectory?.load)window.lawyerDirectory.load();setStatus('تم اعتماد المحامي ونشر بياناته العامة.',false);
    }catch(e){console.error(e);setStatus('تعذر اعتماد الطلب.',true);}
  }
  async function rejectLawyer(app){
    if(!app||!confirm('هل تريد رفض هذا الطلب؟'))return;
    try{await window.publicAuth.firestore.collection('lawyerApplications').doc(app.id).update({status:'rejected',rejectedBy:window.publicAuth.user.uid,rejectedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});await loadLawyerApplications();setStatus('تم رفض الطلب ولم تُنشر بياناته.',false);}
    catch(e){console.error(e);setStatus('تعذر رفض الطلب.',true);}
  }
  async function syncAdminState(){
    buildUI();
    if(!window.publicAuth||!window.publicAuth.user){
      isAdmin=false;
      if(panelOpen)closePanel();
      showTab(false);
      publishAdminState();
      return;
    }
    // Auth can become ready before the Firestore SDK finishes loading.
    // Wait for Firestore before checking admins/{uid}, otherwise the crown
    // can be hidden during the first page load and never checked again.
    if(typeof window.publicAuth.whenFirestoreReady==='function'){
      try{await window.publicAuth.whenFirestoreReady();}catch(error){console.warn('تعذر تهيئة Firestore للتحقق من الإدارة:',error);}
    }
    const user=window.publicAuth.user;
    const allowed=await checkAdmin(user);
    isAdmin=allowed;
    showTab(allowed);
    publishAdminState();
    if(!allowed&&panelOpen)closePanel();
    if(allowed&&els.welcome)els.welcome.textContent=`مرحباً ${user.displayName||user.email||'المدير'} — تم التحقق من صلاحية الإدارة.`;
  }
  function install(){buildUI();publishAdminState();window.addEventListener('mizan:before-navigate',event=>{if(event.detail?.viewId!=='firebase-admin'&&panelOpen)closePanel(true);});if(!window.publicAuth)return;window.publicAuth.whenReady().then(syncAdminState).catch(syncAdminState);window.addEventListener('public-auth-state-changed',syncAdminState);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();