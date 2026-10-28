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
    if(!document.querySelector('link[data-lawyer-admin-css]')){const css=document.createElement('link');css.rel='stylesheet';css.href='assets/css/lawyer-admin.css?v=1.20';css.dataset.lawyerAdminCss='1';document.head.appendChild(css);}
    const header=document.querySelector('header');if(!header)return;
    const tab=existingTab||document.createElement('button');
    if(!existingTab){
      tab.id='firebase-admin-tab';tab.type='button';tab.className='firebase-admin-tab';
      tab.innerHTML='<i class="fas fa-crown" aria-hidden="true"></i><span>الإدارة</span>';
      tab.title='لوحة إدارة Firebase';tab.setAttribute('aria-label','لوحة إدارة Firebase');
      tab.hidden=true;tab.addEventListener('click',openPanel);header.appendChild(tab);
    }
    const main=document.querySelector('main.container');if(!main)return;const section=document.createElement('section');section.id='firebase-admin-section';section.className='view-section firebase-admin-view';section.hidden=true;
    section.innerHTML=`<div class="firebase-admin-head"><div><div class="firebase-admin-kicker">⚖️ لوحة الإدارة</div><h2>لوحة إدارة المنصة</h2><p id="firebase-admin-welcome">تم التحقق من صلاحية الإدارة.</p></div><button id="firebase-admin-refresh" class="firebase-admin-action" type="button">↻ تحديث البيانات</button></div><div id="firebase-admin-status" class="firebase-admin-status" hidden></div><div id="fa-admin-home" class="firebase-admin-home"><div class="firebase-admin-menu"><button type="button" class="firebase-admin-menu-card" data-admin-view="students"><i class="fas fa-users"></i><strong>الطلاب المسجلون</strong><span>عرض حسابات الطلاب المسجلين</span></button><button type="button" class="firebase-admin-menu-card" data-admin-view="lawyers"><i class="fas fa-user-tie"></i><strong>إدارة دليل المحامين</strong><span>الطلبات والملفات المنشورة</span></button><button type="button" class="firebase-admin-menu-card" data-admin-view="procedures"><i class="fas fa-file-signature"></i><strong>طلبات إجراءات الدعاوى</strong><span>مراجعة طلبات الوصول ومنح الصلاحية أو سحبها</span></button></div></div><div class="firebase-admin-subviews"><section id="fa-admin-view-students" class="firebase-admin-subview"><button type="button" class="firebase-admin-subview-back" data-admin-home>← العودة لأقسام الإدارة</button><div class="firebase-admin-stats"><div class="firebase-admin-stat"><span>إجمالي الطلاب</span><strong id="fa-students-count">—</strong></div></div><div class="firebase-admin-card"><div class="firebase-admin-card-head"><h3>👥 الطلاب المسجلون</h3><span id="fa-students-updated"></span></div><div class="firebase-admin-table-wrap"><table><thead><tr><th>الاسم</th><th>البريد</th><th>التسجيل</th></tr></thead><tbody id="fa-students-body"><tr><td colspan="3">جارٍ التحميل...</td></tr></tbody></table></div></div></section><section id="fa-admin-view-lawyers" class="firebase-admin-subview"><button type="button" class="firebase-admin-subview-back" data-admin-home>← العودة لأقسام الإدارة</button><div class="firebase-admin-card lawyer-admin-card">
      <div class="firebase-admin-card-head"><h3>👨‍⚖️ إدارة دليل المحامين</h3><span>الطلبات والملفات المنشورة</span></div>
      <div class="lawyer-admin-tabs">
        <button type="button" class="lawyer-admin-tab active" data-lawyer-view="pending">الطلبات <span id="fa-lawyers-pending-count">0</span></button>
        <button type="button" class="lawyer-admin-tab" data-lawyer-view="published">المحامون المنشورون <span id="fa-lawyers-published-count">0</span></button>
        <button type="button" class="lawyer-admin-tab" data-lawyer-view="edits">طلبات التعديل <span id="fa-lawyer-edit-requests-count">0</span></button>
      </div>
      <div id="fa-lawyers-pending-panel">
        <div class="firebase-admin-table-wrap"><table class="lawyer-admin-table"><thead><tr><th>المحامي</th><th>الموقع</th><th>الاختصاص</th><th>التقديم</th><th>الهوية</th><th>الإجراء</th></tr></thead><tbody id="fa-lawyers-body"><tr><td colspan="6">جارٍ التحميل...</td></tr></tbody></table></div>
      </div>
      <div id="fa-lawyers-edit-requests-panel" hidden>
        <div class="firebase-admin-table-wrap"><table class="lawyer-admin-table"><thead><tr><th>المحامي</th><th>التعديلات</th><th>التاريخ</th><th>الإجراء</th></tr></thead><tbody id="fa-lawyer-edit-requests-body"><tr><td colspan="4">جارٍ التحميل...</td></tr></tbody></table></div>
      </div>
      <div id="fa-lawyers-published-panel" hidden>
        <div class="firebase-admin-table-wrap"><table class="lawyer-admin-table"><thead><tr><th>المحامي</th><th>الموقع</th><th>الاختصاص</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody id="fa-lawyers-published-body"><tr><td colspan="5">جارٍ التحميل...</td></tr></tbody></table></div>
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
        <div class="firebase-admin-card-head"><h3>🔐 طلبات الوصول إلى إجراءات الدعاوى</h3><span>الموافقة اليدوية وإدارة الصلاحيات</span></div>
        <p class="lawyer-admin-note">لا يحصل المستخدم على الوصول إلا بعد منح الصلاحية. سحب الصلاحية يمنع قراءة محتوى الإجراءات المحمي في Firestore.</p>
        <div class="firebase-admin-table-wrap"><table class="lawyer-admin-table"><thead><tr><th>المستخدم</th><th>سبب الطلب</th><th>التقديم</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody id="fa-procedures-requests-body"><tr><td colspan="5">اختر هذا القسم لتحميل الطلبات.</td></tr></tbody></table></div>
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
        <div class="firebase-admin-table-wrap"><table class="lawyer-admin-table"><thead><tr><th>عنوان الإجراء</th><th>الحالة</th><th>آخر تحديث</th><th>الإجراء</th></tr></thead><tbody id="fa-procedures-content-body"><tr><td colspan="4">اختر هذا القسم لتحميل الإجراءات.</td></tr></tbody></table></div>
      </div>
    </section></div>
    <button id="firebase-admin-back" class="firebase-admin-back" type="button">← العودة للموقع</button>`
    const footer=document.querySelector('footer');if(footer&&footer.parentNode)footer.parentNode.insertBefore(section,footer);else document.body.appendChild(section);
    els={tab,section,status:section.querySelector('#firebase-admin-status'),welcome:section.querySelector('#firebase-admin-welcome'),refresh:section.querySelector('#firebase-admin-refresh'),back:section.querySelector('#firebase-admin-back'),studentsCount:section.querySelector('#fa-students-count'),studentsUpdated:section.querySelector('#fa-students-updated'),studentsBody:section.querySelector('#fa-students-body'),proceduresRequestsBody:section.querySelector('#fa-procedures-requests-body'),procedureForm:section.querySelector('#fa-procedure-form'),proceduresContentBody:section.querySelector('#fa-procedures-content-body'),procedureReset:section.querySelector('#fa-procedure-reset'),lawyersBody:section.querySelector('#fa-lawyers-body'),lawyersPublishedBody:section.querySelector('#fa-lawyers-published-body'),lawyersPendingCount:section.querySelector('#fa-lawyers-pending-count'),lawyersPublishedCount:section.querySelector('#fa-lawyers-published-count'),lawyerEditRequestsBody:section.querySelector('#fa-lawyer-edit-requests-body'),lawyerEditRequestsCount:section.querySelector('#fa-lawyer-edit-requests-count'),lawyerEdit:section.querySelector('#fa-lawyer-edit'),lawyerEditForm:section.querySelector('#fa-lawyer-edit-form'),lawyerEditTitle:section.querySelector('#fa-lawyer-edit-title'),lawyerEditClose:section.querySelector('#fa-lawyer-edit-close'),lawyerEditCancel:section.querySelector('#fa-lawyer-edit-cancel')};
    els.refresh?.addEventListener('click',loadDashboard);els.back?.addEventListener('click',closePanel);
    els.section.querySelectorAll('[data-admin-view]').forEach(btn=>btn.addEventListener('click',()=>switchAdminView(btn.dataset.adminView)));
    els.section.querySelectorAll('[data-admin-home]').forEach(btn=>btn.addEventListener('click',showAdminHome));
els.lawyerEditClose?.addEventListener('click',closeLawyerEdit);els.lawyerEditCancel?.addEventListener('click',closeLawyerEdit);els.lawyerEditForm?.addEventListener('submit',saveLawyerEdit);
els.section.querySelectorAll('[data-lawyer-view]').forEach(btn=>btn.addEventListener('click',()=>switchLawyerView(btn.dataset.lawyerView)));
     els.procedureForm?.addEventListener('submit',saveLegalProcedure);els.procedureReset?.addEventListener('click',resetLegalProcedure);
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
  function switchAdminView(view){
    const home=els.section.querySelector('#fa-admin-home');
    if(home)home.hidden=true;
    els.section.querySelectorAll('.firebase-admin-subview').forEach(panel=>panel.classList.toggle('active',panel.id==='fa-admin-view-'+view));
    if(view!=='lawyers'&&els.lawyerEdit)closeLawyerEdit();
    if(view==='procedures'){loadProcedureAccessRequests();loadLegalProcedures();}
  }
  function showAdminHome(){
    const home=els.section.querySelector('#fa-admin-home');
    if(home)home.hidden=false;
    els.section.querySelectorAll('.firebase-admin-subview').forEach(panel=>panel.classList.remove('active'));
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
     panelOpen=true;
     els.section.hidden=false;
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
  function closePanel(){
     if(!panelOpen)return;
     const routed=history.state?.view==='firebase-admin';
     const footer=document.querySelector('footer');
     els.section.hidden=true;
     els.section.classList.remove('active');
     if(footer)footer.hidden=false;
     panelOpen=false;
     if(routed&&window.app?.navigateTo){
       window.app.navigateTo('home');
       return;
     }
     restoreMainViews();
   }
  async function loadDashboard(){if(!isAdmin||!window.publicAuth?.firestore)return;setStatus('جارٍ تحميل بيانات الطلاب...');try{const db=window.publicAuth.firestore;const studentsSnap=await db.collection('students').get();const students=studentsSnap.docs.map(d=>d.data());els.studentsCount.textContent=students.length;students.sort((a,b)=>String(a.email||'').localeCompare(String(b.email||'')));els.studentsBody.innerHTML=students.length?students.map(s=>`<tr><td>${esc(s.displayName||'—')}</td><td>${esc(s.email||'—')}</td><td>${dateValue(s.createdAt)}</td></tr>`).join(''):'<tr><td colspan="3">لا يوجد طلاب مسجلون.</td></tr>';els.studentsUpdated.textContent=timeValue(new Date());await loadLawyerManagement();setStatus('');}catch(e){console.error(e);setStatus('تعذر تحميل بيانات الإدارة. تحقق من قواعد Firestore وصلاحية الحساب.',true);}}  async function loadLawyerManagement(){
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
      const profilesById=new Map(lawyerProfiles.map(p=>[p.id,p]));
      els.lawyerEditRequestsBody.innerHTML=requests.length?requests.map(r=>{
        const p=profilesById.get(r.profileId)||{};
        const d=r.data||{};
        const changes=['phone','address','office','workingHours','specializations','governorate','district','name'].filter(k=>String(d[k]??'')!==String(p[k]??''));
        const labels={phone:'الهاتف',address:'العنوان',office:'المكتب',workingHours:'الدوام',specializations:'الاختصاصات',governorate:'المحافظة',district:'القضاء/المنطقة',name:'الاسم'};
        return '<tr><td><strong>'+esc(p.name||d.name||'المحامي')+'</strong><div class="lawyer-admin-status">'+esc(r.applicantEmail||'')+'</div></td><td>'+esc(changes.map(k=>labels[k]).join('، ')||'تحديث بيانات')+'</td><td>'+esc(dateValue(r.createdAt))+'</td><td><div class="lawyer-admin-actions"><button class="approve" data-lawyer-edit-approve="'+esc(r.id)+'">✓ اعتماد التعديل</button><button class="reject" data-lawyer-edit-reject="'+esc(r.id)+'">✕ رفض</button></div></td></tr>';
      }).join(''):'<tr><td colspan="4">لا توجد طلبات تعديل قيد المراجعة.</td></tr>';
      els.lawyerEditRequestsBody.querySelectorAll('[data-lawyer-edit-approve]').forEach(el=>el.onclick=()=>approveLawyerEditRequest(requests.find(x=>x.id===el.dataset.lawyerEditApprove)));
      els.lawyerEditRequestsBody.querySelectorAll('[data-lawyer-edit-reject]').forEach(el=>el.onclick=()=>rejectLawyerEditRequest(requests.find(x=>x.id===el.dataset.lawyerEditReject)));
    }catch(e){console.error('Lawyer edit requests load failed:',e);els.lawyerEditRequestsBody.innerHTML='<tr><td colspan="4">تعذر تحميل طلبات التعديل.</td></tr>';}
  }

  async function loadLawyerApplications(){
    if(!isAdmin||!window.publicAuth?.firestore||!els.lawyersBody)return;
    try{
      const snap=await window.publicAuth.firestore.collection('lawyerApplications').where('status','==','pending').get();
      lawyerApplications=snap.docs.map(d=>({id:d.id,...d.data()}));
      lawyerApplications.sort((a,b)=>{const av=a.createdAt&&typeof a.createdAt.toMillis==='function'?a.createdAt.toMillis():0,bv=b.createdAt&&typeof b.createdAt.toMillis==='function'?b.createdAt.toMillis():0;return bv-av;});
      if(els.lawyersPendingCount)els.lawyersPendingCount.textContent=lawyerApplications.length;
      els.lawyersBody.innerHTML=lawyerApplications.length?lawyerApplications.map(a=>`<tr><td><strong>${esc(a.name)}</strong><div class="lawyer-admin-status">${esc(a.applicantEmail||'')}</div></td><td>${esc([a.governorate,a.district].filter(Boolean).join(' — '))}<br>${esc(a.phone||'')}</td><td>${esc((a.specializations||[]).join('، '))}</td><td>${esc(dateValue(a.createdAt))}</td><td><span class="lawyer-admin-external"><i class="fas fa-arrow-up-right-from-square"></i> خارج المنصة</span></td><td><div class="lawyer-admin-actions"><button class="approve" data-lawyer-approve="${esc(a.id)}">✓ موافقة ونشر</button><button class="reject" data-lawyer-reject="${esc(a.id)}">✕ رفض</button><button data-lawyer-edit-app="${esc(a.id)}">✎ تعديل</button><button data-lawyer-delete-app="${esc(a.id)}">🗑 حذف</button></div></td></tr>`).join(''):'<tr><td colspan="6">لا توجد طلبات قيد المراجعة.</td></tr>';
      els.lawyersBody.querySelectorAll('[data-lawyer-approve]').forEach(el=>el.onclick=()=>approveLawyer(lawyerApplications.find(x=>x.id===el.dataset.lawyerApprove)));
      els.lawyersBody.querySelectorAll('[data-lawyer-reject]').forEach(el=>el.onclick=()=>rejectLawyer(lawyerApplications.find(x=>x.id===el.dataset.lawyerReject)));
      els.lawyersBody.querySelectorAll('[data-lawyer-edit-app]').forEach(el=>el.onclick=()=>openLawyerEdit(lawyerApplications.find(x=>x.id===el.dataset.lawyerEditApp),'application'));
      els.lawyersBody.querySelectorAll('[data-lawyer-delete-app]').forEach(el=>el.onclick=()=>deleteLawyerApplication(lawyerApplications.find(x=>x.id===el.dataset.lawyerDeleteApp)));
    }catch(e){console.error('Lawyer applications load failed:',e);els.lawyersBody.innerHTML='<tr><td colspan="6">تعذر تحميل طلبات المحامين. تحقق من القواعد.</td></tr>';}
  }

  async function loadLawyerProfiles(){
    if(!isAdmin||!window.publicAuth?.firestore||!els.lawyersPublishedBody)return;
    try{
      const snap=await window.publicAuth.firestore.collection('lawyerProfiles').get();
      lawyerProfiles=snap.docs.map(d=>({id:d.id,...d.data()}));
      lawyerProfiles.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ar'));
      if(els.lawyersPublishedCount)els.lawyersPublishedCount.textContent=lawyerProfiles.length;
      els.lawyersPublishedBody.innerHTML=lawyerProfiles.length?lawyerProfiles.map(p=>`<tr><td><strong>${esc(p.name)}</strong></td><td>${esc([p.governorate,p.district].filter(Boolean).join(' — '))}<br>${esc(p.phone||'')}</td><td>${esc((p.specializations||[]).join('، '))}</td><td><span class="lawyer-admin-status ${p.published?'is-live':'is-off'}">${p.published?'● ظاهر للطلاب':'● معطّل عن الظهور'}</span></td><td><div class="lawyer-admin-actions"><button data-lawyer-edit-profile="${esc(p.id)}">✎ تعديل</button><button class="${p.published?'reject':'approve'}" data-lawyer-toggle="${esc(p.id)}">${p.published?'🚫 تعطيل الظهور':'✓ إعادة التفعيل'}</button><button class="reject" data-lawyer-delete-profile="${esc(p.id)}">🗑 حذف</button></div></td></tr>`).join(''):'<tr><td colspan="5">لا توجد ملفات محامين.</td></tr>';
      els.lawyersPublishedBody.querySelectorAll('[data-lawyer-edit-profile]').forEach(el=>el.onclick=()=>openLawyerEdit(lawyerProfiles.find(x=>x.id===el.dataset.lawyerEditProfile),'profile'));
      els.lawyersPublishedBody.querySelectorAll('[data-lawyer-toggle]').forEach(el=>el.onclick=()=>toggleLawyerVisibility(lawyerProfiles.find(x=>x.id===el.dataset.lawyerToggle)));
      els.lawyersPublishedBody.querySelectorAll('[data-lawyer-delete-profile]').forEach(el=>el.onclick=()=>deleteLawyerProfile(lawyerProfiles.find(x=>x.id===el.dataset.lawyerDeleteProfile)));
    }catch(e){console.error('Lawyer profiles load failed:',e);els.lawyersPublishedBody.innerHTML='<tr><td colspan="5">تعذر تحميل ملفات المحامين. تحقق من قواعد Firestore.</td></tr>';}
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
    const body=els.proceduresContentBody;body.innerHTML='<tr><td colspan="4">جارٍ تحميل الإجراءات...</td></tr>';
    try{
      const snap=await window.publicAuth.firestore.collection('legalProcedures').get();
      const items=snap.docs.map(doc=>({id:doc.id,...doc.data()})).sort((a,b)=>String(a.title||'').localeCompare(String(b.title||''),'ar'));
      let indexSynced=false;
      try{indexSynced=await syncPublicProcedureIndex(items);}catch(indexError){console.error('Public procedure index sync failed:',indexError);}
      body.innerHTML=items.length?items.map(item=>'<tr><td><strong>'+esc(item.title||'بدون عنوان')+'</strong></td><td><span class="lawyer-admin-status '+(item.published?'is-live':'is-off')+'">'+(item.published?'منشور':'مسودة / مخفي')+'</span></td><td>'+esc(dateValue(item.updatedAt))+'</td><td><div class="lawyer-admin-actions"><button type="button" data-procedure-edit="'+esc(item.id)+'">تعديل</button><button type="button" class="'+(item.published?'reject':'approve')+'" data-procedure-toggle="'+esc(item.id)+'">'+(item.published?'إخفاء':'نشر')+'</button><button type="button" class="reject" data-procedure-delete="'+esc(item.id)+'">حذف</button></div></td></tr>').join(''):'<tr><td colspan="4">لا توجد إجراءات بعد. أضف أول إجراء من النموذج أعلاه.</td></tr>';
      body.querySelectorAll('[data-procedure-edit]').forEach(btn=>btn.addEventListener('click',()=>{const item=items.find(x=>x.id===btn.dataset.procedureEdit);if(!item)return;const f=els.procedureForm;f.elements.id.value=item.id;f.elements.title.value=item.title||'';f.elements.category.value=item.category||'';f.elements.summary.value=item.summary||'';f.elements.requirements.value=item.requirements||'';f.elements.documents.value=item.documents||'';f.elements.steps.value=item.steps||'';f.elements.legalBasis.value=item.legalBasis||'';f.elements.fees.value=item.fees||'';f.elements.duration.value=item.duration||'';f.elements.published.checked=item.published===true;f.scrollIntoView({behavior:'smooth',block:'start'});}));
      body.querySelectorAll('[data-procedure-toggle]').forEach(btn=>btn.addEventListener('click',async()=>{const item=items.find(x=>x.id===btn.dataset.procedureToggle);if(!item)return;try{await window.publicAuth.firestore.collection('legalProcedures').doc(item.id).update({published:item.published!==true,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});const synced=await loadLegalProcedures();setStatus(synced?'تم تحديث حالة الإجراء والفهرس العام في Firebase.':'تم تحديث حالة الإجراء، لكن تعذر تحديث الفهرس العام. تحقق من قواعد Firestore المنشورة.',!synced);}catch(e){console.error(e);setStatus('تعذر تحديث حالة الإجراء.',true);}}));
      body.querySelectorAll('[data-procedure-delete]').forEach(btn=>btn.addEventListener('click',async()=>{const item=items.find(x=>x.id===btn.dataset.procedureDelete);if(!item||!confirm('حذف هذا الإجراء نهائياً؟'))return;try{await window.publicAuth.firestore.collection('legalProcedures').doc(item.id).delete();resetLegalProcedure();const synced=await loadLegalProcedures();setStatus(synced?'تم حذف الإجراء وتحديث الفهرس العام.':'تم حذف الإجراء، لكن تعذر تحديث الفهرس العام. تحقق من قواعد Firestore المنشورة.',!synced);}catch(e){console.error(e);setStatus('تعذر حذف الإجراء.',true);}}));
      return indexSynced;
    }catch(e){console.error('Legal procedures load failed:',e);body.innerHTML='<tr><td colspan="4">تعذر تحميل الإجراءات. تحقق من قواعد Firestore المنشورة.</td></tr>';return false;}
  }


  async function saveLegalProcedure(event){
    event.preventDefault();
    if(!isAdmin||!window.publicAuth?.firestore)return;
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
      published:Boolean(f.elements.published.checked),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };
    if(data.title.length<3){
      setStatus('عنوان الإجراء مطلوب ويجب ألا يقل عن 3 محارف.',true);
      return;
    }
    try{
      const db=window.publicAuth.firestore;
      if(id)await db.collection('legalProcedures').doc(id).update(data);
      else{
        data.createdAt=firebase.firestore.FieldValue.serverTimestamp();
        data.createdBy=window.publicAuth.user.uid;
        await db.collection('legalProcedures').add(data);
      }
      resetLegalProcedure();
      const indexSynced=await loadLegalProcedures();
      setStatus(
        indexSynced
          ? 'تم حفظ الإجراء وتحديث الفهرس العام في Firebase.'
          : 'تم حفظ الإجراء، لكن تعذر تحديث الفهرس العام. تحقق من قواعد Firestore المنشورة.',
        !indexSynced
      );
    }catch(e){
      console.error('Legal procedure save failed:',e);
      setStatus('تعذر حفظ الإجراء. تحقق من قواعد Firestore المنشورة.',true);
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
        return '<tr><td><strong>'+esc(request.displayName||'مستخدم ميزان')+'</strong><div class="lawyer-admin-status">'+esc(request.email||'')+'</div></td><td>'+esc(request.reason||'—')+'</td><td>'+esc(dateValue(request.createdAt))+'</td><td><span class="lawyer-admin-status '+(enabled?'is-live':request.status==='pending'?'is-off':'')+'">'+status+'</span></td><td><div class="lawyer-admin-actions">'+actions+'</div></td></tr>';
      }).join(''):'<tr><td colspan="5">لا توجد طلبات وصول حتى الآن.</td></tr>';
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
      body.innerHTML='<tr><td colspan="5">تعذر تحميل الطلبات. تحقق من قواعد Firestore المنشورة.</td></tr>';
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
  function install(){buildUI();publishAdminState();if(!window.publicAuth)return;window.publicAuth.whenReady().then(syncAdminState).catch(syncAdminState);window.addEventListener('public-auth-state-changed',syncAdminState);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
