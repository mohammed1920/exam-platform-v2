/* إدارة منبر ميزان — مرتبطة بصلاحيات الإدارة الحالية. */
(function(){
  'use strict';
  const COLLECTION='mizanArticles'; const CONTRIBUTORS='mizanContributors';
  let ready=false;
  const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  function dateValue(v){if(!v)return'—';const d=v&&typeof v.toDate==='function'?v.toDate():new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('ar-IQ',{year:'numeric',month:'short',day:'numeric'});}
  function build(){
    if(ready)return; ready=true;
    const section=document.getElementById('firebase-admin-section'); const menu=document.getElementById('fa-admin-home');
    if(!section||!menu)return;
    const card=document.createElement('button'); card.type='button'; card.className='firebase-admin-menu-card mizan-admin-menu-card'; card.innerHTML='<i class="fas fa-feather-pointed"></i><strong>منبر ميزان</strong><span>مراجعة المقالات والأبحاث والمساهمات</span>'; card.dataset.mizanAdmin='1'; menu.querySelector('.firebase-admin-menu')?.appendChild(card);
    const view=document.createElement('section'); view.id='mizan-admin-view'; view.className='firebase-admin-subview'; view.hidden=true;
    view.innerHTML='<button type="button" class="firebase-admin-subview-back" data-mizan-admin-back>← العودة لأقسام الإدارة</button><div class="firebase-admin-card"><div class="firebase-admin-card-head"><h3>منبر ميزان</h3><div class="mizan-admin-head-actions"><span>المراجعة والنشر</span><button type="button" class="btn btn-sm btn-green" data-mizan-direct-publish><i class="fas fa-pen-to-square"></i> نشر مقال مباشر</button></div></div><div class="mizan-admin-tabs"><button class="active" data-mizan-status="pending">مراجعة المشاركات</button><button data-mizan-status="published">منشور</button><button data-mizan-status="rejected">مرفوض</button><button data-mizan-status="contributors">طلبات الاعتماد</button></div><div class="firebase-admin-table-wrap"><table class="lawyer-admin-table"><thead id="mizan-admin-head"><tr><th>المشاركة</th><th>الكاتب</th><th>النوع</th><th>التاريخ</th><th>الإجراء</th></tr></thead><tbody id="mizan-admin-body"><tr><td colspan="5">جارٍ التحميل...</td></tr></tbody></table></div></div><div id="mizan-direct-publish-modal" class="mizan-admin-direct-modal" hidden><div class="mizan-admin-direct-box"><div class="mizan-admin-direct-head"><h3>نشر مقال مباشر</h3><button type="button" data-mizan-direct-close aria-label="إغلاق">×</button></div><p>هذا النشر يتم مباشرة من الإدارة ويظهر للزوار بحالة منشور.</p><form id="mizan-direct-publish-form"><div class="mizan-direct-grid"><label>عنوان المقال<input name="title" required maxlength="180"></label><label>نوع المشاركة<select name="type"><option>مقال قانوني</option><option>بحث ودراسة</option><option>فكرة ورأي قانوني</option><option>تجربة مهنية</option><option>قراءة وتعليق</option><option>أخرى</option></select></label><label>اسم الكاتب<input name="authorName" required maxlength="120"></label><label>الصفة المهنية<input name="authorTitle" maxlength="120" placeholder="أستاذ قانون / محامٍ / باحث..."></label><label>التخصص<input name="authorSpecialization" maxlength="120"></label><label>المقتطف المختصر<input name="excerpt" maxlength="300"></label><label class="full">محتوى المقال<textarea name="content" required rows="12"></textarea></label></div><div class="mizan-direct-actions"><button type="button" class="btn" data-mizan-direct-close>إلغاء</button><button type="submit" class="btn btn-green">نشر الآن</button></div></form></div></div>';
    section.querySelector('.firebase-admin-subviews')?.appendChild(view);
    card.onclick=()=>open();
    view.querySelector('[data-mizan-admin-back]').onclick=close;
    view.querySelectorAll('[data-mizan-status]').forEach(b=>b.onclick=()=>{view.querySelectorAll('[data-mizan-status]').forEach(x=>x.classList.remove('active'));b.classList.add('active');load(b.dataset.mizanStatus);});
    view.querySelector('[data-mizan-direct-publish]').onclick=openDirectPublish;
    view.querySelectorAll('[data-mizan-direct-close]').forEach(b=>b.onclick=closeDirectPublish);
    view.querySelector('#mizan-direct-publish-form').onsubmit=directPublish;
    section.addEventListener('click',e=>{const a=e.target.closest('[data-mizan-action]');if(a)act(a.dataset.mizanAction,a.dataset.id);});
  }
  function open(){build();const section=document.getElementById('firebase-admin-section');if(!section)return;section.querySelectorAll('.firebase-admin-subview').forEach(v=>v.hidden=true);document.getElementById('fa-admin-home').hidden=true;document.getElementById('mizan-admin-view').hidden=false;load('pending');}
  function close(){const section=document.getElementById('firebase-admin-section');if(!section)return;closeDirectPublish();document.getElementById('mizan-admin-view').hidden=true;document.querySelectorAll('.firebase-admin-subview').forEach(v=>{if(v.id!=='mizan-admin-view')v.hidden=true});document.getElementById('fa-admin-home').hidden=false;}
  function openDirectPublish(){const m=document.getElementById('mizan-direct-publish-modal');if(!m)return;m.hidden=false;document.body.classList.add('mizan-admin-modal-open');m.querySelector('input')?.focus();}
  function closeDirectPublish(){const m=document.getElementById('mizan-direct-publish-modal');if(m)m.hidden=true;document.body.classList.remove('mizan-admin-modal-open');}
  async function directPublish(e){
    e.preventDefault();
    const db=window.publicAuth?.firestore,form=e.currentTarget;
    if(!db)return;
    const user=window.publicAuth?.currentUser||firebase.auth?.().currentUser;
    const fd=new FormData(form);
    const title=String(fd.get('title')||'').trim(), content=String(fd.get('content')||'').trim();
    if(!title||!content){alert('أدخل عنوان المقال ومحتواه.');return;}
    const data={
      title,
      type:String(fd.get('type')||'مقال قانوني').trim(),
      authorName:String(fd.get('authorName')||'').trim(),
      authorTitle:String(fd.get('authorTitle')||'').trim(),
      authorSpecialization:String(fd.get('authorSpecialization')||'').trim(),
      excerpt:String(fd.get('excerpt')||'').trim(),
      content,
      authorUid:user?.uid||null,
      authorEmail:user?.email||null,
      status:'published',
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      publishedAt:firebase.firestore.FieldValue.serverTimestamp(),
      publishedDirectlyByAdmin:true
    };
    try{
      const submit=form.querySelector('button[type="submit"]'); if(submit){submit.disabled=true;submit.textContent='جارٍ النشر...';}
      await db.collection(COLLECTION).add(data);
      form.reset();
      closeDirectPublish();
      alert('تم نشر المقال مباشرة بنجاح.');
      load('published');
      document.querySelectorAll('#mizan-admin-view [data-mizan-status]').forEach(x=>x.classList.toggle('active',x.dataset.mizanStatus==='published'));
    }catch(e){console.error(e);alert('تعذر نشر المقال مباشرة. تحقق من صلاحيات Firestore.');}
    finally{const submit=form.querySelector('button[type="submit"]');if(submit){submit.disabled=false;submit.textContent='نشر الآن';}}
  }
  async function load(status){
    const body=document.getElementById('mizan-admin-body'),head=document.getElementById('mizan-admin-head'),db=window.publicAuth?.firestore;
    if(!body||!db)return;
    body.innerHTML='<tr><td colspan="5">جارٍ التحميل...</td></tr>';
    if(status==='contributors'){
      if(head)head.innerHTML='<tr><th>المساهم</th><th>الصفة</th><th>التخصص</th><th>التاريخ</th><th>الإجراء</th></tr>';
      try{
        const snap=await db.collection(CONTRIBUTORS).where('status','==','pending').limit(100).get();
        const docs=snap.docs.sort((a,b)=>(b.data()?.createdAt?.toDate?.()?.getTime?.()||0)-(a.data()?.createdAt?.toDate?.()?.getTime?.()||0));
        if(!docs.length){body.innerHTML='<tr><td colspan="5">لا توجد طلبات اعتماد.</td></tr>';return;}
        body.innerHTML=docs.map(d=>{const a=d.data()||{};return '<tr><td><strong>'+esc(a.fullName)+'</strong><br><small>'+esc(a.affiliation||'')+'</small></td><td>'+esc(a.role)+'</td><td>'+esc(a.specialization)+'</td><td>'+esc(dateValue(a.createdAt))+'</td><td><div class="btn-row"><button class="btn btn-sm btn-green" data-mizan-action="approve-contributor" data-id="'+d.id+'">اعتماد</button><button class="btn btn-sm btn-red" data-mizan-action="reject-contributor" data-id="'+d.id+'">رفض</button></div></td></tr>';}).join('');
      }catch(e){console.error(e);body.innerHTML='<tr><td colspan="5">تعذر تحميل طلبات الاعتماد.</td></tr>';}
      return;
    }
    if(head)head.innerHTML='<tr><th>المشاركة</th><th>الكاتب</th><th>النوع</th><th>التاريخ</th><th>الإجراء</th></tr>';
    try{
      const snap=await db.collection(COLLECTION).where('status','==',status).limit(100).get();
      const docs=snap.docs.sort((a,b)=>{const av=a.data()?.createdAt?.toDate?.()?.getTime?.()||0;const bv=b.data()?.createdAt?.toDate?.()?.getTime?.()||0;return bv-av;});
      if(!docs.length){body.innerHTML='<tr><td colspan="5">لا توجد مشاركات في هذه القائمة.</td></tr>';return;}
      body.innerHTML=docs.map(d=>{const a=d.data()||{};const buttons=status==='pending'?'<button class="btn btn-sm btn-green" data-mizan-action="publish" data-id="'+d.id+'">نشر</button><button class="btn btn-sm btn-red" data-mizan-action="reject" data-id="'+d.id+'">رفض</button>':'<button class="btn btn-sm btn-red" data-mizan-action="delete" data-id="'+d.id+'">حذف</button>';return '<tr><td><strong>'+esc(a.title)+'</strong><br><small>'+esc(a.excerpt||'').slice(0,90)+'</small></td><td>'+esc(a.authorName)+'</td><td>'+esc(a.type)+'</td><td>'+esc(dateValue(a.createdAt))+'</td><td><div class="btn-row">'+buttons+'</div></td></tr>';}).join('');
    }catch(e){console.error(e);body.innerHTML='<tr><td colspan="5">تعذر تحميل المشاركات. قد تحتاج قواعد Firestore إلى السماح لمجموعة المنبر.</td></tr>';}
  }
  async function act(action,id){
    const db=window.publicAuth?.firestore;if(!db||!id)return;
    try{
      if(action==='approve-contributor')await db.collection(CONTRIBUTORS).doc(id).update({status:'approved',approvedAt:firebase.firestore.FieldValue.serverTimestamp()});
      else if(action==='reject-contributor')await db.collection(CONTRIBUTORS).doc(id).update({status:'rejected',rejectedAt:firebase.firestore.FieldValue.serverTimestamp()});
      else {
        const ref=db.collection(COLLECTION).doc(id);
        if(action==='publish')await ref.update({status:'published',publishedAt:firebase.firestore.FieldValue.serverTimestamp()});
        else if(action==='reject')await ref.update({status:'rejected',rejectedAt:firebase.firestore.FieldValue.serverTimestamp()});
        else if(action==='delete'&&confirm('حذف هذه المشاركة نهائياً؟'))await ref.delete();
      }
      load(document.querySelector('#mizan-admin-view [data-mizan-status].active')?.dataset.mizanStatus||'pending');
    }catch(e){console.error(e);alert('تعذر تنفيذ الإجراء. تحقق من صلاحيات Firestore.');}
  }
  window.addEventListener('firebase-admin-state-changed',e=>{if(e.detail?.isAdmin)setTimeout(build,0);});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(build,400));
})();