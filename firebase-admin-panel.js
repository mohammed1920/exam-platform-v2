/* Firebase admin tab for the student SPA. Visible only to users listed as admins/{uid}. */
(function () {
  'use strict';
  let isAdmin=false,panelOpen=false,mainViewState=[],els={};
  function publishAdminState(){ window.firebaseAdminPanel={open:openPanel,isAdmin}; window.dispatchEvent(new CustomEvent('firebase-admin-state-changed',{detail:{isAdmin}})); }
  const esc=v=>String(v??'—').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  function dateValue(v){if(!v)return'—';const d=v&&typeof v.toDate==='function'?v.toDate():new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('ar-IQ',{year:'numeric',month:'short',day:'numeric'});}
  function timeValue(v){const d=v&&typeof v.toDate==='function'?v.toDate():new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleTimeString('ar-IQ',{hour:'2-digit',minute:'2-digit'});}
  function buildUI(){
    if(document.getElementById('firebase-admin-tab'))return;
    if(!document.querySelector('link[data-lawyer-admin-css]')){const css=document.createElement('link');css.rel='stylesheet';css.href='lawyer-admin.css?v=1.0';css.dataset.lawyerAdminCss='1';document.head.appendChild(css);}
    const header=document.querySelector('header');if(!header)return;
    const tab=document.createElement('button');tab.id='firebase-admin-tab';tab.type='button';tab.className='firebase-admin-tab';tab.innerHTML='<i class="fas fa-crown" aria-hidden="true"></i><span>الإدارة</span>';tab.title='لوحة إدارة Firebase';tab.setAttribute('aria-label','لوحة إدارة Firebase');tab.hidden=true;tab.addEventListener('click',openPanel);header.appendChild(tab);
    const main=document.querySelector('main.container');if(!main)return;const section=document.createElement('section');section.id='firebase-admin-section';section.className='view-section firebase-admin-view';section.hidden=true;
    section.innerHTML=`<div class="firebase-admin-head"><div><div class="firebase-admin-kicker">⚖️ لوحة الإدارة</div><h2>لوحة إدارة المنصة</h2><p id="firebase-admin-welcome">تم التحقق من صلاحية الإدارة.</p></div><button id="firebase-admin-refresh" class="firebase-admin-action" type="button">↻ تحديث البيانات</button></div><div id="firebase-admin-status" class="firebase-admin-status" hidden></div><div id="fa-admin-home" class="firebase-admin-home"><div class="firebase-admin-menu"><button type="button" class="firebase-admin-menu-card" data-admin-view="students"><i class="fas fa-users"></i><strong>الطلاب المسجلون</strong><span>عرض حسابات الطلاب المسجلين</span></button><button type="button" class="firebase-admin-menu-card" data-admin-view="lawyers"><i class="fas fa-user-tie"></i><strong>إدارة دليل المحامين</strong><span>الطلبات والملفات المنشورة</span></button><button type="button" class="firebase-admin-menu-card" data-admin-view="results"><i class="fas fa-chart-column"></i><strong>آخر النتائج</strong><span>متابعة نتائج الاختبارات الأخيرة</span></button></div></div><div class="firebase-admin-subviews"><section id="fa-admin-view-students" class="firebase-admin-subview"><button type="button" class="firebase-admin-subview-back" data-admin-home>← العودة لأقسام الإدارة</button><div class="firebase-admin-stats"><div class="firebase-admin-stat"><span>إجمالي الطلاب</span><strong id="fa-students-count">—</strong></div><div class="firebase-admin-stat"><span>النتائج المسجلة</span><strong id="fa-results-count">—</strong></div><div class="firebase-admin-stat"><span>طلاب لديهم نتائج</span><strong id="fa-active-count">—</strong></div><div class="firebase-admin-stat"><span>متوسط النسبة</span><strong id="fa-average-score">—</strong></div></div><div class="firebase-admin-card"><div class="firebase-admin-card-head"><h3>👥 الطلاب المسجلون</h3><span id="fa-students-updated"></span></div><div class="firebase-admin-table-wrap"><table><thead><tr><th>الاسم</th><th>البريد</th><th>التسجيل</th></tr></thead><tbody id="fa-students-body"><tr><td colspan="3">جارٍ التحميل...</td></tr></tbody></table></div></div></section><section id="fa-admin-view-results" class="firebase-admin-subview"><button type="button" class="firebase-admin-subview-back" data-admin-home>← العودة لأقسام الإدارة</button><div class="firebase-admin-card"><div class="firebase-admin-card-head"><h3>📝 آخر النتائج</h3><span id="fa-results-updated"></span></div><div class="firebase-admin-table-wrap"><table><thead><tr><th>الطالب</th><th>الكتاب</th><th>الفصل</th><th>النتيجة</th></tr></thead><tbody id="fa-results-body"><tr><td colspan="4">جارٍ التحميل...</td></tr></tbody></table></div></div></section><section id="fa-admin-view-lawyers" class="firebase-admin-subview"><button type="button" class="firebase-admin-subview-back" data-admin-home>← العودة لأقسام الإدارة</button><div class="firebase-admin-card lawyer-admin-card">
      <div class="firebase-admin-card-head"><h3>👨‍⚖️ إدارة دليل المحامين</h3><span>الطلبات والملفات المنشورة</span></div>
      <div class="lawyer-admin-tabs">
        <button type="button" class="lawyer-admin-tab active" data-lawyer-view="pending">الطلبات <span id="fa-lawyers-pending-count">0</span></button>
        <button type="button" class="lawyer-admin-tab" data-lawyer-view="published">المحامون المنشورون <span id="fa-lawyers-published-count">0</span></button>
      </div>
      <div id="fa-lawyers-pending-panel">
        <div class="firebase-admin-table-wrap"><table class="lawyer-admin-table"><thead><tr><th>المحامي</th><th>الموقع</th><th>الاختصاص</th><th>التقديم</th><th>الهوية</th><th>الإجراء</th></tr></thead><tbody id="fa-lawyers-body"><tr><td colspan="6">جارٍ التحميل...</td></tr></tbody></table></div>
      </div>
      <div id="fa-lawyers-published-panel" hidden>
        <div class="firebase-admin-table-wrap"><table class="lawyer-admin-table"><thead><tr><th>المحامي</th><th>الموقع</th><th>الاختصاص</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody id="fa-lawyers-published-body"><tr><td colspan="5">جارٍ التحميل...</td></tr></tbody></table></div>
      </div>
      <div id="fa-lawyer-edit" class="lawyer-admin-edit" hidden>
        <div class="firebase-admin-card-head"><h3 id="fa-lawyer-edit-title">تعديل بيانات المحامي</h3><button id="fa-lawyer-edit-close" type="button">×</button></div>
        <form id="fa-lawyer-edit-form">
          <input type="hidden" name="id">
          <div class="lawyer-admin-form-grid">
            <label>الاسم<input name="name" required></label><label>المحافظة<input name="governorate" required></label><label>القضاء/المنطقة<input name="district"></label><label>الهاتف<input name="phone"></label><label>المكتب<input name="office"></label><label>العنوان<input name="address"></label><label>الاختصاصات<input name="specializations"></label><label>ساعات العمل<input name="workingHours"></label><label class="full">الوصف<textarea name="description"></textarea></label>
          </div>
          <div class="lawyer-admin-form-actions"><button type="submit" class="approve">حفظ</button><button id="fa-lawyer-edit-cancel" type="button">إلغاء</button></div>
        </form>
      </div>
      <p class="lawyer-admin-note"><i class="fas fa-shield-halved"></i> هوية النقابة لا تُخزّن داخل المنصة. يرسلها المتقدم مباشرة للأدمن عبر واتساب أو تلغرام، ثم تتم مطابقة الهوية مع الطلب قبل النشر.</p>
    </section></div>
    <button id="firebase-admin-back" class="firebase-admin-back" type="button">← العودة للموقع</button>`
    main.appendChild(section);
    els={tab,section,status:section.querySelector('#firebase-admin-status'),welcome:section.querySelector('#firebase-admin-welcome'),refresh:section.querySelector('#firebase-admin-refresh'),back:section.querySelector('#firebase-admin-back'),studentsCount:section.querySelector('#fa-students-count'),resultsCount:section.querySelector('#fa-results-count'),activeCount:section.querySelector('#fa-active-count'),averageScore:section.querySelector('#fa-average-score'),studentsUpdated:section.querySelector('#fa-students-updated'),resultsUpdated:section.querySelector('#fa-results-updated'),studentsBody:section.querySelector('#fa-students-body'),resultsBody:section.querySelector('#fa-results-body'),lawyersBody:section.querySelector('#fa-lawyers-body'),lawyersPublishedBody:section.querySelector('#fa-lawyers-published-body'),lawyersPendingCount:section.querySelector('#fa-lawyers-pending-count'),lawyersPublishedCount:section.querySelector('#fa-lawyers-published-count'),lawyerEdit:section.querySelector('#fa-lawyer-edit'),lawyerEditForm:section.querySelector('#fa-lawyer-edit-form'),lawyerEditTitle:section.querySelector('#fa-lawyer-edit-title'),lawyerEditClose:section.querySelector('#fa-lawyer-edit-close'),lawyerEditCancel:section.querySelector('#fa-lawyer-edit-cancel')};
    els.refresh?.addEventListener('click',loadDashboard);els.back?.addEventListener('click',closePanel);
    els.section.querySelectorAll('[data-admin-view]').forEach(btn=>btn.addEventListener('click',()=>switchAdminView(btn.dataset.adminView)));
    els.section.querySelectorAll('[data-admin-home]').forEach(btn=>btn.addEventListener('click',showAdminHome));
els.lawyerEditClose?.addEventListener('click',closeLawyerEdit);els.lawyerEditCancel?.addEventListener('click',closeLawyerEdit);els.lawyerEditForm?.addEventListener('submit',saveLawyerEdit);
els.section.querySelectorAll('[data-lawyer-view]').forEach(btn=>btn.addEventListener('click',()=>switchLawyerView(btn.dataset.lawyerView)));
  }
  function setStatus(text,error){if(!els.status)return;els.status.textContent=text||'';els.status.hidden=!text;els.status.classList.toggle('error',Boolean(error));}
  function switchAdminView(view){
    const home=els.section.querySelector('#fa-admin-home');
    if(home)home.hidden=true;
    els.section.querySelectorAll('.firebase-admin-subview').forEach(panel=>panel.classList.toggle('active',panel.id==='fa-admin-view-'+view));
    if(view!=='lawyers'&&els.lawyerEdit)closeLawyerEdit();
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
  function openPanel(){if(!isAdmin||!els.section)return;rememberMainView();hideMainViews();panelOpen=true;els.section.hidden=false;els.section.classList.add('active');els.section.scrollIntoView({behavior:'smooth',block:'start'});loadDashboard();}
  function closePanel(){if(!panelOpen)return;els.section.hidden=true;els.section.classList.remove('active');restoreMainViews();panelOpen=false;}
  async function loadDashboard(){if(!isAdmin||!window.publicAuth?.firestore)return;setStatus('جارٍ تحميل إحصائيات Firebase...');try{const db=window.publicAuth.firestore;const [studentsSnap,resultsSnap]=await Promise.all([db.collection('students').get(),db.collection('examResults').get()]);const students=studentsSnap.docs.map(d=>d.data()),results=resultsSnap.docs.map(d=>d.data());els.studentsCount.textContent=students.length;els.resultsCount.textContent=results.length;els.activeCount.textContent=new Set(results.map(r=>r.uid).filter(Boolean)).size;const avg=results.length?results.reduce((s,r)=>s+(Number(r.percentage)||0),0)/results.length:0;els.averageScore.textContent=results.length?`${avg.toFixed(1)}%`:'—';students.sort((a,b)=>String(a.email||'').localeCompare(String(b.email||'')));els.studentsBody.innerHTML=students.length?students.map(s=>`<tr><td>${esc(s.displayName||'—')}</td><td>${esc(s.email||'—')}</td><td>${dateValue(s.createdAt)}</td></tr>`).join(''):'<tr><td colspan="3">لا يوجد طلاب مسجلون.</td></tr>';results.sort((a,b)=>{const ad=a.completedAt&&typeof a.completedAt.toMillis==='function'?a.completedAt.toMillis():0,bd=b.completedAt&&typeof b.completedAt.toMillis==='function'?b.completedAt.toMillis():0;return bd-ad;});els.resultsBody.innerHTML=results.slice(0,100).map(r=>`<tr><td>${esc(r.email||r.uid||'—')}</td><td>${esc(r.bookTitle||r.bookId||'—')}</td><td>${r.chapter==null?'اختبار مخصص':esc(r.chapter)}</td><td>${Number(r.score)||0}/${Number(r.totalQuestions)||0} (${(Number(r.percentage)||0).toFixed(1)}%)</td></tr>`).join('')||'<tr><td colspan="4">لا توجد نتائج بعد.</td></tr>';const now=timeValue(new Date());els.studentsUpdated.textContent=now;els.resultsUpdated.textContent=now;await loadLawyerManagement();setStatus('');}catch(e){console.error(e);setStatus('تعذر تحميل بيانات الإدارة. تحقق من قواعد Firestore وصلاحية الحساب.',true);}}
  let lawyerApplications=[],lawyerProfiles=[];

  function switchLawyerView(view){
    const pending=view==='pending';
    els.section.querySelectorAll('[data-lawyer-view]').forEach(btn=>btn.classList.toggle('active',(btn.dataset.lawyerView==='pending')===pending));
    const p=els.section.querySelector('#fa-lawyers-pending-panel'),pub=els.section.querySelector('#fa-lawyers-published-panel');
    if(p)p.hidden=!pending;if(pub)pub.hidden=pending;
    if(els.lawyerEdit&&!pending)closeLawyerEdit();
  }

  async function loadLawyerManagement(){
    await Promise.all([loadLawyerApplications(),loadLawyerProfiles()]);
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

  function openLawyerEdit(item,type){
    if(!item||!els.lawyerEditForm)return;
    els.lawyerEdit.dataset.type=type;els.lawyerEdit.hidden=false;
    els.lawyerEditTitle.textContent='تعديل بيانات '+(item.name||'المحامي');
    const f=els.lawyerEditForm;
    f.elements.id.value=item.id||'';
    f.elements.name.value=item.name||'';f.elements.governorate.value=item.governorate||'';f.elements.district.value=item.district||'';f.elements.phone.value=item.phone||'';f.elements.office.value=item.office||'';f.elements.address.value=item.address||'';f.elements.specializations.value=Array.isArray(item.specializations)?item.specializations.join('، '):String(item.specializations||'');f.elements.workingHours.value=item.workingHours||'';f.elements.description.value=item.description||'';
    els.lawyerEdit.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function closeLawyerEdit(){if(els.lawyerEdit)els.lawyerEdit.hidden=true;}

  async function saveLawyerEdit(e){
    e.preventDefault();const f=e.currentTarget,id=f.elements.id.value,type=els.lawyerEdit.dataset.type;if(!id||!type)return;
    const data={name:String(f.elements.name.value||'').trim(),governorate:String(f.elements.governorate.value||'').trim(),district:String(f.elements.district.value||'').trim(),phone:String(f.elements.phone.value||'').trim(),office:String(f.elements.office.value||'').trim(),address:String(f.elements.address.value||'').trim(),specializations:String(f.elements.specializations.value||'').split(/[،,]/).map(v=>v.trim()).filter(Boolean).slice(0,10),workingHours:String(f.elements.workingHours.value||'').trim(),description:String(f.elements.description.value||'').trim(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
    if(!data.name||!data.governorate){setStatus('الاسم والمحافظة مطلوبان.',true);return;}
    try{
      const db=window.publicAuth.firestore;
      await db.collection(type==='profile'?'lawyerProfiles':'lawyerApplications').doc(id).update(data);
      if(type==='profile'){const appId=lawyerProfiles.find(p=>p.id===id)?.applicationId;if(appId)await db.collection('lawyerApplications').doc(appId).update({...data,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});}
      closeLawyerEdit();await loadLawyerManagement();if(window.lawyerDirectory?.load)window.lawyerDirectory.load();setStatus('تم حفظ تعديلات المحامي.',false);
    }catch(e){console.error(e);setStatus('تعذر حفظ تعديلات المحامي. تحقق من الصلاحيات.',true);}
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
      await db.collection('lawyerProfiles').doc(app.id).set({name:app.name,governorate:app.governorate||'',district:app.district||'',phone:app.phone||'',office:app.office||'',address:app.address||'',specializations:Array.isArray(app.specializations)?app.specializations:[],workingHours:app.workingHours||'',description:app.description||'',published:true,applicationId:app.id,approvedAt:firebase.firestore.FieldValue.serverTimestamp()});
      await db.collection('lawyerApplications').doc(app.id).update({status:'approved',approvedBy:window.publicAuth.user.uid,approvedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      await loadLawyerManagement();if(window.lawyerDirectory?.load)window.lawyerDirectory.load();setStatus('تم اعتماد المحامي ونشر بياناته العامة.',false);
    }catch(e){console.error(e);setStatus('تعذر اعتماد الطلب.',true);}
  }
  async function rejectLawyer(app){
    if(!app||!confirm('هل تريد رفض هذا الطلب؟'))return;
    try{await window.publicAuth.firestore.collection('lawyerApplications').doc(app.id).update({status:'rejected',rejectedBy:window.publicAuth.user.uid,rejectedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});await loadLawyerApplications();setStatus('تم رفض الطلب ولم تُنشر بياناته.',false);}
    catch(e){console.error(e);setStatus('تعذر رفض الطلب.',true);}
  }
  async function syncAdminState(){buildUI();if(!window.publicAuth||!window.publicAuth.user){isAdmin=false;if(panelOpen)closePanel();showTab(false);return;}const user=window.publicAuth.user;const allowed=await checkAdmin(user);isAdmin=allowed;showTab(allowed);publishAdminState();if(!allowed&&panelOpen)closePanel();if(allowed&&els.welcome)els.welcome.textContent=`مرحباً ${user.displayName||user.email||'المدير'} — تم التحقق من صلاحية الإدارة.`;}
  function install(){buildUI();publishAdminState();if(!window.publicAuth)return;window.publicAuth.whenReady().then(syncAdminState).catch(syncAdminState);window.addEventListener('public-auth-state-changed',syncAdminState);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
