/* إدارة منبر ميزان — لوحة إدارة متكاملة للمساهمين والمقالات. */
(function(){
  'use strict';

  const COLLECTION='mizanArticles';
  const CONTRIBUTORS='mizanContributors';
  let ready=false;

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
      item.innerHTML='<i class="fas fa-feather-pointed" aria-hidden="true"></i><span>منبر ميزان</span>';
      item.addEventListener('click',open);
      navigation.appendChild(item);
    }
    section.querySelectorAll('[data-mizan-open]').forEach(button=>button.addEventListener('click',open));

    if(document.getElementById('mizan-admin-view'))return;

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

  async function load(status){
    const body=document.getElementById('mizan-admin-body'),firestore=db();
    if(!body||!firestore)return;
    body.innerHTML='<p class="firebase-admin-list-state">جارٍ التحميل...</p>';

    if(status==='overview'){await loadOverview();return;}
    if(status==='contributors'){await loadContributors('pending');return;}
    if(status==='approved-contributors'){await loadContributors('approved');return;}

    
    try{
      const snap=await firestore.collection(COLLECTION).where('status','==',status).limit(150).get();
      const docs=snap.docs.sort((a,b)=>{
        const av=a.data()?.createdAt?.toDate?.()?.getTime?.()||0;
        const bv=b.data()?.createdAt?.toDate?.()?.getTime?.()||0;
        return bv-av;
      });
      if(!docs.length){body.innerHTML='<p class="firebase-admin-list-state">لا توجد مشاركات في هذه القائمة.</p>';return;}
      body.innerHTML=docs.map(d=>{
        const a=d.data()||{};
        const actionButtons=
          status==='pending'
            ? '<button class="btn btn-sm btn-green" data-mizan-action="publish" data-id="'+d.id+'">نشر</button><button class="btn btn-sm btn-red" data-mizan-action="reject" data-id="'+d.id+'">رفض</button>'
          : status==='published'
            ? '<button class="btn btn-sm" data-mizan-action="hide" data-id="'+d.id+'">إخفاء</button><button class="btn btn-sm" data-mizan-action="edit" data-id="'+d.id+'">تعديل</button><button class="btn btn-sm btn-red" data-mizan-action="delete" data-id="'+d.id+'">حذف</button>'
          : status==='rejected'
            ? '<button class="btn btn-sm" data-mizan-action="resubmit" data-id="'+d.id+'">إعادة للمراجعة</button><button class="btn btn-sm" data-mizan-action="edit" data-id="'+d.id+'">تعديل</button><button class="btn btn-sm btn-red" data-mizan-action="delete" data-id="'+d.id+'">حذف</button>'
          : '<button class="btn btn-sm btn-green" data-mizan-action="republish" data-id="'+d.id+'">إعادة النشر</button><button class="btn btn-sm" data-mizan-action="edit" data-id="'+d.id+'">تعديل</button><button class="btn btn-sm btn-red" data-mizan-action="delete" data-id="'+d.id+'">حذف</button>';
        return '<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">'+esc(a.type||'مشاركة')+'</span><h4>'+esc(a.title||'بدون عنوان')+'</h4></div><span class="lawyer-admin-status '+(status==='published'?'is-live':'is-off')+'">'+statusLabel(status)+'</span></div><div class="firebase-admin-record-field"><span>الكاتب</span><strong>'+esc(a.authorName||'غير محدد')+'</strong></div><div class="firebase-admin-record-field"><span>المقتطف</span><p>'+esc((a.excerpt||'لا يوجد مقتطف').slice(0,180))+'</p></div>'+(a.rejectionReason?'<div class="mizan-admin-reason">سبب الرفض: '+esc(a.rejectionReason)+'</div>':'')+'<div class="firebase-admin-record-meta">تاريخ الإرسال: '+esc(dateValue(a.createdAt))+'</div><div class="lawyer-admin-actions"><button type="button" data-mizan-action="view" data-id="'+d.id+'">عرض التفاصيل</button>'+actionButtons+'</div></article>';
      }).join('');
    }catch(e){
      console.error(e);
      body.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل المشاركات. تحقق من صلاحيات Firestore.</p>';
    }
  }

  function statusLabel(s){return({pending:'قيد المراجعة',published:'منشور',rejected:'مرفوض',hidden:'مخفي'})[s]||s;}

  async function loadOverview(){
    const body=document.getElementById('mizan-admin-body'),head=document.getElementById('mizan-admin-head'),firestore=db();
    if(!body||!firestore)return;
    body.innerHTML='<p class="firebase-admin-list-state">جارٍ تحديث الإحصائيات...</p>';
    try{
      const statuses=['pending','published','rejected','hidden'];
      const snaps=await Promise.all(statuses.map(s=>firestore.collection(COLLECTION).where('status','==',s).get()));
      const [contributorSnap,approvedContributorSnap]=await Promise.all([
        firestore.collection(CONTRIBUTORS).where('status','==','pending').get(),
        firestore.collection(CONTRIBUTORS).where('status','==','approved').get()
      ]);
      const counts={};
      statuses.forEach((s,i)=>counts[s]=snaps[i].size);
      updateTabCounts({
        contributors:contributorSnap.size,
        'approved-contributors':approvedContributorSnap.size,
        pending:counts.pending,
        published:counts.published,
        rejected:counts.rejected,
        hidden:counts.hidden
      });
      const stats=document.getElementById('mizan-admin-stats');
      if(stats)stats.innerHTML='<div class="mizan-admin-stat"><strong>'+Object.values(counts).reduce((a,b)=>a+b,0)+'</strong><span>إجمالي المشاركات</span></div><div class="mizan-admin-stat"><strong>'+counts.pending+'</strong><span>قيد المراجعة</span></div><div class="mizan-admin-stat"><strong>'+counts.published+'</strong><span>منشور</span></div><div class="mizan-admin-stat"><strong>'+counts.rejected+'</strong><span>مرفوض</span></div><div class="mizan-admin-stat"><strong>'+contributorSnap.size+'</strong><span>طلبات اعتماد</span></div>';
      body.innerHTML='<p class="firebase-admin-list-state">اختر من تبويبات منبر ميزان أعلاه لإدارة المشاركات وطلبات الاعتماد.</p>';
    }catch(e){console.error(e);body.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل إحصائيات المنبر.</p>';}
  }

  async function loadContributors(filterStatus='pending'){
    const body=document.getElementById('mizan-admin-body'),head=document.getElementById('mizan-admin-head'),firestore=db();
    if(!body||!firestore)return;
    body.innerHTML='<p class="firebase-admin-list-state">جارٍ تحميل المساهمين...</p>';
    try{
      const snap=filterStatus==='pending'
        ? await firestore.collection(CONTRIBUTORS).where('status','==','pending').limit(150).get()
        : await firestore.collection(CONTRIBUTORS).where('status','in',['approved','blocked']).limit(150).get();
      const docs=snap.docs.sort((a,b)=>(b.data()?.createdAt?.toDate?.()?.getTime?.()||0)-(a.data()?.createdAt?.toDate?.()?.getTime?.()||0));
      if(!docs.length){body.innerHTML='<p class="firebase-admin-list-state">'+(filterStatus==='pending'?'لا توجد طلبات اعتماد معلقة.':'لا يوجد مساهمون معتمدون أو محظورون.')+'</p>';return;}
      body.innerHTML=docs.map(d=>{
        const a=d.data()||{};
        const statusLabel=a.status==='approved'?'معتمد':a.status==='blocked'?'محظور':'قيد المراجعة';
        const buttons=a.status==='pending'
          ? '<button class="btn btn-sm btn-green" data-mizan-action="approve-contributor" data-id="'+d.id+'">اعتماد</button><button class="btn btn-sm btn-red" data-mizan-action="reject-contributor" data-id="'+d.id+'">رفض</button>'
          : a.status==='approved'
            ? '<button class="btn btn-sm" data-mizan-action="block-contributor" data-id="'+d.id+'">حظر النشر</button><button class="btn btn-sm btn-red" data-mizan-action="delete-contributor" data-id="'+d.id+'">حذف</button>'
            : '<button class="btn btn-sm btn-green" data-mizan-action="unblock-contributor" data-id="'+d.id+'">إلغاء الحظر</button><button class="btn btn-sm btn-red" data-mizan-action="delete-contributor" data-id="'+d.id+'">حذف</button>';
        return '<article class="firebase-admin-record-card"><div class="firebase-admin-record-heading"><div><span class="firebase-admin-record-eyebrow">مساهم في منبر ميزان</span><h4>'+esc(a.fullName||'بدون اسم')+'</h4><span class="firebase-admin-record-sub">'+esc(a.email||'')+'</span></div><span class="lawyer-admin-status '+(a.status==='approved'?'is-live':'is-off')+'">'+statusLabel+'</span></div><div class="firebase-admin-record-field"><span>الصفة والتخصص</span><p>'+esc(a.role||'—')+' · '+esc(a.specialization||'—')+'</p></div><div class="firebase-admin-record-field"><span>جهة العمل</span><p>'+esc(a.affiliation||'غير محددة')+'</p></div><div class="firebase-admin-record-meta">تاريخ الطلب: '+esc(dateValue(a.createdAt))+'</div><div class="lawyer-admin-actions"><button type="button" data-mizan-action="view-contributor" data-id="'+d.id+'">عرض التفاصيل</button>'+buttons+'</div></article>';
      }).join('');
    }catch(e){console.error(e);body.innerHTML='<p class="firebase-admin-list-state">تعذر تحميل طلبات الاعتماد.</p>';}
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
        closeModal('mizan-contributor-view-modal');alert('تم اعتماد المساهم.');
        setTab('contributors');load('contributors');return;
      }
      if(action==='reject-contributor'){
        await firestore.collection(CONTRIBUTORS).doc(id).update({status:'rejected',rejectedAt:firebase.firestore.FieldValue.serverTimestamp()});
        closeModal('mizan-contributor-view-modal');alert('تم رفض طلب الاعتماد.');
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
            closeModal('mizan-reject-modal');closeModal('mizan-article-view-modal');
            alert('تم رفض المشاركة وحفظ السبب.');
            setTab('rejected');load('rejected');
          }catch(e){console.error(e);alert('تعذر رفض المشاركة.');}
        };
        return;
      }
      if(action==='publish'){
        await ref.update({status:'published',publishedAt:firebase.firestore.FieldValue.serverTimestamp()});
        closeModal('mizan-article-view-modal');alert('تم نشر المشاركة.');
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
        closeModal('mizan-article-view-modal');alert('أعيدت المشاركة إلى قائمة المراجعة.');
        setTab('pending');load('pending');return;
      }
      if(action==='edit'){
        const item=await fetchDoc(COLLECTION,id);if(item)openEdit(id,item.data);
        return;
      }
      if(action==='delete'&&confirm('حذف هذه المشاركة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')){
        await ref.delete();
        closeModal('mizan-article-view-modal');alert('تم حذف المشاركة نهائياً.');
        const active=document.querySelector('#mizan-admin-view [data-mizan-status].active')?.dataset.mizanStatus||'overview';
        load(active);
      }
    }catch(e){console.error(e);alert('تعذر تنفيذ الإجراء. تحقق من صلاحيات Firestore.');}
  }

  window.addEventListener('firebase-admin-state-changed',e=>{if(e.detail?.isAdmin)setTimeout(build,0);});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(build,400));
})();
