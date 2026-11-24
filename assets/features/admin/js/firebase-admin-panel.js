/* Firebase admin tab for the student SPA. Visible only to users listed as admins/{uid}. */
(function () {
  'use strict';
  let isAdmin=false,panelOpen=false,mainViewState=[],els={};
  let lawyerApplications=[],lawyerProfiles=[];
  let petitionItems=[],activePetitionCategory='',activePetitionStatus='published',petitionCategoryCounts={};
  let procedureItems=[],activeProcedureAdminCategory='',activeProcedureAdminStatus='published',procedureCategoryCounts={};
  const procedureGrantCache=new Map(),petitionGrantCache=new Map();
  const ADMIN_PAGE_SIZE=50;
  const adminPageStates=new Map();
  function resetAdminPage(key){adminPageStates.set(key,{cursor:null,hasMore:true,loading:false,items:[]});}
  async function fetchAdminPage(key,queryFactory,reset=false){
    if(reset||!adminPageStates.has(key))resetAdminPage(key);
    const state=adminPageStates.get(key);
    if(state.loading||!state.hasMore)return {docs:[],items:state.items,hasMore:state.hasMore};
    state.loading=true;
    try{
      let query=queryFactory();
      if(state.cursor)query=query.startAfter(state.cursor);
      const snapshot=await query.limit(ADMIN_PAGE_SIZE).get();
      const docs=snapshot.docs||[];
      state.cursor=docs.length?docs[docs.length-1]:state.cursor;
      state.hasMore=docs.length===ADMIN_PAGE_SIZE;
      state.items.push(...docs);
      return {docs,items:state.items,hasMore:state.hasMore};
    }finally{state.loading=false;}
  }
  async function exactQueryCount(collectionName,filters=[]){
    if(typeof window.mizanFirestoreCount!=='function'){
      window.mizanFirestoreCountReady ||= import(new URL('assets/shared/js/firestore-count.mjs?v=4.01',document.baseURI).href).then(()=>true);
      await window.mizanFirestoreCountReady;
    }
    if(typeof window.mizanFirestoreCount!=='function')throw new Error('Firestore count module failed to initialize.');
    return window.mizanFirestoreCount(collectionName,filters);
  }
  window.mizanExactFirestoreCount=exactQueryCount;
  async function safeQueryCount(collectionName,filters=[]){
    try{
      return await exactQueryCount(collectionName,filters);
    }catch(error){
      console.warn('Admin count unavailable:',collectionName,error);
      return null;
    }
  }
  function setAdminLoadMore(body,key,loader){
    body.querySelector('[data-admin-load-more]')?.remove();
    const state=adminPageStates.get(key);
    if(!state?.hasMore)return;
    const wrapper=document.createElement('div');
    wrapper.className='firebase-admin-load-more lawyer-admin-actions';
    wrapper.dataset.adminLoadMore='1';
    const button=document.createElement('button');
    button.type='button';button.className='approve';button.textContent='تحميل المزيد';
    button.addEventListener('click',async()=>{
      if(button.disabled)return;
      button.disabled=true;button.textContent='جارٍ التحميل...';
      await loader(false);
    });
    wrapper.appendChild(button);body.appendChild(wrapper);
  }
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
    if(!document.querySelector('link[data-lawyer-admin-css]')){const css=document.createElement('link');css.rel='stylesheet';css.href='assets/features/lawyers/css/lawyer-admin.css?v=1.41';css.dataset.lawyerAdminCss='1';document.head.appendChild(css);}
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
<button type="button" class="firebase-admin-nav-item" data-admin-view="judicial-answers"><i class="fas fa-book-open" aria-hidden="true"></i><span>أسئلة وأجوبة المعهد القضائي</span><span class="firebase-admin-nav-count" id="fa-nav-judicial-answers-count" hidden>0</span></button>
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
<button type="button" class="firebase-admin-shortcut" data-admin-view="judicial-answers"><span><i class="fas fa-book-open" aria-hidden="true"></i></span><strong>أسئلة وأجوبة المعهد القضائي</strong><small>إضافة الأسئلة والحلول وإدارة النشر</small><i class="fas fa-arrow-left firebase-admin-shortcut-arrow" aria-hidden="true"></i></button>
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
        <div class="lawyer-admin-list-page"><div class="lawyer-admin-list-page-head"><div><span>مراجعة الطلبات</span><h3>طلبات الانضمام إلى الدليل</h3><p>راجع بيانات المتقدمين واتخذ إجراء الاعتماد أو الرفض من بطاقة كل طلب.</p></div></div><div id="fa-lawyers-body" class="firebase-admin-record-list lawyer-admin-record-list"><p class="firebase-admin-list-state">جارٍ التحميل...</p></div></div>
      </div>
      <div id="fa-lawyers-edit-requests-panel" hidden>
        <div class="lawyer-admin-list-page"><div class="lawyer-admin-list-page-head"><div><span>مراجعة التغييرات</span><h3>طلبات تعديل بيانات المحامين</h3><p>تظهر هنا التعديلات المعلقة للمراجعة قبل تحديث الملف المنشور.</p></div></div><div id="fa-lawyer-edit-requests-body" class="firebase-admin-record-list lawyer-admin-record-list"><p class="firebase-admin-list-state">جارٍ التحميل...</p></div></div>
      </div>
      <div id="fa-lawyers-published-panel" hidden>
        <div class="lawyer-admin-list-page"><div class="lawyer-admin-list-page-head"><div><span>دليل المحامين</span><h3>قائمة المحامين المنشورين</h3><p>إدارة ملفات المحامين المنشورة والتحكم في ظهورها وتحديث بياناتها.</p></div><span class="lawyer-admin-list-page-count"><i class="fas fa-users" aria-hidden="true"></i> <strong id="fa-lawyers-published-total">0</strong> ملف</span></div><div id="fa-lawyers-published-body" class="firebase-admin-record-list lawyer-admin-record-list"><p class="firebase-admin-list-state">جارٍ التحميل...</p></div></div>
      </div>
      <div id="fa-lawyer-edit" class="lawyer-admin-edit" hidden>
        <div class="firebase-admin-card-head"><h3 id="fa-lawyer-edit-title">تعديل بيانات المحامي</h3><button id="fa-lawyer-edit-close" type="button">×</button></div>
        <form id="fa-lawyer-edit-form">
          <input type="hidden" name="id">
          <div class="lawyer-admin-form-grid">
            <label class="lawyer-admin-field"><span>اسم المحامي</span><input name="name" required autocomplete="name"></label>
            <label class="lawyer-admin-field"><span>المحافظة</span><input name="governorate" required></label>
            <label class="lawyer-admin-field"><span>القضاء / المنطقة</span><input name="district"></label>
            <label class="lawyer-admin-field"><span>رقم الهاتف</span><input name="phone" inputmode="tel" autocomplete="tel"></label>
            <label class="lawyer-admin-field"><span>اسم المكتب</span><input name="office"></label>
            <label class="lawyer-admin-field"><span>عنوان المكتب</span><input name="address" autocomplete="street-address"></label>
            <label class="lawyer-admin-field"><span>الاختصاصات</span><input name="specializations"></label>
            <label class="lawyer-admin-field"><span>ساعات العمل</span><input name="workingHours"></label>
            <label class="lawyer-admin-field full"><span>الوصف</span><textarea name="description" rows="4"></textarea></label>
            <label class="lawyer-admin-field full"><span>رابط شعار المحامي</span><input name="logoUrl" type="url" inputmode="url" placeholder="https://.../logo.png"></label>
          </div>
          <div class="lawyer-admin-form-actions">
             <button type="submit" class="lawyer-admin-save">حفظ التعديلات</button>
             <button id="fa-lawyer-edit-cancel" type="button" class="lawyer-admin-cancel">إلغاء</button>
           </div>
        </form>
      </div>
      <p class="lawyer-admin-note"><i class="fas fa-shield-halved"></i> هوية النقابة لا تُخزّن داخل المنصة. يرسلها المتقدم مباشرة للأدمن عبر واتساب أو تلغرام، ثم تتم مطابقة الهوية مع الطلب قبل النشر.</p>
    </section>
    <section id="fa-admin-view-procedures" class="firebase-admin-subview"><button type="button" class="firebase-admin-subview-back" data-admin-home>← العودة لأقسام الإدارة</button><div class="firebase-admin-content-hub" data-procedure-admin-hub>
<div class="firebase-admin-content-hub-head"><h3>إدارة إجراءات الدعاوى</h3><p>إدارة الصلاحيات والإجراءات القانونية حسب تصنيف الدعوى وحالة النشر.</p></div>
<div class="firebase-admin-content-actions" role="group" aria-label="أقسام إدارة إجراءات الدعاوى">
<button type="button" class="firebase-admin-content-action is-active" data-procedures-panel="access" aria-pressed="true"><span class="firebase-admin-content-action-icon"><i class="fas fa-user-shield"></i></span><span class="firebase-admin-content-action-copy"><strong>طلبات الوصول</strong><small>مراجعة طلبات الصلاحيات</small></span><span class="firebase-admin-content-action-count" id="fa-procedures-access-card-count" hidden>0</span></button>
<button type="button" class="firebase-admin-content-action" data-procedures-panel="add" aria-pressed="false"><span class="firebase-admin-content-action-icon"><i class="fas fa-file-circle-plus"></i></span><span class="firebase-admin-content-action-copy"><strong>إضافة إجراء</strong><small>إنشاء إجراء جديد أو تعديل إجراء</small></span></button>
<button type="button" class="firebase-admin-content-action" data-procedures-panel="library" aria-pressed="false"><span class="firebase-admin-content-action-icon"><i class="fas fa-folder-open"></i></span><span class="firebase-admin-content-action-copy"><strong>مكتبة الإجراءات</strong><small>التصنيفات والإجراءات المنشورة والمسودات</small></span><span class="firebase-admin-content-action-count" id="fa-procedures-total-count">0</span></button></div>
<section class="firebase-admin-content-panel" id="fa-procedures-panel-access"><div class="firebase-admin-card lawyer-admin-card"><div class="firebase-admin-card-head"><h3>طلبات الوصول إلى إجراءات الدعاوى <span class="firebase-admin-inline-count" id="fa-procedures-access-count" hidden>0</span></h3><span>الموافقة اليدوية وإدارة الصلاحيات</span></div><p class="lawyer-admin-note">تابع الطلبات المعلقة، والصلاحيات المسحوبة، والمستخدمين الذين ما زالت صلاحياتهم مفعّلة.</p><div class="lawyer-admin-tabs" role="group" aria-label="تصنيف صلاحيات إجراءات الدعاوى"><button type="button" class="lawyer-admin-tab active" data-procedure-access-view="pending">الطلبات المعلقة <span id="fa-procedures-pending-count">0</span></button><button type="button" class="lawyer-admin-tab" data-procedure-access-view="revoked">الصلاحيات المسحوبة <span id="fa-procedures-revoked-count">0</span></button><button type="button" class="lawyer-admin-tab" data-procedure-access-view="active">الصلاحيات المفعّلة <span id="fa-procedures-enabled-count">0</span></button></div><div id="fa-procedures-requests-body" class="firebase-admin-record-list"><p class="firebase-admin-list-state">اختر هذا القسم لتحميل الطلبات.</p></div></div></section>
<section class="firebase-admin-content-panel" id="fa-procedures-panel-add" hidden><div class="firebase-admin-card lawyer-admin-card procedures-admin-management"><div class="firebase-admin-card-head"><h3 id="fa-procedure-form-title">إضافة إجراء جديد</h3><span>التفاصيل والفهرس في Firebase</span></div><form id="fa-procedure-form" class="procedures-admin-form"><input type="hidden" name="id"><label>عنوان الإجراء *<input name="title" required maxlength="180"></label><label>تصنيف الدعوى *<select name="category" required><option value="">اختر تصنيف الدعوى</option><option value="civil">الدعاوى المدنية</option><option value="criminal">الدعاوى الجزائية</option><option value="administrative">الدعاوى الإدارية</option><option value="personal">دعاوى الأحوال الشخصية</option></select></label><label>نبذة عن الإجراء<textarea name="summary" rows="2" maxlength="2000"></textarea></label><label>الشروط والاختصاص<textarea name="requirements" rows="3"></textarea></label><label>المستندات المطلوبة<textarea name="documents" rows="3"></textarea></label><label>خطوات الإجراء<textarea name="steps" rows="5"></textarea></label><label>السند القانوني<textarea name="legalBasis" rows="3"></textarea></label><label>الرسوم<input name="fees" maxlength="500"></label><label>المدد القانونية أو المتوقعة<input name="duration" maxlength="500"></label><label><input type="checkbox" name="published" checked> نشر الإجراء وإظهاره في الفهرس</label><div class="lawyer-admin-actions"><button class="approve" type="submit">حفظ الإجراء</button><button type="button" id="fa-procedure-reset">جديد / إلغاء التعديل</button></div><p class="lawyer-admin-note">تُحدّث قائمة العناوين المنشورة تلقائياً في Firebase عند حفظ الإجراء أو نشره أو إخفائه أو حذفه، ولا تُحمّل تفاصيل الإجراءات إلا عند فتحها.</p></form></div></section>
<section class="firebase-admin-content-panel" id="fa-procedures-panel-library" hidden><div class="firebase-admin-card lawyer-admin-card"><div class="firebase-admin-card-head"><h3>مكتبة إجراءات الدعاوى</h3><span id="fa-procedures-library-summary">التصنيفات الأربعة</span></div><div id="fa-procedures-categories" class="firebase-admin-content-categories"><p class="firebase-admin-list-state">اختر المكتبة لتحميل الإجراءات.</p></div><div id="fa-procedures-category-view" class="firebase-admin-content-category-view" hidden><button type="button" class="firebase-admin-content-back" data-procedures-categories>← جميع التصنيفات</button><div class="firebase-admin-content-category-heading"><h4 id="fa-procedures-category-title"></h4><span id="fa-procedures-category-total"></span></div><div class="firebase-admin-content-status-tabs" role="tablist" aria-label="حالة الإجراءات"><button type="button" class="is-active" data-procedure-admin-status="published" role="tab" aria-selected="true">الإجراءات المنشورة <span id="fa-procedures-published-count">0</span></button><button type="button" data-procedure-admin-status="unpublished" role="tab" aria-selected="false">الإجراءات غير المنشورة <span id="fa-procedures-unpublished-count">0</span></button></div><div id="fa-procedures-category-items" class="firebase-admin-content-items"></div></div></div></section>
</div></section>    <section id="fa-admin-view-petitions" class="firebase-admin-subview">
      <button type="button" class="firebase-admin-subview-back" data-admin-home>← العودة لأقسام الإدارة</button>
      <div class="firebase-admin-content-hub">
        <div class="firebase-admin-content-hub-head">
          <h3>إدارة العرائض والطلبات</h3>
          <p>إدارة الصلاحيات وإضافة النماذج وتنظيمها حسب التصنيف وحالة النشر.</p>
        </div>
        <div class="firebase-admin-content-actions" role="group" aria-label="أقسام إدارة العرائض">
          <button type="button" class="firebase-admin-content-action is-active" data-petitions-panel="access" aria-pressed="true">
            <span class="firebase-admin-content-action-icon"><i class="fas fa-user-shield" aria-hidden="true"></i></span>
            <span class="firebase-admin-content-action-copy"><strong>طلبات الوصول</strong><small>مراجعة طلبات الصلاحيات</small></span>
            <span class="firebase-admin-content-action-count" id="fa-petitions-access-card-count" hidden>0</span>
          </button>
          <button type="button" class="firebase-admin-content-action" data-petitions-panel="add" aria-pressed="false">
            <span class="firebase-admin-content-action-icon"><i class="fas fa-file-circle-plus" aria-hidden="true"></i></span>
            <span class="firebase-admin-content-action-copy"><strong>إضافة عريضة</strong><small>إنشاء نموذج جديد أو تعديل نموذج</small></span>
          </button>
          <button type="button" class="firebase-admin-content-action" data-petitions-panel="library" aria-pressed="false">
            <span class="firebase-admin-content-action-icon"><i class="fas fa-folder-open" aria-hidden="true"></i></span>
            <span class="firebase-admin-content-action-copy"><strong>نماذج العرائض</strong><small>التصنيفات والنماذج المنشورة والمسودات</small></span>
            <span class="firebase-admin-content-action-count" id="fa-petitions-total-count">0</span>
          </button>
        </div>
        <section class="firebase-admin-petitions-panel" id="fa-petitions-panel-access">
          <div class="firebase-admin-card lawyer-admin-card">
            <div class="firebase-admin-card-head"><h3>طلبات الوصول إلى العرائض <span class="firebase-admin-inline-count" id="fa-petitions-access-count" hidden>0</span></h3><span>موافقة دائمة قابلة للسحب</span></div>
            <p class="lawyer-admin-note">تابع الطلبات المعلقة، والصلاحيات المسحوبة، والمستخدمين الذين ما زالت صلاحياتهم مفعّلة.</p>
            <div class="lawyer-admin-tabs" role="group" aria-label="تصنيف صلاحيات العرائض"><button type="button" class="lawyer-admin-tab active" data-petition-access-view="pending">الطلبات المعلقة <span id="fa-petitions-pending-count">0</span></button><button type="button" class="lawyer-admin-tab" data-petition-access-view="revoked">الصلاحيات المسحوبة <span id="fa-petitions-revoked-count">0</span></button><button type="button" class="lawyer-admin-tab" data-petition-access-view="active">الصلاحيات المفعّلة <span id="fa-petitions-enabled-count">0</span></button></div>
            <div id="fa-petitions-requests-body" class="firebase-admin-record-list"><p class="firebase-admin-list-state">اختر هذا القسم لتحميل الطلبات.</p></div>
          </div>
        </section>
        <section class="firebase-admin-petitions-panel" id="fa-petitions-panel-add" hidden>
          <div class="firebase-admin-card lawyer-admin-card procedures-admin-management">
            <div class="firebase-admin-card-head"><h3 id="fa-petition-form-title">إضافة عريضة جديدة</h3><span>تخزين النصوص في Firestore</span></div>
            <form id="fa-petition-form" class="procedures-admin-form">
              <input type="hidden" name="id">
              <label>عنوان العريضة *<input name="title" required maxlength="180"></label>
              <label>التصنيف *<select name="category" required><option value="">اختر التصنيف</option><option value="family">عرائض أحوال شخصية</option><option value="civil">عرائض البداءة (الدعاوى المدنية)</option><option value="criminal">عرائض جزائية وتحقيق</option><option value="administrative">عرائض إدارية</option></select></label>
              <label>وصف مختصر<input name="description" maxlength="1000"></label>
              <label>الأيقونة (اختياري)<input name="icon" maxlength="100" value="fas fa-file-signature"></label>
              <label>نص العريضة *<textarea name="body" rows="12" required maxlength="50000"></textarea></label>
              <label><input type="checkbox" name="published" checked> نشر العريضة وإظهار عنوانها للمصرّح لهم</label>
              <div class="lawyer-admin-actions"><button class="approve" type="submit">حفظ العريضة</button><button type="button" id="fa-petition-reset">جديد / إلغاء التعديل</button></div>
              <p class="lawyer-admin-note">النص الكامل محفوظ في Firestore، وتظهر العناوين فقط في مكتبة النماذج.</p>
            </form>
          </div>
        </section>
        <section class="firebase-admin-petitions-panel" id="fa-petitions-panel-library" hidden>
          <div class="firebase-admin-card lawyer-admin-card">
            <div class="firebase-admin-card-head"><h3>مكتبة نماذج العرائض</h3><span id="fa-petitions-library-summary">التصنيفات الأربعة</span></div>
            <div id="fa-petitions-categories" class="firebase-admin-content-categories"><p class="firebase-admin-list-state">اختر المكتبة لتحميل النماذج.</p></div>
            <div id="fa-petitions-category-view" class="firebase-admin-content-category-view" hidden>
              <button type="button" class="firebase-admin-content-back" data-petitions-categories><i class="fas fa-arrow-right" aria-hidden="true"></i> جميع التصنيفات</button>
              <div class="firebase-admin-content-category-heading"><h4 id="fa-petitions-category-title"></h4><span id="fa-petitions-category-total"></span></div>
              <div class="firebase-admin-content-status-tabs" role="tablist" aria-label="حالة النماذج">
                <button type="button" class="is-active" data-petition-status="published" role="tab" aria-selected="true">العرائض المنشورة <span id="fa-petitions-published-count">0</span></button>
                <button type="button" data-petition-status="unpublished" role="tab" aria-selected="false">العرائض غير المنشورة <span id="fa-petitions-unpublished-count">0</span></button>
              </div>
              <div id="fa-petitions-category-items" class="firebase-admin-content-items"><p class="firebase-admin-list-state">لا توجد نماذج في هذا القسم.</p></div>
            </div>
          </div>
        </section>
      </div>
    </section>
    <section id="fa-admin-view-judicial-answers" class="firebase-admin-subview" hidden>
      <button type="button" class="firebase-admin-subview-back" data-admin-home>← العودة لأقسام الإدارة</button>
      <div class="firebase-admin-card lawyer-admin-card">
        <div class="firebase-admin-card-head"><h3>طلبات الوصول إلى الموسوعة</h3><span id="fa-judicial-access-count">0 طلب معلق</span></div>
        <div class="firebase-admin-access-tabs"><button type="button" data-judicial-access-view="pending" class="active">المعلقة</button><button type="button" data-judicial-access-view="active">الصلاحيات المفعّلة</button><button type="button" data-judicial-access-view="revoked">المرفوضة / المسحوبة</button></div>
        <div id="fa-judicial-access-requests" class="firebase-admin-record-list"><p class="firebase-admin-list-state">اختر القسم لتحميل الطلبات.</p></div>
      </div>
      <div class="firebase-admin-card lawyer-admin-card" style="margin-top:16px">
        <div class="firebase-admin-card-head"><h3>إدارة أسئلة وأجوبة المعهد القضائي</h3><span>المحتوى المنشور يظهر للطلاب فقط</span></div>
        <div class="procedures-admin-form" style="margin-bottom:16px">
          <form id="fa-judicial-subject-form">
            <label>إضافة مادة قانونية جديدة *<input name="name" required maxlength="160" placeholder="اكتب اسم المادة القانونية"></label>
            <div class="lawyer-admin-actions"><button class="approve" type="submit">إضافة المادة</button></div>
          </form>
          <div id="fa-judicial-subjects-list" class="firebase-admin-record-list"><p class="firebase-admin-list-state">جارٍ تحميل المواد...</p></div>
        </div>
        <form id="fa-judicial-answer-form" class="procedures-admin-form">
          <input type="hidden" name="id">
          <label>المادة القانونية *<select name="subjectId" required><option value="">اختر المادة القانونية</option></select></label>
          <label>تصنيف السؤال<select name="type"><option value="theoretical">سؤال نظري</option><option value="practical">واقعة عملية</option><option value="topic">موضوع قانوني</option></select></label>
          <label>السؤال *<textarea name="question" required rows="4" maxlength="12000"></textarea></label>
          <label>الإجابة / الحل *<textarea name="answer" required rows="7" maxlength="24000"></textarea></label>
          <label>المصدر أو رقم الصفحة<input name="source" maxlength="500" placeholder="اسم الملف ورقم الصفحة إن وجد"></label>
          <label><input type="checkbox" name="published"> نشر السؤال والإجابة للطلاب</label>
          <div class="lawyer-admin-actions"><button class="approve" type="submit">حفظ السؤال والإجابة</button><button type="button" id="fa-judicial-answer-reset">إلغاء / سؤال جديد</button></div>
          <p class="lawyer-admin-note">لا تُضاف هذه الأسئلة إلى بنك أسئلة امتحان القبول. تبقى ضمن موسوعة الأسئلة والأجوبة المستقلة.</p>
        </form>
      </div>
      <div class="firebase-admin-card lawyer-admin-card" style="margin-top:16px">
        <div class="firebase-admin-card-head"><h3>المحتوى المضاف</h3><span id="fa-judicial-answers-count">0 سؤال</span></div>
        <div id="fa-judicial-answers-list" class="firebase-admin-record-list"><p class="firebase-admin-list-state">اختر القسم لتحميل الأسئلة.</p></div>
      </div>
    </section></div>
    </div></div>`
    const footer=document.querySelector('footer');if(footer&&footer.parentNode)footer.parentNode.insertBefore(section,footer);else document.body.appendChild(section);
    els={tab,section,status:section.querySelector('#firebase-admin-status'),welcome:section.querySelector('#firebase-admin-welcome'),refresh:section.querySelector('#firebase-admin-refresh'),back:section.querySelector('#firebase-admin-back'),studentsCount:section.querySelector('#fa-students-count'),studentsUpdated:section.querySelector('#fa-students-updated'),studentsBody:section.querySelector('#fa-students-body'),proceduresRequestsBody:section.querySelector('#fa-procedures-requests-body'),procedureForm:section.querySelector('#fa-procedure-form'),procedureReset:section.querySelector('#fa-procedure-reset'),proceduresHub:section.querySelector('#fa-admin-view-procedures .firebase-admin-content-hub'),proceduresAccessCardCount:section.querySelector('#fa-procedures-access-card-count'),proceduresTotalCount:section.querySelector('#fa-procedures-total-count'),proceduresCategories:section.querySelector('#fa-procedures-categories'),proceduresCategoryView:section.querySelector('#fa-procedures-category-view'),proceduresCategoryTitle:section.querySelector('#fa-procedures-category-title'),proceduresCategoryTotal:section.querySelector('#fa-procedures-category-total'),proceduresCategoryItems:section.querySelector('#fa-procedures-category-items'),proceduresLibrarySummary:section.querySelector('#fa-procedures-library-summary'),procedureFormTitle:section.querySelector('#fa-procedure-form-title'),petitionsRequestsBody:section.querySelector('#fa-petitions-requests-body'),petitionForm:section.querySelector('#fa-petition-form'),petitionReset:section.querySelector('#fa-petition-reset'),petitionsHub:section.querySelector('#fa-admin-view-petitions .firebase-admin-content-hub'),petitionsAccessCardCount:section.querySelector('#fa-petitions-access-card-count'),petitionsTotalCount:section.querySelector('#fa-petitions-total-count'),petitionsCategories:section.querySelector('#fa-petitions-categories'),petitionsCategoryView:section.querySelector('#fa-petitions-category-view'),petitionsCategoryTitle:section.querySelector('#fa-petitions-category-title'),petitionsCategoryTotal:section.querySelector('#fa-petitions-category-total'),petitionsCategoryItems:section.querySelector('#fa-petitions-category-items'),petitionsLibrarySummary:section.querySelector('#fa-petitions-library-summary'),petitionFormTitle:section.querySelector('#fa-petition-form-title'),judicialSubjectForm:section.querySelector('#fa-judicial-subject-form'),judicialSubjectsList:section.querySelector('#fa-judicial-subjects-list'),judicialAnswerForm:section.querySelector('#fa-judicial-answer-form'),judicialAnswerReset:section.querySelector('#fa-judicial-answer-reset'),judicialAnswersList:section.querySelector('#fa-judicial-answers-list'),judicialAnswersCount:section.querySelector('#fa-judicial-answers-count'),judicialAccessRequests:section.querySelector('#fa-judicial-access-requests'),judicialAccessCount:section.querySelector('#fa-judicial-access-count'),navJudicialAnswersCount:section.querySelector('#fa-nav-judicial-answers-count'),lawyersBody:section.querySelector('#fa-lawyers-body'),lawyersPublishedBody:section.querySelector('#fa-lawyers-published-body'),lawyersPendingCount:section.querySelector('#fa-lawyers-pending-count'),lawyersPublishedCount:section.querySelector('#fa-lawyers-published-count'),lawyerEditRequestsBody:section.querySelector('#fa-lawyer-edit-requests-body'),lawyerEditRequestsCount:section.querySelector('#fa-lawyer-edit-requests-count'),lawyerEdit:section.querySelector('#fa-lawyer-edit'),lawyerEditForm:section.querySelector('#fa-lawyer-edit-form'),lawyerEditTitle:section.querySelector('#fa-lawyer-edit-title'),lawyerEditClose:section.querySelector('#fa-lawyer-edit-close'),lawyerEditCancel:section.querySelector('#fa-lawyer-edit-cancel'),dashboardStudentsCount:section.querySelector('#fa-dashboard-students-count'),dashboardLawyerPending:section.querySelector('#fa-dashboard-lawyer-pending'),dashboardLawyerPublished:section.querySelector('#fa-dashboard-lawyer-published'),dashboardLawyerEdits:section.querySelector('#fa-dashboard-lawyer-edits'),navLawyersCount:section.querySelector('#fa-nav-lawyers-count'),navProceduresCount:section.querySelector('#fa-nav-procedures-count'),navPetitionsCount:section.querySelector('#fa-nav-petitions-count'),proceduresAccessCount:section.querySelector('#fa-procedures-access-count'),petitionsAccessCount:section.querySelector('#fa-petitions-access-count'),navToggle:section.querySelector('#firebase-admin-nav-toggle'),sidebarBackdrop:section.querySelector('#firebase-admin-sidebar-backdrop')};

    els.refresh?.addEventListener('click',loadDashboard);els.back?.addEventListener('click',closePanel);els.navToggle?.addEventListener('click',()=>toggleMobileSidebar());els.sidebarBackdrop?.addEventListener('click',()=>toggleMobileSidebar(false));els.section.querySelector('#fa-admin-navigation')?.addEventListener('click',event=>{if(event.target.closest('.firebase-admin-nav-item'))toggleMobileSidebar(false);});document.addEventListener('keydown',event=>{if(event.key==='Escape')toggleMobileSidebar(false);});
    els.section.querySelectorAll('[data-admin-view]').forEach(btn=>btn.addEventListener('click',()=>switchAdminView(btn.dataset.adminView)));
    els.section.querySelectorAll('[data-admin-home]').forEach(btn=>btn.addEventListener('click',showAdminHome));
els.lawyerEditClose?.addEventListener('click',closeLawyerEdit);els.lawyerEditCancel?.addEventListener('click',closeLawyerEdit);els.lawyerEditForm?.addEventListener('submit',saveLawyerEdit);
els.section.querySelectorAll('[data-lawyer-view]').forEach(btn=>btn.addEventListener('click',()=>switchLawyerView(btn.dataset.lawyerView)));
     els.procedureForm?.addEventListener('submit',saveLegalProcedure);els.procedureReset?.addEventListener('click',resetLegalProcedure);els.petitionForm?.addEventListener('submit',savePetition);els.petitionReset?.addEventListener('click',()=>{resetPetition();setPetitionPanel('add');});
     els.petitionsHub?.addEventListener('click',handlePetitionHubClick);els.proceduresHub?.addEventListener('click',handleProcedureHubClick);els.judicialSubjectForm?.addEventListener('submit',saveJudicialSubject);els.judicialAnswerForm?.addEventListener('submit',saveJudicialAnswer);els.judicialAnswerReset?.addEventListener('click',resetJudicialAnswer);els.judicialAnswersList?.addEventListener('click',handleJudicialAnswerAction);els.judicialAccessRequests?.addEventListener('click',handleJudicialAccessAction);els.section.querySelectorAll('[data-judicial-access-view]').forEach(button=>button.addEventListener('click',()=>{activeJudicialAccessView=button.dataset.judicialAccessView;els.section.querySelectorAll('[data-judicial-access-view]').forEach(item=>item.classList.toggle('active',item===button));loadJudicialAccessRequests();}));
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
    if(view==='procedures'){loadProcedureAccessRequests();loadLegalProcedures();}if(view==='petitions'){loadPetitionAccessRequests();loadPetitions();}if(view==='judicial-answers'){loadJudicialAccessRequests();loadJudicialSubjects();loadJudicialAnswers();}
  }
  function setPendingCount(key,count){
    const value=count===null?'—':String(Math.max(0,Number(count)||0));
    const targets={
      lawyers:[els.navLawyersCount,...els.section.querySelectorAll('[data-admin-count="lawyers"]')],
      procedures:[els.navProceduresCount,els.proceduresAccessCount,els.proceduresAccessCardCount,...els.section.querySelectorAll('[data-admin-count="procedures"]')],
      petitions:[els.navPetitionsCount,els.petitionsAccessCount,els.petitionsAccessCardCount,...els.section.querySelectorAll('[data-admin-count="petitions"]')]
    }[key]||[];
    targets.forEach(node=>{if(!node)return;node.textContent=value;node.hidden=value==='0';});
  }
  async function refreshPendingAdminCounts(){
    if(!isAdmin||!window.publicAuth?.firestore||!els.section)return;
    try{
      const [procedureCount,petitionCount]=await Promise.all([
        safeQueryCount('procedureAccessRequests',[['status','==','pending']]),
        safeQueryCount('petitionAccessRequests',[['status','==','pending']])
      ]);
      const lawyerPending=els.lawyersPendingCount?.textContent||'—';
      const lawyerEdits=els.lawyerEditRequestsCount?.textContent||'—';
      const lawyerCount=lawyerPending==='—'||lawyerEdits==='—'?null:(Number(lawyerPending)||0)+(Number(lawyerEdits)||0);
      setPendingCount('lawyers',lawyerCount);
      setPendingCount('procedures',procedureCount);
      setPendingCount('petitions',petitionCount);
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
  async function checkAdmin(user){if(!user)return false;const verified=window.mizanAdminAccess;if(verified?.verified===true&&verified.uid===user.uid)return true;if(!window.publicAuth?.firestore)return false;try{const snap=await window.publicAuth.firestore.collection('admins').doc(user.uid).get();const data=snap.exists?snap.data():null;return Boolean(data&&data.role==='admin'&&data.enabled!==false);}catch(e){console.warn('تعذر التحقق من صلاحية admin:',e);return false;}}
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
  async function loadStudentPage(reset=true){
    const db=window.publicAuth?.firestore,body=els.studentsBody;
    if(!isAdmin||!db||!body)return;
    const key='students';
    try{
      const page=await fetchAdminPage(key,()=>db.collection('students').orderBy('createdAt','desc'),reset);
      const html=page.docs.map(doc=>{
        const student=doc.data()||{};
        return '<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">طالب مسجل</span><h4>'+esc(student.displayName||'بدون اسم')+'</h4></div></div><div class="firebase-admin-record-field"><span>البريد الإلكتروني</span><strong>'+esc(student.email||'غير متوفر')+'</strong></div><div class="firebase-admin-record-meta">تاريخ التسجيل: '+esc(dateValue(student.createdAt))+'</div></article>';
      }).join('');
      if(reset)body.innerHTML='';
      if(html)body.insertAdjacentHTML('beforeend',html);
      if(reset&&!page.docs.length)body.innerHTML='<p class="firebase-admin-list-state">لا يوجد طلاب مسجلون.</p>';
      setAdminLoadMore(body,key,loadStudentPage);
    }catch(error){console.error('Students page load failed:',error);if(reset)body.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل بيانات الطلاب.</p>';}
  }
  async function loadDashboard(){
    if(!isAdmin||!window.publicAuth?.firestore)return;
    setStatus('جارٍ تحميل بيانات الإدارة...');
    try{
      const studentsTotal=await safeQueryCount('students');
      els.studentsCount.textContent=studentsTotal===null?'—':String(studentsTotal);
      if(els.dashboardStudentsCount)els.dashboardStudentsCount.textContent=studentsTotal===null?'—':String(studentsTotal);
      await loadStudentPage(true);
      els.studentsUpdated.textContent=timeValue(new Date());
      await loadLawyerManagement();
      if(els.dashboardLawyerPending)els.dashboardLawyerPending.textContent=els.lawyersPendingCount?.textContent||'0';
      if(els.dashboardLawyerPublished)els.dashboardLawyerPublished.textContent=els.lawyersPublishedCount?.textContent||'0';
      if(els.dashboardLawyerEdits)els.dashboardLawyerEdits.textContent=els.lawyerEditRequestsCount?.textContent||'0';
      if(els.navLawyersCount)els.navLawyersCount.textContent=String((Number(els.lawyersPendingCount?.textContent)||0)+(Number(els.lawyerEditRequestsCount?.textContent)||0));
      await refreshPendingAdminCounts();
      setStatus('');
    }catch(error){
      console.error('Admin dashboard load failed:',error);
      setStatus('تعذر تحميل بيانات الإدارة. حاول تحديث الصفحة أو تحقق من صلاحيات الحساب.',true);
    }
  }
  async function loadLawyerManagement(){
    await Promise.all([loadLawyerApplications(),loadLawyerProfiles()]);
    await loadLawyerEditRequests();
  }

  async function loadLawyerEditRequests(reset=true){
    if(!isAdmin||!window.publicAuth?.firestore||!els.lawyerEditRequestsBody)return;
    const db=window.publicAuth.firestore,body=els.lawyerEditRequestsBody,key='lawyer-edit-requests';
    try{
      const query=()=>db.collection('lawyerEditRequests').where('status','==','pending');
      const [page,total]=await Promise.all([fetchAdminPage(key,query,reset),reset?safeQueryCount('lawyerEditRequests',[['status','==','pending']]):Promise.resolve(null)]);
      if(reset&&els.lawyerEditRequestsCount)els.lawyerEditRequestsCount.textContent=total===null?'—':String(total);
      const profilesById=new Map(lawyerProfiles.map(profile=>[profile.id,profile]));
      const html=page.docs.map(doc=>{
        const request={id:doc.id,...doc.data()},profile=profilesById.get(request.profileId)||{},data=request.data||{};
        const changes=['phone','address','office','workingHours','specializations','governorate','district','name'].filter(field=>String(data[field]??'')!==String(profile[field]??''));
        const labels={phone:'الهاتف',address:'العنوان',office:'المكتب',workingHours:'الدوام',specializations:'الاختصاصات',governorate:'المحافظة',district:'القضاء/المنطقة',name:'الاسم'};
        return '<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">طلب تعديل بيانات</span><h4>'+esc(profile.name||data.name||'المحامي')+'</h4><span class="firebase-admin-record-sub">'+esc(request.applicantEmail||'')+'</span></div><span class="lawyer-admin-status is-off">قيد المراجعة</span></div><div class="firebase-admin-record-field"><span>الحقول المطلوب تعديلها</span><p>'+esc(changes.map(field=>labels[field]).join('، ')||'تحديث بيانات')+'</p></div><div class="firebase-admin-record-meta">تاريخ الطلب: '+esc(dateValue(request.createdAt))+'</div><div class="lawyer-admin-actions"><button class="approve" data-lawyer-edit-approve="'+esc(request.id)+'">اعتماد التعديل</button><button class="reject" data-lawyer-edit-reject="'+esc(request.id)+'">رفض</button></div></article>';
      }).join('');
      if(reset)body.innerHTML='';
      if(html)body.insertAdjacentHTML('beforeend',html);
      if(reset&&!page.docs.length)body.innerHTML='<p class="firebase-admin-list-state">لا توجد طلبات تعديل قيد المراجعة.</p>';
      const requests=page.items.map(doc=>({id:doc.id,...doc.data()}));
      setPendingCount('lawyers',(Number(els.lawyersPendingCount?.textContent)||0)+(Number(els.lawyerEditRequestsCount?.textContent)||0));
      body.querySelectorAll('[data-lawyer-edit-approve]').forEach(button=>button.onclick=()=>approveLawyerEditRequest(requests.find(item=>item.id===button.dataset.lawyerEditApprove)));
      body.querySelectorAll('[data-lawyer-edit-reject]').forEach(button=>button.onclick=()=>rejectLawyerEditRequest(requests.find(item=>item.id===button.dataset.lawyerEditReject)));
      setAdminLoadMore(body,key,loadLawyerEditRequests);
    }catch(error){console.error('Lawyer edit requests load failed:',error);if(reset)body.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل طلبات التعديل.</p>';}
  }

  async function loadLawyerApplications(reset=true){
    if(!isAdmin||!window.publicAuth?.firestore||!els.lawyersBody)return;
    const db=window.publicAuth.firestore,body=els.lawyersBody,key='lawyer-applications';
    try{
      const query=()=>db.collection('lawyerApplications').where('status','==','pending');
      const [page,total]=await Promise.all([fetchAdminPage(key,query,reset),reset?safeQueryCount('lawyerApplications',[['status','==','pending']]):Promise.resolve(null)]);
      lawyerApplications=page.items.map(doc=>({id:doc.id,...doc.data()}));
      if(reset&&els.lawyersPendingCount)els.lawyersPendingCount.textContent=total===null?'—':String(total);
      const html=page.docs.map(doc=>{
        const application={id:doc.id,...doc.data()};
        return '<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">طلب انضمام إلى الدليل</span><h4>'+esc(application.name||'محامٍ')+'</h4><span class="firebase-admin-record-sub">'+esc(application.applicantEmail||'')+'</span></div><span class="lawyer-admin-status is-off">قيد المراجعة</span></div><div class="firebase-admin-record-field"><span>الموقع والهاتف</span><p>'+esc([application.governorate,application.district].filter(Boolean).join(' — ')||'غير محدد')+' · '+esc(application.phone||'غير متوفر')+'</p></div><div class="firebase-admin-record-field"><span>الاختصاصات</span><p>'+esc((application.specializations||[]).join('، ')||'غير محددة')+'</p></div><div class="firebase-admin-record-meta">تاريخ التقديم: '+esc(dateValue(application.createdAt))+' · الهوية تُرسل خارج المنصة</div><div class="lawyer-admin-actions"><button class="approve" data-lawyer-approve="'+esc(application.id)+'">موافقة ونشر</button><button class="reject" data-lawyer-reject="'+esc(application.id)+'">رفض</button><button data-lawyer-edit-app="'+esc(application.id)+'">تعديل</button><button class="reject" data-lawyer-delete-app="'+esc(application.id)+'">حذف</button></div></article>';
      }).join('');
      if(reset)body.innerHTML='';
      if(html)body.insertAdjacentHTML('beforeend',html);
      if(reset&&!page.docs.length)body.innerHTML='<p class="firebase-admin-list-state">لا توجد طلبات قيد المراجعة.</p>';
      body.querySelectorAll('[data-lawyer-approve]').forEach(button=>button.onclick=()=>approveLawyer(lawyerApplications.find(item=>item.id===button.dataset.lawyerApprove)));
      body.querySelectorAll('[data-lawyer-reject]').forEach(button=>button.onclick=()=>rejectLawyer(lawyerApplications.find(item=>item.id===button.dataset.lawyerReject)));
      body.querySelectorAll('[data-lawyer-edit-app]').forEach(button=>button.onclick=()=>openLawyerEdit(lawyerApplications.find(item=>item.id===button.dataset.lawyerEditApp),'application'));
      body.querySelectorAll('[data-lawyer-delete-app]').forEach(button=>button.onclick=()=>deleteLawyerApplication(lawyerApplications.find(item=>item.id===button.dataset.lawyerDeleteApp)));
      setPendingCount('lawyers',lawyerApplications.length+(Number(els.lawyerEditRequestsCount?.textContent)||0));
      setAdminLoadMore(body,key,loadLawyerApplications);
    }catch(error){console.error('Lawyer applications load failed:',error);if(reset)body.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل طلبات المحامين. تحقق من القواعد.</p>';}
  }

  async function loadLawyerProfiles(reset=true){
    if(!isAdmin||!window.publicAuth?.firestore||!els.lawyersPublishedBody)return;
    const db=window.publicAuth.firestore,body=els.lawyersPublishedBody,key='lawyer-profiles';
    try{
      const query=()=>db.collection('lawyerProfiles');
      const [page,total]=await Promise.all([fetchAdminPage(key,query,reset),reset?safeQueryCount('lawyerProfiles'):Promise.resolve(null)]);
      lawyerProfiles=page.items.map(doc=>({id:doc.id,...doc.data()}));
      if(reset){
        if(els.lawyersPublishedCount)els.lawyersPublishedCount.textContent=total===null?'—':String(total);
        const totalNode=els.section.querySelector('#fa-lawyers-published-total');
        if(totalNode)totalNode.textContent=total===null?'—':String(total);
      }
      const html=page.docs.map(doc=>{
        const profile={id:doc.id,...doc.data()};
        const specialties=(Array.isArray(profile.specializations)?profile.specializations:String(profile.specializations||'').split(/[،,]/)).map(value=>String(value||'').trim()).filter(Boolean);
        const location=[profile.governorate,profile.district].filter(Boolean).join(' — ')||'الموقع غير محدد';
        const phone=String(profile.phone||'').trim(),office=String(profile.office||'').trim(),address=String(profile.address||'').trim(),hours=String(profile.workingHours||'').trim();
        return '<article class="firebase-admin-record-card lawyer-directory-admin-card"><div class="lawyer-directory-admin-head"><span class="lawyer-directory-admin-avatar" aria-hidden="true"><i class="fas fa-user-tie"></i></span><div class="lawyer-directory-admin-identity"><span class="firebase-admin-record-eyebrow">ملف في دليل المحامين</span><h4>'+esc(profile.name||'محامٍ')+'</h4><span class="lawyer-directory-admin-location"><i class="fas fa-location-dot" aria-hidden="true"></i> '+esc(location)+'</span></div><span class="lawyer-admin-status '+(profile.published?'is-live':'is-off')+'">'+(profile.published?'ظاهر للطلاب':'معطّل عن الظهور')+'</span></div><div class="lawyer-directory-admin-details">'+(phone?'<div class="lawyer-directory-admin-detail"><span><i class="fas fa-phone" aria-hidden="true"></i> رقم الهاتف</span><strong dir="ltr">'+esc(phone)+'</strong></div>':'')+(office?'<div class="lawyer-directory-admin-detail"><span><i class="fas fa-briefcase" aria-hidden="true"></i> المكتب</span><strong>'+esc(office)+'</strong></div>':'')+(address?'<div class="lawyer-directory-admin-detail"><span><i class="fas fa-map-pin" aria-hidden="true"></i> العنوان</span><strong>'+esc(address)+'</strong></div>':'')+(hours?'<div class="lawyer-directory-admin-detail"><span><i class="fas fa-clock" aria-hidden="true"></i> ساعات العمل</span><strong>'+esc(hours)+'</strong></div>':'')+'</div><div class="lawyer-directory-admin-specialties"><span>الاختصاصات</span><div>'+(specialties.length?specialties.map(value=>'<span>'+esc(value)+'</span>').join(''):'<small>لم تُحدد الاختصاصات</small>')+'</div></div><div class="lawyer-admin-actions lawyer-directory-admin-actions"><button type="button" data-lawyer-edit-profile="'+esc(profile.id)+'"><i class="fas fa-pen" aria-hidden="true"></i> تعديل</button><button type="button" class="'+(profile.published?'reject':'approve')+'" data-lawyer-toggle="'+esc(profile.id)+'"><i class="fas '+(profile.published?'fa-eye-slash':'fa-eye')+'" aria-hidden="true"></i> '+(profile.published?'تعطيل الظهور':'إعادة التفعيل')+'</button><button type="button" class="reject" data-lawyer-delete-profile="'+esc(profile.id)+'"><i class="fas fa-trash" aria-hidden="true"></i> حذف</button></div></article>';
      }).join('');
      if(reset)body.innerHTML='';
      if(html)body.insertAdjacentHTML('beforeend',html);
      if(reset&&!page.docs.length)body.innerHTML='<p class="firebase-admin-list-state">لا توجد ملفات محامين حتى الآن.</p>';
      body.querySelectorAll('[data-lawyer-edit-profile]').forEach(button=>button.onclick=()=>openLawyerEdit(lawyerProfiles.find(item=>item.id===button.dataset.lawyerEditProfile),'profile'));
      body.querySelectorAll('[data-lawyer-toggle]').forEach(button=>button.onclick=()=>toggleLawyerVisibility(lawyerProfiles.find(item=>item.id===button.dataset.lawyerToggle)));
      body.querySelectorAll('[data-lawyer-delete-profile]').forEach(button=>button.onclick=()=>deleteLawyerProfile(lawyerProfiles.find(item=>item.id===button.dataset.lawyerDeleteProfile)));
      setAdminLoadMore(body,key,loadLawyerProfiles);
    }catch(error){console.error('Lawyer profiles load failed:',error);if(reset)body.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل ملفات المحامين. تحقق من قواعد Firestore.</p>';}
  }


  let activeJudicialAccessView='pending';
  async function loadJudicialAccessRequests(){
    const db=window.publicAuth?.firestore,body=els.judicialAccessRequests,view=activeJudicialAccessView;
    if(!isAdmin||!db||!body)return;
    body.innerHTML='<p class="firebase-admin-list-state">جارٍ تحميل طلبات الوصول...</p>';
    try{
      const requests=view==='active'
        ?await db.collection('judicialInstituteAccess').where('enabled','==',true).limit(100).get()
        :await db.collection('judicialInstituteAccessRequests').where('status','==',view==='pending'?'pending':view==='revoked'?'revoked':'rejected').limit(100).get();
      const rows=await Promise.all(requests.docs.map(async doc=>{
        const request={id:doc.id,...doc.data()},uid=String(request.uid||request.id);
        const grantSnap=await db.collection('judicialInstituteAccess').doc(uid).get();
        return {request,uid,grant:grantSnap.exists?grantSnap.data():null};
      }));
      const pendingCount=await safeQueryCount('judicialInstituteAccessRequests',[['status','==','pending']]);
      const count=pendingCount===null?'—':String(pendingCount);
      if(els.judicialAccessCount)els.judicialAccessCount.textContent=count+' طلب معلق';
      if(els.navJudicialAnswersCount){els.navJudicialAnswersCount.textContent=count;els.navJudicialAnswersCount.hidden=count==='0';}
      body.innerHTML=rows.length?rows.map(({request,uid,grant})=>{
        const enabled=grant?.enabled===true;
        const actions=view==='pending'
          ?'<button class="approve" data-judicial-access-approve="'+esc(uid)+'">✓ موافقة</button><button class="reject" data-judicial-access-reject="'+esc(uid)+'">✕ رفض</button>'
          :view==='active'?'<button class="reject" data-judicial-access-revoke="'+esc(uid)+'">سحب الصلاحية</button>':'<button class="approve" data-judicial-access-reapprove="'+esc(uid)+'">إعادة منح الوصول</button>';
        return '<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">'+(enabled?'صلاحية مفعّلة':'طلب وصول')+'</span><h4>'+esc(request.displayName||'مستخدم ميزان')+'</h4><span class="firebase-admin-record-sub">'+esc(request.email||'البريد غير متوفر')+'</span></div></div><div class="firebase-admin-record-field"><span>سبب الطلب</span><p>'+esc(request.reason||'—')+'</p></div><div class="firebase-admin-record-meta">تاريخ الطلب: '+esc(dateValue(request.createdAt||request.updatedAt))+'</div><div class="lawyer-admin-actions">'+actions+'</div></article>';
      }).join(''):'<p class="firebase-admin-list-state">'+(view==='pending'?'لا توجد طلبات معلقة.':view==='active'?'لا توجد صلاحيات مفعّلة.':'لا توجد طلبات مرفوضة أو مسحوبة.')+'</p>';
    }catch(error){console.error('Judicial access requests load failed:',error);body.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل طلبات الوصول. تحقق من قواعد Firestore.</p>';}
  }
  async function handleJudicialAccessAction(event){
    const button=event.target.closest('[data-judicial-access-approve],[data-judicial-access-reject],[data-judicial-access-revoke],[data-judicial-access-reapprove]');
    if(!button)return;
    const uid=button.dataset.judicialAccessApprove||button.dataset.judicialAccessReject||button.dataset.judicialAccessRevoke||button.dataset.judicialAccessReapprove;
    const db=window.publicAuth?.firestore;if(!isAdmin||!uid||!db)return;
    button.disabled=true;
    try{
      const requestRef=db.collection('judicialInstituteAccessRequests').doc(uid),grantRef=db.collection('judicialInstituteAccess').doc(uid);
      if(button.hasAttribute('data-judicial-access-approve')||button.hasAttribute('data-judicial-access-reapprove')){
        if(!confirm('منح هذا المستخدم صلاحية الاطلاع على أسئلة وأجوبة المعهد القضائي؟'))return;
        await db.runTransaction(async tx=>{
          const snap=await tx.get(requestRef);
          if(!snap.exists)throw new Error('طلب الوصول غير موجود.');
          const request=snap.data()||{};
          if(request.uid!==uid||!['pending','rejected','revoked'].includes(request.status))throw new Error('حالة الطلب لا تسمح بمنح الصلاحية.');
          tx.set(grantRef,{uid,enabled:true,grantedBy:window.publicAuth.user.uid,grantedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
          tx.update(requestRef,{status:'approved',reviewedBy:window.publicAuth.user.uid,reviewedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
        });
        setStatus('تمت الموافقة ومنح صلاحية الاطلاع.',false);
      }else if(button.hasAttribute('data-judicial-access-reject')){
        if(!confirm('رفض طلب الوصول إلى موسوعة المعهد القضائي؟'))return;
        await requestRef.update({status:'rejected',reviewedBy:window.publicAuth.user.uid,reviewedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
        setStatus('تم رفض طلب الوصول.',false);
      }else{
        if(!confirm('سحب صلاحية الاطلاع؟ لن يتمكن المستخدم من قراءة المحتوى بعد ذلك.'))return;
        await db.runTransaction(async tx=>{
          const [requestSnap,grantSnap]=await Promise.all([tx.get(requestRef),tx.get(grantRef)]);
          if(!grantSnap.exists||grantSnap.data()?.enabled!==true)throw new Error('لا توجد صلاحية مفعّلة لهذا المستخدم.');
          tx.update(grantRef,{enabled:false,revokedBy:window.publicAuth.user.uid,revokedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
          if(requestSnap.exists)tx.update(requestRef,{status:'revoked',reviewedBy:window.publicAuth.user.uid,reviewedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
        });
        setStatus('تم سحب صلاحية الوصول.',false);
      }
      await loadJudicialAccessRequests();
    }catch(error){console.error('Judicial access action failed:',error);setStatus('تعذر تحديث صلاحية الوصول. تحقق من قواعد Firestore.',true);}
    finally{button.disabled=false;}
  }

  let judicialAnswerItems=[],judicialSubjectItems=[];
  function renderJudicialSubjectOptions(selectedId=''){
    const select=els.judicialAnswerForm?.elements.subjectId;if(!select)return;
    select.innerHTML='<option value="">اختر المادة القانونية</option>'+judicialSubjectItems.filter(item=>item.active!==false).map(item=>'<option value="'+esc(item.id)+'" '+(item.id===selectedId?'selected':'')+'>'+esc(item.name)+'</option>').join('');
  }
  function renderJudicialSubjects(){
    if(!els.judicialSubjectsList)return;
    if(!judicialSubjectItems.length){els.judicialSubjectsList.innerHTML='<p class="firebase-admin-list-state">لم تُضف مواد بعد. أضف المادة أولاً ثم اربط الأسئلة بها.</p>';renderJudicialSubjectOptions();return;}
    els.judicialSubjectsList.innerHTML=judicialSubjectItems.map(item=>'<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><h4>'+esc(item.name)+'</h4><span class="firebase-admin-record-eyebrow">'+(item.active===false?'موقوفة':'مفعّلة')+'</span></div><button type="button" data-judicial-subject-rename="'+esc(item.id)+'">تعديل الاسم</button></div></article>').join('');
    renderJudicialSubjectOptions(els.judicialAnswerForm?.elements.subjectId?.value||'');
  }
  async function loadJudicialSubjects(){
    if(!isAdmin||!window.publicAuth?.firestore)return;
    try{const snap=await window.publicAuth.firestore.collection('judicialInstituteSubjects').orderBy('name').limit(100).get();judicialSubjectItems=snap.docs.map(doc=>({id:doc.id,...doc.data()}));renderJudicialSubjects();}
    catch(error){console.error('Judicial subjects load failed:',error);if(els.judicialSubjectsList)els.judicialSubjectsList.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل المواد. تحقق من صلاحيات Firestore.</p>';}
  }
  async function saveJudicialSubject(event){
    event.preventDefault();const form=els.judicialSubjectForm,name=form?.elements.name.value.trim(),db=window.publicAuth?.firestore;
    if(!isAdmin||!name||!db)return;
    if(judicialSubjectItems.some(item=>item.name.toLocaleLowerCase('ar')===name.toLocaleLowerCase('ar'))){setStatus('هذه المادة مضافة مسبقاً.',true);return;}
    try{await db.collection('judicialInstituteSubjects').add({name,active:true,createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp(),createdBy:window.publicAuth.user.uid});form.reset();await loadJudicialSubjects();setStatus('تمت إضافة المادة. يمكنك الآن اختيارها عند إضافة الأسئلة.');}
    catch(error){console.error('Judicial subject save failed:',error);setStatus('تعذرت إضافة المادة. تحقق من صلاحيات Firestore.',true);}
  }
  async function renameJudicialSubject(id){
    const item=judicialSubjectItems.find(row=>row.id===id);if(!item)return;
    const name=prompt('اسم المادة القانونية:',item.name);if(name===null)return;
    const value=name.trim();if(!value){setStatus('اسم المادة مطلوب.',true);return;}
    if(judicialSubjectItems.some(row=>row.id!==id&&row.name.toLocaleLowerCase('ar')===value.toLocaleLowerCase('ar'))){setStatus('توجد مادة أخرى بالاسم نفسه.',true);return;}
    try{await window.publicAuth.firestore.collection('judicialInstituteSubjects').doc(id).update({name:value,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});await loadJudicialSubjects();await loadJudicialAnswers();setStatus('تم تحديث اسم المادة.');}
    catch(error){console.error(error);setStatus('تعذر تعديل المادة.',true);}
  }
  function resetJudicialAnswer(){const form=els.judicialAnswerForm;if(!form)return;form.reset();form.elements.id.value='';form.elements.published.checked=false;form.querySelector('button[type="submit"]').textContent='حفظ السؤال والإجابة';renderJudicialSubjectOptions();}
  function renderJudicialAnswers(){
    if(!els.judicialAnswersList)return;
    if(els.judicialAnswersCount)els.judicialAnswersCount.textContent=judicialAnswerItems.length+' سؤال';
    if(!judicialAnswerItems.length){els.judicialAnswersList.innerHTML='<p class="firebase-admin-list-state">لا توجد أسئلة مضافة حتى الآن.</p>';return;}
    els.judicialAnswersList.innerHTML=judicialAnswerItems.map(item=>{const subject=judicialSubjectItems.find(row=>row.id===item.subjectId);return '<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">'+(item.published?'منشور':'مسودة')+' · '+esc(subject?.name||item.subject||'مادة غير محددة')+'</span><h4>'+esc(item.question||'')+'</h4></div></div><div class="firebase-admin-record-meta">'+esc(item.type==='practical'?'واقعة عملية':item.type==='topic'?'موضوع قانوني':'سؤال نظري')+(item.source?' · '+esc(item.source):'')+'</div><div class="lawyer-admin-actions"><button type="button" data-judicial-answer-edit="'+esc(item.id)+'">تعديل</button><button type="button" data-judicial-answer-toggle="'+esc(item.id)+'">'+(item.published?'إلغاء النشر':'نشر')+'</button><button type="button" data-judicial-answer-delete="'+esc(item.id)+'">حذف</button></div></article>';}).join('');
  }
  async function loadJudicialAnswers(){
    if(!isAdmin||!window.publicAuth?.firestore||!els.judicialAnswersList)return;
    els.judicialAnswersList.innerHTML='<p class="firebase-admin-list-state">جارٍ تحميل الأسئلة...</p>';
    try{const snap=await window.publicAuth.firestore.collection('judicialInstituteAnswers').orderBy('updatedAt','desc').limit(100).get();judicialAnswerItems=snap.docs.map(doc=>({id:doc.id,...doc.data()}));renderJudicialAnswers();}
    catch(error){console.error('Judicial answers admin load failed:',error);els.judicialAnswersList.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل المحتوى. تحقق من اتصال Firebase وصلاحيات الإدارة.</p>';}
  }
  async function saveJudicialAnswer(event){
    event.preventDefault();const form=els.judicialAnswerForm;if(!form||!isAdmin)return;
    const data={subjectId:form.elements.subjectId.value,type:form.elements.type.value,question:form.elements.question.value.trim(),answer:form.elements.answer.value.trim(),source:form.elements.source.value.trim(),published:form.elements.published.checked,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
    if(!data.subjectId||!data.question||!data.answer){setStatus('اختر المادة وأكمل السؤال والإجابة قبل الحفظ.',true);return;}
    try{const db=window.publicAuth.firestore,id=form.elements.id.value;if(id)await db.collection('judicialInstituteAnswers').doc(id).update(data);else await db.collection('judicialInstituteAnswers').add({...data,createdAt:firebase.firestore.FieldValue.serverTimestamp(),createdBy:window.publicAuth.user.uid});resetJudicialAnswer();await loadJudicialAnswers();setStatus('تم حفظ السؤال والإجابة وربطهما بالمادة المختارة.');}
    catch(error){console.error('Judicial answer save failed:',error);setStatus('تعذر حفظ السؤال والإجابة. تحقق من صلاحيات Firestore.',true);}
  }
  function handleJudicialAnswerAction(event){
    const edit=event.target.closest('[data-judicial-answer-edit]'),toggle=event.target.closest('[data-judicial-answer-toggle]'),remove=event.target.closest('[data-judicial-answer-delete]'),rename=event.target.closest('[data-judicial-subject-rename]');
    if(rename){renameJudicialSubject(rename.dataset.judicialSubjectRename);return;}
    if(edit){const item=judicialAnswerItems.find(row=>row.id===edit.dataset.judicialAnswerEdit);if(!item)return;const f=els.judicialAnswerForm;f.elements.id.value=item.id;renderJudicialSubjectOptions(item.subjectId||'');f.elements.type.value=item.type||'theoretical';f.elements.question.value=item.question||'';f.elements.answer.value=item.answer||'';f.elements.source.value=item.source||'';f.elements.published.checked=item.published===true;f.querySelector('button[type="submit"]').textContent='حفظ التعديلات';f.scrollIntoView({behavior:'smooth',block:'start'});return;}
    if(toggle){const item=judicialAnswerItems.find(row=>row.id===toggle.dataset.judicialAnswerToggle);if(!item)return;window.publicAuth.firestore.collection('judicialInstituteAnswers').doc(item.id).update({published:item.published!==true,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}).then(loadJudicialAnswers).then(()=>setStatus('تم تحديث حالة النشر.')).catch(error=>{console.error(error);setStatus('تعذر تحديث حالة النشر.',true);});return;}
    if(remove){const item=judicialAnswerItems.find(row=>row.id===remove.dataset.judicialAnswerDelete);if(!item||!confirm('حذف السؤال والإجابة نهائياً؟'))return;window.publicAuth.firestore.collection('judicialInstituteAnswers').doc(item.id).delete().then(loadJudicialAnswers).then(()=>setStatus('تم حذف السؤال والإجابة.')).catch(error=>{console.error(error);setStatus('تعذر حذف المحتوى.',true);});}
  }

  const procedureAdminCategories={civil:{title:'الدعاوى المدنية',icon:'fa-landmark'},criminal:{title:'الدعاوى الجزائية',icon:'fa-scale-balanced'},administrative:{title:'الدعاوى الإدارية',icon:'fa-building-columns'},personal:{title:'دعاوى الأحوال الشخصية',icon:'fa-people-roof'}};
  function setProcedureAdminPanel(panel){if(!['access','add','library'].includes(panel))return;els.proceduresHub?.querySelectorAll('[data-procedures-panel]').forEach(button=>{const active=button.dataset.proceduresPanel===panel;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));});['access','add','library'].forEach(key=>{const node=els.section.querySelector('#fa-procedures-panel-'+key);if(node)node.hidden=key!==panel;});if(panel==='library')renderProcedureAdminLibrary();}
  function renderProcedureAdminCategoryCards(){
    if(!els.proceduresCategories)return;
    const counts=Object.values(procedureCategoryCounts);
    const total=counts.some(item=>item.total===null)?null:counts.reduce((sum,item)=>sum+item.total,0);
    els.proceduresCategories.innerHTML=Object.entries(procedureAdminCategories).map(([key,category])=>{
      const count=procedureCategoryCounts[key]||{total:null,published:null,unpublished:null};
      const display=value=>value===null?'—':String(value);
      return '<button type="button" class="firebase-admin-content-category" data-procedure-admin-category="'+key+'"><span class="firebase-admin-content-category-icon"><i class="fas '+category.icon+'"></i></span><span class="firebase-admin-content-category-copy"><strong>'+esc(category.title)+'</strong><small>'+display(count.total)+' إجراء · '+display(count.published)+' منشور · '+display(count.unpublished)+' غير منشور</small></span><i class="fas fa-chevron-left firebase-admin-content-category-arrow"></i></button>';
    }).join('');
    if(els.proceduresTotalCount)els.proceduresTotalCount.textContent=total===null?'—':String(total);
    if(els.proceduresLibrarySummary)els.proceduresLibrarySummary.textContent=(total===null?'—':String(total))+' إجراء في 4 تصنيفات';
  }
  function renderProcedureAdminCategoryItems(){
    if(!els.proceduresCategoryItems||!activeProcedureAdminCategory)return;
    const rows=procedureItems,counts=procedureCategoryCounts[activeProcedureAdminCategory]||{total:0,published:0,unpublished:0};
    els.proceduresCategoryTitle.textContent=procedureAdminCategories[activeProcedureAdminCategory].title;
    els.proceduresCategoryTotal.textContent=counts.total+' إجراء';
    const publishedTab=els.proceduresHub.querySelector('[data-procedure-admin-status="published"]'),unpublishedTab=els.proceduresHub.querySelector('[data-procedure-admin-status="unpublished"]');
    if(publishedTab){publishedTab.classList.toggle('is-active',activeProcedureAdminStatus==='published');publishedTab.setAttribute('aria-selected',String(activeProcedureAdminStatus==='published'));publishedTab.querySelector('span').textContent=String(counts.published);}
    if(unpublishedTab){unpublishedTab.classList.toggle('is-active',activeProcedureAdminStatus==='unpublished');unpublishedTab.setAttribute('aria-selected',String(activeProcedureAdminStatus==='unpublished'));unpublishedTab.querySelector('span').textContent=String(counts.unpublished);}
    els.proceduresCategoryItems.innerHTML=rows.length?rows.map(item=>'<article class="firebase-admin-content-item"><div class="firebase-admin-content-item-title"><h5>'+esc(item.title||'بدون عنوان')+'</h5><span class="lawyer-admin-status '+(item.published?'is-live':'is-off')+'">'+(item.published?'منشور':'غير منشور')+'</span></div><div class="lawyer-admin-actions"><button type="button" data-procedure-admin-edit="'+esc(item.id)+'">تعديل</button><button type="button" class="'+(item.published?'reject':'approve')+'" data-procedure-admin-toggle="'+esc(item.id)+'">'+(item.published?'إخفاء':'نشر')+'</button><button type="button" class="reject" data-procedure-admin-delete="'+esc(item.id)+'">حذف</button></div></article>').join(''):'<p class="firebase-admin-list-state">لا توجد إجراءات '+(activeProcedureAdminStatus==='published'?'منشورة':'غير منشورة')+' في هذا القسم.</p>';
  }
  async function loadProcedureCategoryItems(reset=true){
    if(!isAdmin||!window.publicAuth?.firestore||!activeProcedureAdminCategory)return;
    const db=window.publicAuth.firestore,category=activeProcedureAdminCategory,published=activeProcedureAdminStatus==='published',key='procedure-library:'+category+':'+activeProcedureAdminStatus;
    try{
      const page=await fetchAdminPage(key,()=>db.collection('legalProcedures').where('category','==',category),reset);
      procedureItems=page.items.map(doc=>({id:doc.id,...doc.data()})).filter(item=>published?item.published===true:item.published!==true);
      renderProcedureAdminCategoryItems();
      setAdminLoadMore(els.proceduresCategoryItems,key,loadProcedureCategoryItems);
    }catch(error){console.error('Procedure category page load failed:',error);els.proceduresCategoryItems.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل الإجراءات في هذا التصنيف.</p>';}
  }
  function renderProcedureAdminLibrary(){
    if(!els.proceduresCategories||!els.proceduresCategoryView)return;
    renderProcedureAdminCategoryCards();
    const has=Boolean(activeProcedureAdminCategory&&procedureAdminCategories[activeProcedureAdminCategory]);
    els.proceduresCategories.hidden=has;els.proceduresCategoryView.hidden=!has;
    if(has)loadProcedureCategoryItems(true);
  }
  function openProcedureEditor(item){if(!item||!els.procedureForm)return;const form=els.procedureForm;['id','title','category','summary','requirements','documents','steps','legalBasis','fees','duration'].forEach(key=>form.elements[key].value=item[key]||'');form.elements.published.checked=item.published===true;els.procedureFormTitle.textContent='تعديل الإجراء';setProcedureAdminPanel('add');form.scrollIntoView({behavior:'smooth',block:'start'});}
  function handleProcedureHubClick(event){
    const accessView=event.target.closest('[data-procedure-access-view]');if(accessView){activeProcedureAccessView=accessView.dataset.procedureAccessView;els.proceduresHub.querySelectorAll('[data-procedure-access-view]').forEach(button=>button.classList.toggle('active',button===accessView));loadProcedureAccessRequests(true);return;}
    const panel=event.target.closest('[data-procedures-panel]');if(panel){setProcedureAdminPanel(panel.dataset.proceduresPanel);return;}
    const category=event.target.closest('[data-procedure-admin-category]');if(category){activeProcedureAdminCategory=category.dataset.procedureAdminCategory;activeProcedureAdminStatus='published';renderProcedureAdminLibrary();return;}
    if(event.target.closest('[data-procedures-categories]')){activeProcedureAdminCategory='';renderProcedureAdminLibrary();return;}
    const status=event.target.closest('[data-procedure-admin-status]');if(status){activeProcedureAdminStatus=status.dataset.procedureAdminStatus;loadProcedureCategoryItems(true);return;}
    const edit=event.target.closest('[data-procedure-admin-edit]');if(edit){openProcedureEditor(procedureItems.find(item=>item.id===edit.dataset.procedureAdminEdit));return;}
    const toggle=event.target.closest('[data-procedure-admin-toggle]');if(toggle){toggleLegalProcedure(toggle.dataset.procedureAdminToggle);return;}
    const remove=event.target.closest('[data-procedure-admin-delete]');if(remove)deleteLegalProcedure(remove.dataset.procedureAdminDelete);
  }
  async function toggleLegalProcedure(id){
    const item=procedureItems.find(value=>value.id===id);if(!item)return;
    const nextPublished=item.published!==true;
    try{
      await window.publicAuth.firestore.collection('legalProcedures').doc(id).update({published:nextPublished,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      const synced=await syncPublicProcedureIndexItem({...item,published:nextPublished});
      activeProcedureAdminCategory=item.category;activeProcedureAdminStatus=nextPublished?'published':'unpublished';
      await loadLegalProcedures();setProcedureAdminPanel('library');
      setStatus(synced?'تم تحديث حالة الإجراء والفهرس العام.':'تم تحديث الحالة لكن تعذر تحديث الفهرس العام.',!synced);
    }catch(error){console.error(error);setStatus('تعذر تحديث حالة الإجراء.',true);}
  }
  async function deleteLegalProcedure(id){
    const item=procedureItems.find(value=>value.id===id);if(!item||!confirm('حذف هذا الإجراء نهائياً؟'))return;
    try{
      await window.publicAuth.firestore.collection('legalProcedures').doc(id).delete();
      const synced=await syncPublicProcedureIndexItem(item,true);
      resetLegalProcedure();activeProcedureAdminCategory=item.category;activeProcedureAdminStatus=item.published===true?'published':'unpublished';
      await loadLegalProcedures();setProcedureAdminPanel('library');
      setStatus(synced?'تم حذف الإجراء وتحديث الفهرس العام.':'تم حذف الإجراء لكن تعذر تحديث الفهرس العام.',!synced);
    }catch(error){console.error(error);setStatus('تعذر حذف الإجراء.',true);}
  }
  function resetLegalProcedure(){if(!els.procedureForm)return;els.procedureForm.reset();els.procedureForm.elements.id.value='';els.procedureForm.elements.category.value='';els.procedureForm.elements.published.checked=true;if(els.procedureFormTitle)els.procedureFormTitle.textContent='إضافة إجراء جديد';}
  async function syncPublicProcedureIndexItem(item,remove=false){
    const db=window.publicAuth?.firestore;if(!isAdmin||!db)return false;
    const categoryTitles={civil:'الدعاوى المدنية',criminal:'الدعاوى الجزائية',administrative:'الدعاوى الإدارية',personal:'دعاوى الأحوال الشخصية'};
    const ref=db.collection('publicIndexes').doc('procedures'),snapshot=await ref.get(),current=snapshot.exists&&Array.isArray(snapshot.data()?.items)?snapshot.data().items:[];
    const next=current.filter(entry=>entry.id!==item.id);
    if(!remove&&item.published===true&&typeof item.title==='string'&&item.title.trim()&&categoryTitles[item.category]){
      next.push({id:item.id,title:item.title.trim(),category:item.category,categoryTitle:categoryTitles[item.category]});
    }
    next.sort((a,b)=>a.title.localeCompare(b.title,'ar'));
    if(JSON.stringify(current)!==JSON.stringify(next))await ref.set({items:next,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    return true;
  }
  async function loadLegalProcedures(){
    if(!isAdmin||!window.publicAuth?.firestore||!els.proceduresCategories)return false;
    els.proceduresCategories.innerHTML='<p class="firebase-admin-list-state">جارٍ تحميل الإجراءات...</p>';
    try{
      const db=window.publicAuth.firestore;
      const categories=Object.keys(procedureAdminCategories);
      const entries=await Promise.all(categories.map(async category=>{
        const [total,published]=await Promise.all([
          safeQueryCount('legalProcedures',[['category','==',category]]),
          safeQueryCount('legalProcedures',[['category','==',category],['published','==',true]])
        ]);
        return [category,{published,unpublished:total===null||published===null?null:Math.max(0,total-published),total}];
      }));
      procedureCategoryCounts=Object.fromEntries(entries);
      procedureItems=[];
      renderProcedureAdminLibrary();
      return true;
    }catch(error){console.error('Legal procedures counts load failed:',error);els.proceduresCategories.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل الإجراءات. تحقق من قواعد Firestore المنشورة.</p>';return false;}
  }

  const petitionCategories={
    family:{title:'أحوال شخصية',icon:'fa-users'},
    civil:{title:'مدنية',icon:'fa-landmark'},
    criminal:{title:'جزائية وتحقيق',icon:'fa-scale-balanced'},
    administrative:{title:'إدارية',icon:'fa-building-columns'}
  };
  function setPetitionPanel(panel){
    if(!['access','add','library'].includes(panel))return;
    els.petitionsHub?.querySelectorAll('[data-petitions-panel]').forEach(button=>{
      const active=button.dataset.petitionsPanel===panel;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    ['access','add','library'].forEach(key=>{
      const node=els.section.querySelector('#fa-petitions-panel-'+key);
      if(node)node.hidden=key!==panel;
    });
    if(panel==='library')renderPetitionLibrary();
  }
  function renderPetitionCategoryCards(){
    if(!els.petitionsCategories)return;
    const counts=Object.values(petitionCategoryCounts);
    const total=counts.some(item=>item.total===null)?null:counts.reduce((sum,item)=>sum+item.total,0);
    els.petitionsCategories.innerHTML=Object.entries(petitionCategories).map(([key,category])=>{
      const count=petitionCategoryCounts[key]||{total:null,published:null,unpublished:null};
      const display=value=>value===null?'—':String(value);
      return '<button type="button" class="firebase-admin-content-category" data-petition-category="'+key+'"><span class="firebase-admin-content-category-icon"><i class="fas '+category.icon+'" aria-hidden="true"></i></span><span class="firebase-admin-content-category-copy"><strong>'+esc(category.title)+'</strong><small>'+display(count.total)+' نموذج · '+display(count.published)+' منشور · '+display(count.unpublished)+' غير منشور</small></span><i class="fas fa-chevron-left firebase-admin-content-category-arrow" aria-hidden="true"></i></button>';
    }).join('');
    if(els.petitionsTotalCount)els.petitionsTotalCount.textContent=total===null?'—':String(total);
    if(els.petitionsLibrarySummary)els.petitionsLibrarySummary.textContent=(total===null?'—':String(total))+' نموذج في '+Object.keys(petitionCategories).length+' تصنيفات';
  }
  function renderPetitionCategoryItems(){
    if(!els.petitionsCategoryItems||!activePetitionCategory)return;
    const selected=petitionItems,category=petitionCategories[activePetitionCategory],counts=petitionCategoryCounts[activePetitionCategory]||{total:0,published:0,unpublished:0};
    if(els.petitionsCategoryTitle)els.petitionsCategoryTitle.textContent=category?.title||'نماذج العرائض';
    if(els.petitionsCategoryTotal)els.petitionsCategoryTotal.textContent=counts.total+' نموذج';
    const publishedTab=els.petitionsHub.querySelector('[data-petition-status="published"]'),unpublishedTab=els.petitionsHub.querySelector('[data-petition-status="unpublished"]');
    if(publishedTab){publishedTab.classList.toggle('is-active',activePetitionStatus==='published');publishedTab.setAttribute('aria-selected',String(activePetitionStatus==='published'));publishedTab.querySelector('span').textContent=String(counts.published);}
    if(unpublishedTab){unpublishedTab.classList.toggle('is-active',activePetitionStatus==='unpublished');unpublishedTab.setAttribute('aria-selected',String(activePetitionStatus==='unpublished'));unpublishedTab.querySelector('span').textContent=String(counts.unpublished);}
    els.petitionsCategoryItems.innerHTML=selected.length?selected.map(item=>'<article class="firebase-admin-content-item"><div class="firebase-admin-content-item-title"><h5>'+esc(item.title||'بدون عنوان')+'</h5><span class="lawyer-admin-status '+(item.published?'is-live':'is-off')+'">'+(item.published?'منشورة':'غير منشورة')+'</span></div><div class="lawyer-admin-actions"><button type="button" data-petition-edit="'+esc(item.id)+'">تعديل</button><button type="button" class="'+(item.published?'reject':'approve')+'" data-petition-toggle="'+esc(item.id)+'">'+(item.published?'إلغاء النشر':'نشر')+'</button><button type="button" class="reject" data-petition-delete="'+esc(item.id)+'">حذف</button></div></article>').join(''):'<p class="firebase-admin-list-state">'+(activePetitionStatus==='published'?'لا توجد عرائض منشورة في هذا القسم.':'لا توجد عرائض غير منشورة في هذا القسم.')+'</p>';
  }
  async function loadPetitionCategoryItems(reset=true){
    if(!isAdmin||!window.publicAuth?.firestore||!activePetitionCategory)return;
    const db=window.publicAuth.firestore,categoryId=activePetitionCategory,published=activePetitionStatus==='published',key='petition-library:'+categoryId+':'+activePetitionStatus;
    try{
      const page=await fetchAdminPage(key,()=>db.collection('petitionDocuments').where('categoryId','==',categoryId),reset);
      petitionItems=page.items.map(doc=>({id:doc.id,...doc.data()})).filter(item=>published?item.published===true:item.published!==true);
      renderPetitionCategoryItems();
      setAdminLoadMore(els.petitionsCategoryItems,key,loadPetitionCategoryItems);
    }catch(error){console.error('Petition category page load failed:',error);els.petitionsCategoryItems.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل النماذج في هذا التصنيف.</p>';}
  }
  function renderPetitionLibrary(){
    if(!els.petitionsCategories||!els.petitionsCategoryView)return;
    renderPetitionCategoryCards();
    const hasCategory=Boolean(activePetitionCategory&&petitionCategories[activePetitionCategory]);
    els.petitionsCategories.hidden=hasCategory;els.petitionsCategoryView.hidden=!hasCategory;
    if(hasCategory)loadPetitionCategoryItems(true);
  }
  function openPetitionEditor(item){
    const form=els.petitionForm;if(!form||!item)return;
    form.elements.id.value=item.id;
    form.elements.title.value=item.title||'';
    form.elements.category.value=item.categoryId||'';
    form.elements.description.value=item.description||'';
    form.elements.icon.value=item.icon||'fas fa-file-signature';
    form.elements.body.value=item.body||'';
    form.elements.published.checked=item.published===true;
    if(els.petitionFormTitle)els.petitionFormTitle.textContent='تعديل العريضة';
    setPetitionPanel('add');
    form.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function resetPetition(){
    if(!els.petitionForm)return;
    els.petitionForm.reset();
    els.petitionForm.elements.id.value='';
    els.petitionForm.elements.icon.value='fas fa-file-signature';
    els.petitionForm.elements.published.checked=true;
    if(els.petitionFormTitle)els.petitionFormTitle.textContent='إضافة عريضة جديدة';
  }
  function handlePetitionHubClick(event){
    const accessView=event.target.closest('[data-petition-access-view]');if(accessView){activePetitionAccessView=accessView.dataset.petitionAccessView;els.petitionsHub.querySelectorAll('[data-petition-access-view]').forEach(button=>button.classList.toggle('active',button===accessView));loadPetitionAccessRequests(true);return;}
    const panelButton=event.target.closest('[data-petitions-panel]');
    if(panelButton){setPetitionPanel(panelButton.dataset.petitionsPanel);return;}
    const categoryButton=event.target.closest('[data-petition-category]');
    if(categoryButton){activePetitionCategory=categoryButton.dataset.petitionCategory;activePetitionStatus='published';renderPetitionLibrary();return;}
    if(event.target.closest('[data-petitions-categories]')){activePetitionCategory='';renderPetitionLibrary();return;}
    const statusButton=event.target.closest('[data-petition-status]');
    if(statusButton){activePetitionStatus=statusButton.dataset.petitionStatus;loadPetitionCategoryItems(true);return;}
    const editButton=event.target.closest('[data-petition-edit]');
    if(editButton){openPetitionEditor(petitionItems.find(item=>item.id===editButton.dataset.petitionEdit));return;}
    const toggleButton=event.target.closest('[data-petition-toggle]');
    if(toggleButton){togglePetition(toggleButton.dataset.petitionToggle);return;}
    const deleteButton=event.target.closest('[data-petition-delete]');
    if(deleteButton)deletePetition(deleteButton.dataset.petitionDelete);
  }
  async function togglePetition(id){
    const item=petitionItems.find(entry=>entry.id===id);if(!item)return;
    const nextPublished=item.published!==true;
    try{
      await window.publicAuth.firestore.collection('petitionDocuments').doc(id).update({published:nextPublished,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      const synced=await syncPublicPetitionIndexItem({...item,published:nextPublished});
      activePetitionCategory=item.categoryId;activePetitionStatus=nextPublished?'published':'unpublished';
      await loadPetitions();setPetitionPanel('library');
      setStatus(synced?'تم تحديث حالة العريضة والفهرس العام.':'تم تحديث الحالة لكن تعذر تحديث الفهرس العام.',!synced);
    }catch(error){console.error(error);setStatus('تعذر تحديث حالة العريضة.',true);}
  }
  async function deletePetition(id){
    const item=petitionItems.find(entry=>entry.id===id);
    if(!item||!confirm('حذف هذه العريضة نهائياً؟'))return;
    try{
      await window.publicAuth.firestore.collection('petitionDocuments').doc(item.id).delete();
      const synced=await syncPublicPetitionIndexItem(item,true);
      resetPetition();activePetitionCategory=item.categoryId;activePetitionStatus=item.published===true?'published':'unpublished';
      await loadPetitions();setPetitionPanel('library');
      setStatus(synced?'تم حذف العريضة وتحديث الفهرس.':'تم حذف العريضة لكن تعذر تحديث الفهرس.',!synced);
    }catch(error){console.error(error);setStatus('تعذر حذف العريضة.',true);}
  }
  async function syncPublicPetitionIndexItem(item,remove=false){
    const db=window.publicAuth?.firestore;if(!isAdmin||!db)return false;
    const names={family:'عرائض أحوال شخصية',civil:'عرائض البداءة (الدعاوى المدنية)',criminal:'عرائض جزائية وتحقيق',administrative:'عرائض إدارية'};
    const ref=db.collection('publicIndexes').doc('petitions'),snapshot=await ref.get(),current=snapshot.exists&&Array.isArray(snapshot.data()?.items)?snapshot.data().items:[];
    const next=current.filter(entry=>entry.uid!==item.id);
    if(!remove&&item.published===true&&item.title&&names[item.categoryId]){
      next.push({uid:item.id,name:item.title.trim(),categoryId:item.categoryId,category:names[item.categoryId],description:item.description||'',icon:item.icon||'fas fa-file-signature'});
    }
    next.sort((a,b)=>a.name.localeCompare(b.name,'ar'));
    if(JSON.stringify(current)!==JSON.stringify(next))await ref.set({items:next,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    return true;
  }
  async function loadPetitions(){
    if(!isAdmin||!window.publicAuth?.firestore||!els.petitionsCategories)return false;
    els.petitionsCategories.innerHTML='<p class="firebase-admin-list-state">جارٍ تحميل نماذج العرائض...</p>';
    try{
      const db=window.publicAuth.firestore,categories=Object.keys(petitionCategories);
      const entries=await Promise.all(categories.map(async categoryId=>{
        const [total,published]=await Promise.all([
          safeQueryCount('petitionDocuments',[['categoryId','==',categoryId]]),
          safeQueryCount('petitionDocuments',[['categoryId','==',categoryId],['published','==',true]])
        ]);
        return [categoryId,{published,unpublished:total===null||published===null?null:Math.max(0,total-published),total}];
      }));
      petitionCategoryCounts=Object.fromEntries(entries);petitionItems=[];
      renderPetitionLibrary();
      return true;
    }catch(error){
      console.error('Petitions counts load failed:',error);
      els.petitionsCategories.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل نماذج العرائض. تحقق من قواعد Firestore المنشورة.</p>';
      if(els.petitionsCategoryItems)els.petitionsCategoryItems.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل النماذج.</p>';
      return false;
    }
  }
  async function savePetition(event){
    event.preventDefault();if(!isAdmin||!window.publicAuth?.firestore||!window.publicAuth?.user)return;
    const form=els.petitionForm,id=String(form.elements.id.value||'').trim(),categoryId=String(form.elements.category.value||'').trim();
    if(!Object.prototype.hasOwnProperty.call(petitionCategories,categoryId)){setStatus('اختر تصنيف العريضة الصحيح.',true);return;}
    const data={title:String(form.elements.title.value||'').trim().slice(0,180),categoryId,description:String(form.elements.description.value||'').trim().slice(0,1000),icon:String(form.elements.icon.value||'fas fa-file-signature').trim().slice(0,100),body:String(form.elements.body.value||'').trim().slice(0,50000),published:Boolean(form.elements.published.checked)};
    if(data.title.length<3||data.body.length<10){setStatus('عنوان العريضة والنص الكامل مطلوبان.',true);return;}
    setStatus('جارٍ حفظ العريضة في Firestore...',false);
    try{
      const db=window.publicAuth.firestore,stamp=firebase.firestore.FieldValue.serverTimestamp();let savedId=id;
      if(id)await db.collection('petitionDocuments').doc(id).update({...data,updatedAt:stamp});
      else{const ref=db.collection('petitionDocuments').doc();await ref.set({...data,createdAt:stamp,createdBy:window.publicAuth.user.uid,updatedAt:stamp});savedId=ref.id;}
      const synced=await syncPublicPetitionIndexItem({...data,id:savedId});
      resetPetition();activePetitionCategory=categoryId;activePetitionStatus=data.published?'published':'unpublished';
      await loadPetitions();setPetitionPanel('library');
      setStatus(synced?'تم حفظ العريضة وتحديث الفهرس العام.':'تم حفظ العريضة لكن تعذر تحديث الفهرس العام.',!synced);
    }catch(error){console.error('Petition save failed:',error);setStatus('تعذر حفظ العريضة في Firestore. '+String(error.message||''),true);}
  }

  let activePetitionAccessView='pending';
  let activeProcedureAccessView='pending';
  async function loadAccessDirectory(type,view,reset=true){
    const isPetition=type==='petition',db=window.publicAuth?.firestore;
    const body=isPetition?els.petitionsRequestsBody:els.proceduresRequestsBody;
    if(!isAdmin||!db||!body)return;
    const requestCollection=isPetition?'petitionAccessRequests':'procedureAccessRequests';
    const accessCollection=isPetition?'petitionAccess':'procedureAccess';
    const cache=isPetition?petitionGrantCache:procedureGrantCache,key=type+'-access-'+view;
    const countIds=isPetition?{pending:'fa-petitions-pending-count',revoked:'fa-petitions-revoked-count',active:'fa-petitions-enabled-count'}:{pending:'fa-procedures-pending-count',revoked:'fa-procedures-revoked-count',active:'fa-procedures-enabled-count'};
    try{
      const query=()=>view==='active'?db.collection(accessCollection).where('enabled','==',true):db.collection(requestCollection).where('status','==',view);
      const [page,counts]=await Promise.all([fetchAdminPage(key,query,reset),reset?Promise.all([safeQueryCount(requestCollection,[['status','==','pending']]),safeQueryCount(requestCollection,[['status','==','revoked']]),safeQueryCount(accessCollection,[['enabled','==',true]])]):Promise.resolve(null)]);
      if(reset)cache.clear();
      if(counts){['pending','revoked','active'].forEach((name,index)=>{const node=document.getElementById(countIds[name]);if(node)node.textContent=counts[index]===null?'—':String(counts[index]);});if(isPetition)setPendingCount('petitions',counts[0]);else setPendingCount('procedures',counts[0]);}
      const rows=await Promise.all(page.docs.map(async doc=>{
        if(view!=='active'){const request={id:doc.id,...(doc.data()||{})},uid=String(request.uid||request.id),snap=await db.collection(accessCollection).doc(uid).get(),grant=snap.exists?{id:snap.id,...snap.data()}:null;if(grant)cache.set(uid,grant);return {request,uid,grant};}
        const grant={id:doc.id,...(doc.data()||{})},uid=String(grant.uid||grant.id);cache.set(uid,grant);
        const snap=await db.collection(requestCollection).doc(uid).get();if(!snap.exists)return null;
        return {request:{id:snap.id,...(snap.data()||{})},uid,grant};
      }));
      const validRows=rows.filter(Boolean);
      const html=validRows.map(({request,uid,grant})=>{
        const enabled=grant?.enabled===true,status=view==='active'?'الصلاحية مفعّلة':view==='pending'?'طلب معلق':'تم سحب الصلاحية';
        let actions='';
        if(view==='active')actions='<button class="reject" data-'+type+'-revoke="'+esc(uid)+'">سحب الصلاحية</button>';
        else if(view==='pending')actions='<button class="approve" data-'+type+'-approve="'+esc(uid)+'">✓ موافقة</button><button class="reject" data-'+type+'-reject="'+esc(uid)+'">✕ رفض</button>';
        else actions='<button class="approve" data-'+type+'-approve="'+esc(uid)+'">إعادة منح الوصول</button>';
        return '<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">مستخدم ميزان</span><h4>'+esc(request.displayName||'مستخدم ميزان')+'</h4><span class="firebase-admin-record-sub">'+esc(request.email||'البريد غير متوفر')+'</span></div><span class="lawyer-admin-status '+(enabled?'is-live':'is-off')+'">'+status+'</span></div><div class="firebase-admin-record-field"><span>سبب الطلب</span><p>'+esc(request.reason||'لم يذكر سبباً')+'</p></div><div class="firebase-admin-record-meta">تاريخ الطلب: '+esc(dateValue(request.createdAt||request.updatedAt))+'</div><div class="lawyer-admin-actions">'+actions+'</div></article>';
      }).join('');
      if(reset)body.innerHTML='';if(html)body.insertAdjacentHTML('beforeend',html);
      if(reset&&!validRows.length)body.innerHTML='<p class="firebase-admin-list-state">'+(view==='pending'?'لا توجد طلبات معلقة.':view==='revoked'?'لا توجد صلاحيات مسحوبة.':'لا توجد صلاحيات مفعّلة حالياً.')+'</p>';
      const requests=page.items.map(doc=>({id:doc.id,...(doc.data()||{})}));
      body.querySelectorAll('[data-'+type+'-approve]').forEach(button=>button.onclick=()=>{const uid=button.getAttribute('data-'+type+'-approve'),request=view==='active'?{uid}:requests.find(item=>(item.uid||item.id)===uid);if(isPetition)approvePetitionAccess(request);else approveProcedureAccess(request);});
      body.querySelectorAll('[data-'+type+'-reject]').forEach(button=>button.onclick=()=>{const uid=button.getAttribute('data-'+type+'-reject'),request=requests.find(item=>(item.uid||item.id)===uid);if(isPetition)rejectPetitionAccess(request);else rejectProcedureAccess(request);});
      body.querySelectorAll('[data-'+type+'-revoke]').forEach(button=>button.onclick=()=>{const uid=button.getAttribute('data-'+type+'-revoke'),row=validRows.find(item=>item.uid===uid);if(isPetition)revokePetitionAccess(row?.request,cache.get(uid));else revokeProcedureAccess(row?.request,cache.get(uid));});
      setAdminLoadMore(body,key,loadAccessDirectory.bind(null,type,view));
    }catch(error){console.error(type+' access directory load failed:',error);if(reset)body.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل قائمة الصلاحيات. تحقق من قواعد Firestore.</p>';}
  }
  async function loadPetitionAccessRequests(reset=true){return loadAccessDirectory('petition',activePetitionAccessView,reset);}
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
    const form=els.procedureForm,id=String(form.elements.id.value||'').trim(),category=String(form.elements.category.value||'').trim();
    if(!['civil','criminal','administrative','personal'].includes(category)){setStatus('اختر تصنيف الدعوى الصحيح قبل حفظ الإجراء.',true);form.elements.category.focus();return;}
    const data={
      title:String(form.elements.title.value||'').trim().slice(0,180),category,
      summary:String(form.elements.summary.value||'').trim().slice(0,2000),
      requirements:String(form.elements.requirements.value||'').trim().slice(0,5000),
      documents:String(form.elements.documents.value||'').trim().slice(0,5000),
      steps:String(form.elements.steps.value||'').trim().slice(0,10000),
      legalBasis:String(form.elements.legalBasis.value||'').trim().slice(0,5000),
      fees:String(form.elements.fees.value||'').trim().slice(0,500),
      duration:String(form.elements.duration.value||'').trim().slice(0,500),
      published:Boolean(form.elements.published.checked)
    };
    if(data.title.length<3){setStatus('عنوان الإجراء مطلوب ويجب ألا يقل عن 3 محارف.',true);return;}
    setStatus('جارٍ حفظ الإجراء في Firebase...',false);
    try{
      const db=window.publicAuth.firestore,stamp=firebase.firestore.FieldValue.serverTimestamp();
      let savedId=id;
      if(id)await db.collection('legalProcedures').doc(id).update({...data,updatedAt:stamp});
      else{
        data.createdAt=stamp;data.createdBy=window.publicAuth.user.uid;data.updatedAt=stamp;
        const ref=await db.collection('legalProcedures').add(data);savedId=ref.id;
      }
      const indexSynced=await syncPublicProcedureIndexItem({...data,id:savedId});
      resetLegalProcedure();activeProcedureAdminCategory=category;activeProcedureAdminStatus=data.published?'published':'unpublished';
      await loadLegalProcedures();setProcedureAdminPanel('library');
      setStatus(indexSynced?'تم حفظ الإجراء في Firebase وتحديث الفهرس.':'تم حفظ الإجراء في Firebase، لكن تعذر تحديث الفهرس العام.',!indexSynced);
    }catch(error){console.error('Legal procedure save failed:',error);setStatus('تعذر حفظ الإجراء في Firebase. '+String(error.message||''),true);}
  }

  async function loadProcedureAccessRequests(reset=true){return loadAccessDirectory('procedure',activeProcedureAccessView,reset);}
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

/* Integrated Mizan Forum administration — part of the main admin panel. */
/* إدارة منبر ميزان — لوحة إدارة متكاملة للمساهمين والمقالات. */
(function(){
  'use strict';

  const COLLECTION='mizanArticles';
  const CONTRIBUTORS='mizanContributors';
  let ready=false;
  const FORUM_PAGE_SIZE=50,forumPageStates=new Map();
  function resetForumPage(key){forumPageStates.set(key,{cursor:null,hasMore:true,loading:false});}
  async function fetchForumPage(key,queryFactory,reset=false){
    if(reset||!forumPageStates.has(key))resetForumPage(key);
    const state=forumPageStates.get(key);
    if(state.loading||!state.hasMore)return {docs:[],hasMore:state.hasMore};
    state.loading=true;
    try{
      let query=queryFactory();
      if(state.cursor)query=query.startAfter(state.cursor);
      const snapshot=await query.limit(FORUM_PAGE_SIZE).get();
      const docs=snapshot.docs||[];
      if(docs.length)state.cursor=docs[docs.length-1];
      state.hasMore=docs.length===FORUM_PAGE_SIZE;
      return {docs,hasMore:state.hasMore};
    }finally{state.loading=false;}
  }
  async function exactCount(collectionName,filters=[]){
    if(typeof window.mizanExactFirestoreCount!=='function')throw new Error('Firestore count bridge is unavailable.');
    return window.mizanExactFirestoreCount(collectionName,filters);
  }
  function addForumLoadMore(body,key,loader){
    body.querySelector('[data-forum-load-more]')?.remove();
    if(!forumPageStates.get(key)?.hasMore)return;
    const wrapper=document.createElement('div');
    wrapper.className='firebase-admin-load-more lawyer-admin-actions';
    wrapper.dataset.forumLoadMore='1';
    const button=document.createElement('button');
    button.type='button';button.className='approve';button.textContent='تحميل المزيد';
    button.onclick=async()=>{button.disabled=true;button.textContent='جارٍ التحميل...';await loader(false);};
    wrapper.appendChild(button);body.appendChild(wrapper);
  }

  const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const dateValue=v=>{
    if(!v)return'—';
    const d=v&&typeof v.toDate==='function'?v.toDate():new Date(v);
    return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('ar-IQ',{year:'numeric',month:'short',day:'numeric'});
  };
  const timeValue=v=>{
    if(!v)return'—';
    const d=v&&typeof v.toDate==='function'?v.toDate():new Date(v);
    return Number.isNaN(d.getTime())?'—':d.toLocaleString('ar-IQ',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  };

  function db(){return window.publicAuth?.firestore;}
  function currentUser(){return window.publicAuth?.currentUser||firebase.auth?.().currentUser;}

  function build(){
    if(ready)return;

    const section=document.getElementById('firebase-admin-section');
    const menu=document.getElementById('fa-admin-home');
    const navigation=document.getElementById('fa-admin-navigation');
    if(!section||!menu||!navigation)return;

    ready=true;

    if(!document.getElementById('mizan-admin-nav-item')){
      const item=document.createElement('button');
      item.type='button';
      item.id='mizan-admin-nav-item';
      item.className='firebase-admin-nav-item mizan-admin-nav-item';
      item.dataset.mizanAdminCard='1';
      item.innerHTML='<i class="fas fa-feather-pointed" aria-hidden="true"></i><span>منبر ميزان</span><span class="firebase-admin-nav-count" id="mizan-admin-nav-count" hidden>0</span>';
      item.addEventListener('click',open);
      navigation.appendChild(item);
    }
    section.querySelectorAll('[data-mizan-open]').forEach(button=>button.addEventListener('click',open));
    if(document.getElementById('mizan-admin-view'))return;
    window.addEventListener('mizan:refresh-forum-pending-counts',refreshPendingCounts);

    const view=document.createElement('section');
    view.id='mizan-admin-view';
    view.className='firebase-admin-subview';
    view.hidden=true;
    view.innerHTML=`
      <button type="button" class="firebase-admin-subview-back" data-mizan-admin-back>← العودة لأقسام الإدارة</button>
      <div class="firebase-admin-card">
        <div class="firebase-admin-card-head">
          <h3>منبر ميزان</h3>
          <div class="mizan-admin-head-actions">
            <span>إدارة المحتوى والمساهمين</span>
            <button type="button" class="btn btn-sm btn-green" data-mizan-direct-publish><i class="fas fa-pen-to-square"></i> نشر مقال مباشر</button>
          </div>
        </div>
        <div class="mizan-admin-stats" id="mizan-admin-stats"></div>
        <div class="mizan-admin-tabs">
          <button class="active" data-mizan-status="overview">الرئيسية</button>
          <button data-mizan-status="contributors">طلبات اعتماد المساهمين</button>
          <button data-mizan-status="approved-contributors">المساهمون</button>
          <button data-mizan-status="pending">قيد المراجعة</button>
          <button data-mizan-status="published">المنشورات</button>
          <button data-mizan-status="rejected">المرفوضة</button>
          <button data-mizan-status="hidden">المخفية</button>
        </div>
        <div id="mizan-admin-body" class="firebase-admin-record-list mizan-admin-record-list"><p class="firebase-admin-list-state">اختر تبويباً لعرض المحتوى.</p></div>
      </div>
    `;
    section.querySelector('.firebase-admin-subviews')?.appendChild(view);

    createModals(section);

    view.querySelector('[data-mizan-admin-back]').onclick=close;
    view.querySelectorAll('[data-mizan-status]').forEach(b=>{
      b.onclick=()=>{
        view.querySelectorAll('[data-mizan-status]').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        load(b.dataset.mizanStatus);
      };
    });
    view.querySelector('[data-mizan-direct-publish]').onclick=()=>openModal('mizan-direct-publish-modal');
    section.addEventListener('click',e=>{
      const a=e.target.closest('[data-mizan-action]');
      if(a)act(a.dataset.mizanAction,a.dataset.id);
    });

    document.getElementById('mizan-direct-publish-form').onsubmit=directPublish;
    document.getElementById('mizan-article-edit-form').onsubmit=saveArticleEdit;
  }

  function createModals(section){
    const wrap=document.createElement('div');
    wrap.innerHTML=`
      <div id="mizan-direct-publish-modal" class="mizan-admin-modal" hidden>
        <div class="mizan-admin-modal-box">
          <div class="mizan-admin-modal-head"><h3>نشر مقال مباشر</h3><button type="button" data-mizan-close="mizan-direct-publish-modal">×</button></div>
          <p>يظهر المقال مباشرة للزوار بحالة منشور.</p>
          <form id="mizan-direct-publish-form">
            <div class="mizan-admin-grid">
              <label>عنوان المقال<input name="title" required maxlength="180"></label>
              <label>نوع المشاركة<select name="type"><option>مقال قانوني</option><option>بحث ودراسة</option><option>فكرة ورأي قانوني</option><option>تجربة مهنية</option><option>قراءة وتعليق</option><option>أخرى</option></select></label>
              <label>اسم الكاتب<input name="authorName" required maxlength="120"></label>
              <label>الصفة المهنية<input name="authorTitle" maxlength="120" placeholder="أستاذ قانون / محامٍ / باحث..."></label>
              <label>التخصص<input name="authorSpecialization" maxlength="120"></label>
              <label>المقتطف المختصر<input name="excerpt" maxlength="300"></label>
              <label class="full">محتوى المقال<textarea name="content" required rows="12"></textarea></label>
            </div>
            <div class="mizan-admin-modal-actions"><button type="button" class="btn" data-mizan-close="mizan-direct-publish-modal">إلغاء</button><button type="submit" class="btn btn-green">نشر الآن</button></div>
          </form>
        </div>
      </div>

      <div id="mizan-article-view-modal" class="mizan-admin-modal" hidden>
        <div class="mizan-admin-modal-box">
          <div class="mizan-admin-modal-head"><h3>تفاصيل المشاركة</h3><button type="button" data-mizan-close="mizan-article-view-modal">×</button></div>
          <div id="mizan-article-view-body"></div>
          <div class="mizan-admin-modal-actions" id="mizan-article-view-actions"></div>
        </div>
      </div>

      <div id="mizan-article-edit-modal" class="mizan-admin-modal" hidden>
        <div class="mizan-admin-modal-box">
          <div class="mizan-admin-modal-head"><h3>تعديل المشاركة</h3><button type="button" data-mizan-close="mizan-article-edit-modal">×</button></div>
          <form id="mizan-article-edit-form">
            <input type="hidden" name="id">
            <div class="mizan-admin-grid">
              <label>عنوان المقال<input name="title" required maxlength="180"></label>
              <label>نوع المشاركة<select name="type"><option>مقال قانوني</option><option>بحث ودراسة</option><option>فكرة ورأي قانوني</option><option>تجربة مهنية</option><option>قراءة وتعليق</option><option>أخرى</option></select></label>
              <label>اسم الكاتب<input name="authorName" required maxlength="120"></label>
              <label>الصفة المهنية<input name="authorTitle" maxlength="120"></label>
              <label>التخصص<input name="authorSpecialization" maxlength="120"></label>
              <label>المقتطف المختصر<input name="excerpt" maxlength="300"></label>
              <label class="full">المحتوى<textarea name="content" required rows="14"></textarea></label>
            </div>
            <div class="mizan-admin-modal-actions"><button type="button" class="btn" data-mizan-close="mizan-article-edit-modal">إلغاء</button><button type="submit" class="btn btn-green">حفظ التعديلات</button></div>
          </form>
        </div>
      </div>

      <div id="mizan-reject-modal" class="mizan-admin-modal" hidden>
        <div class="mizan-admin-modal-box">
          <div class="mizan-admin-modal-head"><h3>رفض المشاركة</h3><button type="button" data-mizan-close="mizan-reject-modal">×</button></div>
          <p>أدخل سبب الرفض ليظهر محفوظاً في لوحة الإدارة ويمكن الرجوع إليه لاحقاً.</p>
          <textarea id="mizan-reject-reason" class="mizan-admin-reject-reason" rows="6"></textarea>
          <div class="mizan-admin-modal-actions"><button type="button" class="btn" data-mizan-close="mizan-reject-modal">إلغاء</button><button type="button" class="btn btn-red" id="mizan-confirm-reject">تأكيد الرفض</button></div>
        </div>
      </div>

      <div id="mizan-contributor-view-modal" class="mizan-admin-modal" hidden>
        <div class="mizan-admin-modal-box">
          <div class="mizan-admin-modal-head"><h3>تفاصيل طلب الاعتماد</h3><button type="button" data-mizan-close="mizan-contributor-view-modal">×</button></div>
          <div id="mizan-contributor-view-body"></div>
          <div class="mizan-admin-modal-actions" id="mizan-contributor-view-actions"></div>
        </div>
      </div>
    `;
    section.appendChild(wrap);
    section.querySelectorAll('[data-mizan-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.mizanClose));
  }

  function open(){
    build();
    const section=document.getElementById('firebase-admin-section');
    if(!section)return;
    section.querySelectorAll('.firebase-admin-subview').forEach(v=>{v.hidden=true;v.classList.remove('active');});
    document.getElementById('fa-admin-home').hidden=true;
    section.classList.remove('is-sidebar-open');
    section.querySelectorAll('.firebase-admin-nav-item').forEach(item=>item.classList.toggle('is-active',item.id==='mizan-admin-nav-item'));
    const mizanView=document.getElementById('mizan-admin-view');
    mizanView.hidden=false;
    mizanView.classList.add('active');
    setTab('overview');
    load('overview');
  }

  function close(){
    const section=document.getElementById('firebase-admin-section');
    if(!section)return;
    closeAllModals();
    const mizanView=document.getElementById('mizan-admin-view');
    mizanView.hidden=true;
    mizanView.classList.remove('active');
    document.querySelectorAll('.firebase-admin-subview').forEach(v=>{if(v.id!=='mizan-admin-view'){v.hidden=true;v.classList.remove('active');}});
    document.getElementById('fa-admin-home').hidden=false;
    section.querySelectorAll('.firebase-admin-nav-item').forEach(item=>item.classList.toggle('is-active',item.hasAttribute('data-admin-home')));
  }

  function updateTabCounts(counts){
    document.querySelectorAll('#mizan-admin-view [data-mizan-status]').forEach(button=>{
      const status=button.dataset.mizanStatus;
      const count=counts[status];
      let badge=button.querySelector('.mizan-admin-tab-count');
      if(count===undefined){
        badge?.remove();
        return;
      }
      if(!badge){
        badge=document.createElement('span');
        badge.className='mizan-admin-tab-count';
        badge.setAttribute('aria-label','العدد');
        button.appendChild(badge);
      }
      badge.textContent=String(count);
    });
  }

  let forumPendingArticles=null,forumPendingContributors=null;
  function setForumPendingCount(articles,contributors){
    forumPendingArticles=Math.max(0,Number(articles)||0);
    forumPendingContributors=Math.max(0,Number(contributors)||0);
    const total=forumPendingArticles+forumPendingContributors;
    const targets=[document.getElementById('mizan-admin-nav-count'),...document.querySelectorAll('[data-admin-count="forum"]')];
    targets.forEach(node=>{if(!node)return;node.textContent=String(total);node.hidden=total===0;});
  }
  function notifyForumPendingCounts(articleDelta=0,contributorDelta=0){
    window.dispatchEvent(new CustomEvent('mizan:refresh-forum-pending-counts',{detail:{articleDelta,contributorDelta}}));
  }
  async function refreshPendingCounts(event){
    if(event?.detail){
      if(forumPendingArticles===null||forumPendingContributors===null)return;
      setForumPendingCount(
        forumPendingArticles+(Number(event.detail.articleDelta)||0),
        forumPendingContributors+(Number(event.detail.contributorDelta)||0)
      );
      return;
    }
    const firestore=db();if(!firestore)return;
    try{
      const [articles,contributors]=await Promise.all([
        exactCount(COLLECTION,[['status','==','pending']]),
        exactCount(CONTRIBUTORS,[['status','==','pending']])
      ]);
      setForumPendingCount(articles,contributors);
    }catch(error){console.warn('تعذر تحديث مؤشرات منبر ميزان:',error);}
  }

  function setTab(status){
    document.querySelectorAll('#mizan-admin-view [data-mizan-status]').forEach(x=>x.classList.toggle('active',x.dataset.mizanStatus===status));
  }

  function openModal(id){const m=document.getElementById(id);if(m){m.hidden=false;document.body.classList.add('mizan-admin-modal-open');}}
  function closeModal(id){const m=document.getElementById(id);if(m)m.hidden=true;if(!document.querySelector('.mizan-admin-modal:not([hidden])'))document.body.classList.remove('mizan-admin-modal-open');}
  function closeAllModals(){document.querySelectorAll('.mizan-admin-modal').forEach(m=>m.hidden=true);document.body.classList.remove('mizan-admin-modal-open');}

  async function directPublish(e){
    e.preventDefault();
    const firestore=db(),form=e.currentTarget,user=currentUser();
    if(!firestore)return;
    const fd=new FormData(form);
    const title=String(fd.get('title')||'').trim(),content=String(fd.get('content')||'').trim();
    if(!title||!content){alert('أدخل عنوان المقال ومحتواه.');return;}
    const data={
      title,type:String(fd.get('type')||'مقال قانوني').trim(),
      authorName:String(fd.get('authorName')||'').trim(),
      authorTitle:String(fd.get('authorTitle')||'').trim(),
      authorSpecialization:String(fd.get('authorSpecialization')||'').trim(),
      excerpt:String(fd.get('excerpt')||'').trim(),content,
      authorUid:user?.uid||null,authorEmail:user?.email||null,status:'published',
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      publishedAt:firebase.firestore.FieldValue.serverTimestamp(),
      publishedDirectlyByAdmin:true
    };
    const submit=form.querySelector('button[type="submit"]');
    try{
      if(submit){submit.disabled=true;submit.textContent='جارٍ النشر...';}
      await firestore.collection(COLLECTION).add(data);
      form.reset();closeModal('mizan-direct-publish-modal');
      alert('تم نشر المقال مباشرة بنجاح.');
      setTab('published');load('published');
    }catch(e){console.error(e);alert('تعذر نشر المقال مباشرة. تحقق من صلاحيات Firestore.');}
    finally{if(submit){submit.disabled=false;submit.textContent='نشر الآن';}}
  }

  async function load(status,reset=true){
    const body=document.getElementById('mizan-admin-body'),firestore=db();
    if(!body||!firestore)return;
    if(status==='overview'){await loadOverview();return;}
    if(status==='contributors'){await loadContributors('pending',reset);return;}
    if(status==='approved-contributors'){await loadContributors('approved',reset);return;}
    const key='articles:'+status;
    try{
      const page=await fetchForumPage(key,()=>firestore.collection(COLLECTION).where('status','==',status),reset);
      const html=page.docs.map(d=>{
        const article=d.data()||{};
        const actionButtons=status==='pending'
          ? '<button class="btn btn-sm btn-green" data-mizan-action="publish" data-id="'+d.id+'">نشر</button><button class="btn btn-sm btn-red" data-mizan-action="reject" data-id="'+d.id+'">رفض</button>'
          : status==='published'
            ? '<button class="btn btn-sm" data-mizan-action="hide" data-id="'+d.id+'">إخفاء</button><button class="btn btn-sm" data-mizan-action="edit" data-id="'+d.id+'">تعديل</button><button class="btn btn-sm btn-red" data-mizan-action="delete" data-id="'+d.id+'">حذف</button>'
          : status==='rejected'
            ? '<button class="btn btn-sm" data-mizan-action="resubmit" data-id="'+d.id+'">إعادة للمراجعة</button><button class="btn btn-sm" data-mizan-action="edit" data-id="'+d.id+'">تعديل</button><button class="btn btn-sm btn-red" data-mizan-action="delete" data-id="'+d.id+'">حذف</button>'
            : '<button class="btn btn-sm btn-green" data-mizan-action="republish" data-id="'+d.id+'">إعادة النشر</button><button class="btn btn-sm" data-mizan-action="edit" data-id="'+d.id+'">تعديل</button><button class="btn btn-sm btn-red" data-mizan-action="delete" data-id="'+d.id+'">حذف</button>';
        return '<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">'+esc(article.type||'مشاركة')+'</span><h4>'+esc(article.title||'بدون عنوان')+'</h4></div><span class="lawyer-admin-status '+(status==='published'?'is-live':'is-off')+'">'+statusLabel(status)+'</span></div><div class="firebase-admin-record-field"><span>الكاتب</span><strong>'+esc(article.authorName||'غير محدد')+'</strong></div><div class="firebase-admin-record-field"><span>المقتطف</span><p>'+esc((article.excerpt||'لا يوجد مقتطف').slice(0,180))+'</p></div>'+(article.rejectionReason?'<div class="mizan-admin-reason">سبب الرفض: '+esc(article.rejectionReason)+'</div>':'')+'<div class="firebase-admin-record-meta">تاريخ الإرسال: '+esc(dateValue(article.createdAt))+'</div><div class="lawyer-admin-actions"><button type="button" data-mizan-action="view" data-id="'+d.id+'">عرض التفاصيل</button>'+actionButtons+'</div></article>';
      }).join('');
      if(reset)body.innerHTML='';
      if(html)body.insertAdjacentHTML('beforeend',html);
      if(reset&&!page.docs.length)body.innerHTML='<p class="firebase-admin-list-state">لا توجد مشاركات في هذه القائمة.</p>';
      addForumLoadMore(body,key,load.bind(null,status));
    }catch(error){console.error(error);if(reset)body.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل المشاركات. تحقق من صلاحيات Firestore.</p>';}
  }

  function statusLabel(s){return({pending:'قيد المراجعة',published:'منشور',rejected:'مرفوض',hidden:'مخفي'})[s]||s;}

  async function loadOverview(){
    const body=document.getElementById('mizan-admin-body'),firestore=db();
    if(!body||!firestore)return;
    body.innerHTML='<p class="firebase-admin-list-state">جارٍ تحديث الإحصائيات...</p>';
    try{
      const statuses=['pending','published','rejected','hidden'];
      const countsList=await Promise.all(statuses.map(status=>exactCount(COLLECTION,[['status','==',status]])));
      const [pendingContributors,approvedContributors]=await Promise.all([
        exactCount(CONTRIBUTORS,[['status','==','pending']]),
        exactCount(CONTRIBUTORS,[['status','==','approved']])
      ]);
      const counts={};statuses.forEach((status,index)=>counts[status]=countsList[index]);
      updateTabCounts({contributors:pendingContributors,'approved-contributors':approvedContributors,pending:counts.pending,published:counts.published,rejected:counts.rejected,hidden:counts.hidden});
      setForumPendingCount(counts.pending,pendingContributors);
      const stats=document.getElementById('mizan-admin-stats');
      if(stats)stats.innerHTML='<div class="mizan-admin-stat"><strong>'+Object.values(counts).reduce((a,b)=>a+b,0)+'</strong><span>إجمالي المشاركات</span></div><div class="mizan-admin-stat"><strong>'+counts.pending+'</strong><span>قيد المراجعة</span></div><div class="mizan-admin-stat"><strong>'+counts.published+'</strong><span>منشور</span></div><div class="mizan-admin-stat"><strong>'+counts.rejected+'</strong><span>مرفوض</span></div><div class="mizan-admin-stat"><strong>'+pendingContributors+'</strong><span>طلبات اعتماد</span></div>';
      body.innerHTML='<p class="firebase-admin-list-state">اختر من تبويبات منبر ميزان أعلاه لإدارة المشاركات وطلبات الاعتماد.</p>';
    }catch(error){console.error(error);body.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل إحصائيات المنبر.</p>';}
  }

  async function loadContributors(filterStatus='pending',reset=true){
    const body=document.getElementById('mizan-admin-body'),firestore=db();
    if(!body||!firestore)return;
    const key='contributors:'+filterStatus;
    try{
      const query=()=>filterStatus==='pending'
        ? firestore.collection(CONTRIBUTORS).where('status','==','pending')
        : firestore.collection(CONTRIBUTORS).where('status','in',['approved','blocked']);
      const page=await fetchForumPage(key,query,reset);
      const html=page.docs.map(doc=>{
        const contributor=doc.data()||{};
        const label=contributor.status==='approved'?'معتمد':contributor.status==='blocked'?'محظور':'قيد المراجعة';
        const buttons=contributor.status==='pending'
          ? '<button class="btn btn-sm btn-green" data-mizan-action="approve-contributor" data-id="'+doc.id+'">اعتماد</button><button class="btn btn-sm btn-red" data-mizan-action="reject-contributor" data-id="'+doc.id+'">رفض</button>'
          : contributor.status==='approved'
            ? '<button class="btn btn-sm" data-mizan-action="block-contributor" data-id="'+doc.id+'">حظر النشر</button><button class="btn btn-sm btn-red" data-mizan-action="delete-contributor" data-id="'+doc.id+'">حذف</button>'
            : '<button class="btn btn-sm btn-green" data-mizan-action="unblock-contributor" data-id="'+doc.id+'">إلغاء الحظر</button><button class="btn btn-sm btn-red" data-mizan-action="delete-contributor" data-id="'+doc.id+'">حذف</button>';
        return '<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">مساهم في منبر ميزان</span><h4>'+esc(contributor.fullName||'بدون اسم')+'</h4><span class="firebase-admin-record-sub">'+esc(contributor.email||'')+'</span></div><span class="lawyer-admin-status '+(contributor.status==='approved'?'is-live':'is-off')+'">'+label+'</span></div><div class="firebase-admin-record-field"><span>الصفة والتخصص</span><p>'+esc(contributor.role||'—')+' · '+esc(contributor.specialization||'—')+'</p></div><div class="firebase-admin-record-field"><span>جهة العمل</span><p>'+esc(contributor.affiliation||'غير محددة')+'</p></div><div class="firebase-admin-record-meta">تاريخ الطلب: '+esc(dateValue(contributor.createdAt))+'</div><div class="lawyer-admin-actions"><button type="button" data-mizan-action="view-contributor" data-id="'+doc.id+'">عرض التفاصيل</button>'+buttons+'</div></article>';
      }).join('');
      if(reset)body.innerHTML='';
      if(html)body.insertAdjacentHTML('beforeend',html);
      if(reset&&!page.docs.length)body.innerHTML='<p class="firebase-admin-list-state">'+(filterStatus==='pending'?'لا توجد طلبات اعتماد معلقة.':'لا يوجد مساهمون معتمدون أو محظورون.')+'</p>';
      addForumLoadMore(body,key,loadContributors.bind(null,filterStatus));
    }catch(error){console.error(error);if(reset)body.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل طلبات الاعتماد.</p>';}
  }

  async function fetchDoc(collection,id){const firestore=db();if(!firestore)return null;const snap=await firestore.collection(collection).doc(id).get();return snap.exists?{id:snap.id,data:snap.data()||{}}:null;}

  async function showArticle(id){
    try{
      const item=await fetchDoc(COLLECTION,id);if(!item)return;
      const a=item.data;
      document.getElementById('mizan-article-view-body').innerHTML='<div class="mizan-admin-detail-list"><div class="mizan-admin-detail-item"><b>العنوان</b>'+esc(a.title)+'</div><div class="mizan-admin-detail-item"><b>النوع</b>'+esc(a.type)+'</div><div class="mizan-admin-detail-item"><b>الكاتب</b>'+esc(a.authorName)+'</div><div class="mizan-admin-detail-item"><b>الصفة</b>'+esc(a.authorTitle||'—')+'</div><div class="mizan-admin-detail-item"><b>التخصص</b>'+esc(a.authorSpecialization||'—')+'</div><div class="mizan-admin-detail-item"><b>التاريخ</b>'+esc(timeValue(a.createdAt))+'</div></div><p><strong>المقتطف:</strong> '+esc(a.excerpt||'—')+'</p>'+(a.rejectionReason?'<div class="mizan-admin-reason"><strong>سبب الرفض:</strong> '+esc(a.rejectionReason)+'</div>':'')+'<h4>محتوى المشاركة</h4><div class="mizan-admin-content">'+esc(a.content||'')+'</div>';
      const actions=document.getElementById('mizan-article-view-actions');
      let html='<button type="button" class="btn" data-mizan-view-edit>تعديل</button>';
      if(a.status==='pending')html+='<button type="button" class="btn btn-green" data-mizan-view-publish>نشر</button><button type="button" class="btn btn-red" data-mizan-view-reject>رفض</button>';
      if(a.status==='published')html+='<button type="button" class="btn" data-mizan-view-hide>إخفاء</button>';
      if(a.status==='rejected')html+='<button type="button" class="btn" data-mizan-view-resubmit>إعادة للمراجعة</button>';
      if(a.status==='hidden')html+='<button type="button" class="btn btn-green" data-mizan-view-republish>إعادة النشر</button>';
      html+='<button type="button" class="btn btn-red" data-mizan-view-delete>حذف</button>';
      actions.innerHTML=html;
      actions.querySelector('[data-mizan-view-edit]').onclick=()=>{closeModal('mizan-article-view-modal');openEdit(item.id,a);};
      actions.querySelector('[data-mizan-view-publish]')?.addEventListener('click',()=>act('publish',item.id));
      actions.querySelector('[data-mizan-view-reject]')?.addEventListener('click',()=>act('reject',item.id));
      actions.querySelector('[data-mizan-view-hide]')?.addEventListener('click',()=>act('hide',item.id));
      actions.querySelector('[data-mizan-view-resubmit]')?.addEventListener('click',()=>act('resubmit',item.id));
      actions.querySelector('[data-mizan-view-republish]')?.addEventListener('click',()=>act('republish',item.id));
      actions.querySelector('[data-mizan-view-delete]')?.addEventListener('click',()=>act('delete',item.id));
      openModal('mizan-article-view-modal');
    }catch(e){console.error(e);alert('تعذر عرض المشاركة.');}
  }

  async function showContributor(id){
    try{
      const item=await fetchDoc(CONTRIBUTORS,id);if(!item)return;
      const a=item.data;
      document.getElementById('mizan-contributor-view-body').innerHTML='<div class="mizan-admin-detail-list"><div class="mizan-admin-detail-item"><b>الاسم الكامل</b>'+esc(a.fullName)+'</div><div class="mizan-admin-detail-item"><b>الصفة</b>'+esc(a.role)+'</div><div class="mizan-admin-detail-item"><b>التخصص</b>'+esc(a.specialization)+'</div><div class="mizan-admin-detail-item"><b>الجامعة / جهة العمل</b>'+esc(a.affiliation||'—')+'</div><div class="mizan-admin-detail-item"><b>البريد الإلكتروني</b>'+esc(a.email||'—')+'</div><div class="mizan-admin-detail-item"><b>تاريخ الطلب</b>'+esc(timeValue(a.createdAt))+'</div></div><h4>النبذة المهنية</h4><div class="mizan-admin-content">'+esc(a.bio||'—')+'</div>';
      const actions=document.getElementById('mizan-contributor-view-actions');
      actions.innerHTML='<button type="button" class="btn btn-green">اعتماد المساهم</button><button type="button" class="btn btn-red">رفض الطلب</button>';
      actions.children[0].onclick=()=>act('approve-contributor',item.id);
      actions.children[1].onclick=()=>act('reject-contributor',item.id);
      openModal('mizan-contributor-view-modal');
    }catch(e){console.error(e);alert('تعذر عرض الطلب.');}
  }

  function openEdit(id,a){
    const form=document.getElementById('mizan-article-edit-form');
    Object.entries({id,title:a.title||'',type:a.type||'مقال قانوني',authorName:a.authorName||'',authorTitle:a.authorTitle||'',authorSpecialization:a.authorSpecialization||'',excerpt:a.excerpt||'',content:a.content||''}).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v;});
    openModal('mizan-article-edit-modal');
  }

  async function saveArticleEdit(e){
    e.preventDefault();
    const firestore=db(),form=e.currentTarget,id=formValue(form,'id');
    if(!firestore||!id)return;
    const data={title:formValue(form,'title'),type:formValue(form,'type'),authorName:formValue(form,'authorName'),authorTitle:formValue(form,'authorTitle'),authorSpecialization:formValue(form,'authorSpecialization'),excerpt:formValue(form,'excerpt'),content:formValue(form,'content'),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
    if(!data.title||!data.content){alert('العنوان والمحتوى مطلوبان.');return;}
    try{
      const submit=form.querySelector('button[type="submit"]');if(submit){submit.disabled=true;submit.textContent='جارٍ الحفظ...';}
      await firestore.collection(COLLECTION).doc(id).update(data);
      closeModal('mizan-article-edit-modal');
      alert('تم حفظ التعديلات.');
      const active=document.querySelector('#mizan-admin-view [data-mizan-status].active')?.dataset.mizanStatus||'overview';
      load(active);
    }catch(e){console.error(e);alert('تعذر حفظ التعديلات.');}
    finally{const submit=form.querySelector('button[type="submit"]');if(submit){submit.disabled=false;submit.textContent='حفظ التعديلات';}}
  }

  function formValue(form,name){return String(form.elements[name]?.value||'').trim();}

  async function act(action,id){
    const firestore=db();if(!firestore||!id)return;
    if(action==='view'){await showArticle(id);return;}
    if(action==='view-contributor'){await showContributor(id);return;}
    if(action==='block-contributor'){
      if(!confirm('حظر هذا المساهم من نشر مشاركات جديدة؟'))return;
      await firestore.collection(CONTRIBUTORS).doc(id).update({status:'blocked',blockedAt:firebase.firestore.FieldValue.serverTimestamp()});
      await firestore.collection('mizanContributorPublic').doc(id).delete().catch(()=>{});
      alert('تم حظر المساهم من النشر.'); setTab('approved-contributors'); load('approved-contributors'); return;
    }
    if(action==='unblock-contributor'){
      const contributorSnap=await firestore.collection(CONTRIBUTORS).doc(id).get();
      const contributorData=contributorSnap.exists ? (contributorSnap.data()||{}) : {};
      await firestore.collection(CONTRIBUTORS).doc(id).update({status:'approved',unblockedAt:firebase.firestore.FieldValue.serverTimestamp()});
      await firestore.collection('mizanContributorPublic').doc(id).set({
        fullName:contributorData.fullName||'',
        role:contributorData.role||'',
        specialization:contributorData.specialization||'',
        bio:contributorData.bio||'',
        status:'approved',
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
      alert('تم إلغاء حظر المساهم.'); setTab('approved-contributors'); load('approved-contributors'); return;
    }
    if(action==='delete-contributor'&&confirm('حذف حساب هذا المساهم نهائياً؟')){
      await firestore.collection(CONTRIBUTORS).doc(id).delete();
      await firestore.collection('mizanContributorPublic').doc(id).delete().catch(()=>{});
      alert('تم حذف المساهم.'); setTab('approved-contributors'); load('approved-contributors'); return;
    }
    try{
      const ref=firestore.collection(COLLECTION).doc(id);
      if(action==='approve-contributor'){
        const contributorSnap=await firestore.collection(CONTRIBUTORS).doc(id).get();
        const contributorData=contributorSnap.exists ? (contributorSnap.data()||{}) : {};
        await firestore.collection(CONTRIBUTORS).doc(id).update({status:'approved',approvedAt:firebase.firestore.FieldValue.serverTimestamp()});
        await firestore.collection('mizanContributorPublic').doc(id).set({
          fullName:contributorData.fullName||'',
          role:contributorData.role||'',
          specialization:contributorData.specialization||'',
          bio:contributorData.bio||'',
          status:'approved',
          updatedAt:firebase.firestore.FieldValue.serverTimestamp()
        },{merge:true});
        closeModal('mizan-contributor-view-modal');notifyForumPendingCounts(0,-1);alert('تم اعتماد المساهم.');
        setTab('contributors');load('contributors');return;
      }
      if(action==='reject-contributor'){
        await firestore.collection(CONTRIBUTORS).doc(id).update({status:'rejected',rejectedAt:firebase.firestore.FieldValue.serverTimestamp()});
        closeModal('mizan-contributor-view-modal');notifyForumPendingCounts(0,-1);alert('تم رفض طلب الاعتماد.');
        setTab('contributors');load('contributors');return;
      }
      if(action==='reject'){
        document.getElementById('mizan-reject-reason').value='';
        openModal('mizan-reject-modal');
        const confirmBtn=document.getElementById('mizan-confirm-reject');
        confirmBtn.onclick=async()=>{
          const reason=document.getElementById('mizan-reject-reason').value.trim();
          if(!reason){alert('اكتب سبب الرفض أولاً.');return;}
          try{
            await ref.update({status:'rejected',rejectionReason:reason,rejectedAt:firebase.firestore.FieldValue.serverTimestamp()});
            notifyForumPendingCounts(-1,0);closeModal('mizan-reject-modal');closeModal('mizan-article-view-modal');
            alert('تم رفض المشاركة وحفظ السبب.');
            setTab('rejected');load('rejected');
          }catch(e){console.error(e);alert('تعذر رفض المشاركة.');}
        };
        return;
      }
      if(action==='publish'){
        await ref.update({status:'published',publishedAt:firebase.firestore.FieldValue.serverTimestamp()});
        notifyForumPendingCounts(-1,0);closeModal('mizan-article-view-modal');alert('تم نشر المشاركة.');
        setTab('published');load('published');return;
      }
      if(action==='hide'){
        await ref.update({status:'hidden',hiddenAt:firebase.firestore.FieldValue.serverTimestamp()});
        closeModal('mizan-article-view-modal');alert('تم إخفاء المشاركة من واجهة الزوار.');
        setTab('hidden');load('hidden');return;
      }
      if(action==='republish'){
        await ref.update({status:'published',publishedAt:firebase.firestore.FieldValue.serverTimestamp()});
        closeModal('mizan-article-view-modal');alert('تمت إعادة نشر المشاركة.');
        setTab('published');load('published');return;
      }
      if(action==='resubmit'){
        await ref.update({status:'pending',resubmittedAt:firebase.firestore.FieldValue.serverTimestamp(),rejectionReason:firebase.firestore.FieldValue.delete()});
        notifyForumPendingCounts(1,0);closeModal('mizan-article-view-modal');alert('أعيدت المشاركة إلى قائمة المراجعة.');
        setTab('pending');load('pending');return;
      }
      if(action==='edit'){
        const item=await fetchDoc(COLLECTION,id);if(item)openEdit(id,item.data);
        return;
      }
      if(action==='delete'&&confirm('حذف هذه المشاركة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')){
        const active=document.querySelector('#mizan-admin-view [data-mizan-status].active')?.dataset.mizanStatus||'overview';
        await ref.delete();
        if(active==='pending')notifyForumPendingCounts(-1,0);
        closeModal('mizan-article-view-modal');alert('تم حذف المشاركة نهائياً.');
        load(active);
      }
    }catch(e){console.error(e);alert('تعذر تنفيذ الإجراء. تحقق من صلاحيات Firestore.');}
  }

  window.addEventListener('firebase-admin-state-changed',e=>{if(e.detail?.isAdmin)setTimeout(build,0);});
  if(window.firebaseAdminPanel?.isAdmin===true)setTimeout(build,0);
  document.addEventListener('DOMContentLoaded',()=>{if(window.firebaseAdminPanel?.isAdmin===true)setTimeout(build,0);});
  window.addEventListener('public-auth-state-changed',()=>{if(ready)refreshPendingCounts();});
})();
