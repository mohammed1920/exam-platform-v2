/* Mizan — Smart Legal Petitions */
(function(){
  'use strict';
  const state={templates:[],template:null,branded:false,templatesLoaded:false,categories:[],categoriesLoaded:false,categoryTemplates:{},petitionIndex:[],petitionIndexLoaded:false,petitionIndexPromise:null,categoryId:null,mode:'read',editedBody:'',savedBody:'',editedLetterhead:'',savedLetterhead:'',editorSavedHtml:''};
  window.petitions = window.petitions || {};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const dataCache=new Map();
  function dataUrl(path){const base=location.pathname.includes('/exam-platform-v2')?'/exam-platform-v2':'';return base+'/'+path;}
  async function fetchJson(path){if(dataCache.has(path))return dataCache.get(path);const pending=fetch(dataUrl(path),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('تعذر تحميل '+path);return r.json();});dataCache.set(path,pending);try{return await pending;}catch(e){dataCache.delete(path);throw e;}}
  async function loadCategories(){if(state.categoriesLoaded)return state.categories;state.categories=await fetchJson('data/petitions/categories.json');state.categoriesLoaded=true;return state.categories;}
  async function loadPetitionIndex(){
    if(state.petitionIndexLoaded)return state.petitionIndex;
    if(state.petitionIndexPromise)return state.petitionIndexPromise;
    const db=window.publicAuth?.firestore;if(!db)throw Error('خدمة العرائض غير متاحة.');
    state.petitionIndexPromise=db.collection('publicIndexes').doc('petitions').get().then(snap=>{
      state.petitionIndex=snap.exists&&Array.isArray(snap.data()?.items)?snap.data().items:[];
      state.petitionIndexLoaded=true;
      return state.petitionIndex;
    }).catch(error=>{state.petitionIndexPromise=null;throw error;});
    return state.petitionIndexPromise;
  }
  async function loadTemplates(categoryId){
    if(!categoryId){state.templates=[];state.templatesLoaded=true;return state.templates;}
    if(state.categoryTemplates?.[categoryId])return state.categoryTemplates[categoryId];
    const all=await loadPetitionIndex();
    const items=all.filter(x=>x.categoryId===categoryId);state.categoryTemplates=state.categoryTemplates||{};state.categoryTemplates[categoryId]=items;state.templates=items;state.templatesLoaded=true;return items;
  }
  async function loadDocument(uid){
    const cached=dataCache.get('document:'+uid);if(cached)return cached;
    const db=window.publicAuth?.firestore;if(!db)throw Error('خدمة العرائض غير متاحة.');
    const snap=await db.collection('petitionDocuments').doc(uid).get();if(!snap.exists)throw Error('العريضة غير موجودة في قاعدة البيانات.');
    const doc={uid:snap.id,...snap.data()};if(doc.published!==true)throw Error('هذه العريضة غير منشورة.');dataCache.set('document:'+uid,doc);return doc;
  }
  let petitionAccessCache={uid:null,expiresAt:0,value:null};
  const PETITION_ACCESS_CACHE_MS=15000;
  async function loadPetitionAccess(force=false){
    const auth=window.publicAuth,user=auth?.user,db=auth?.firestore;
    if(!user||!db)return {status:'signed-out',enabled:false};
    if(!force&&petitionAccessCache.uid===user.uid&&petitionAccessCache.expiresAt>Date.now()&&petitionAccessCache.value)return petitionAccessCache.value;
    // These three independent documents are checked together to avoid serial network round trips.
    const [admin,grant,request]=await Promise.all([
      db.collection('admins').doc(user.uid).get(),
      db.collection('petitionAccess').doc(user.uid).get(),
      db.collection('petitionAccessRequests').doc(user.uid).get()
    ]);
    const adminData=admin.exists?admin.data():null;
    let value;
    if(adminData?.role==='admin'&&adminData.enabled!==false)value={status:'approved',enabled:true,admin:true};
    else if(grant.exists&&grant.data()?.enabled===true)value={status:'approved',enabled:true};
    else value={status:request.exists?String(request.data()?.status||'none'):'none',enabled:false};
    petitionAccessCache={uid:user.uid,expiresAt:Date.now()+PETITION_ACCESS_CACHE_MS,value};
    return value;
  }
  function renderAccessGate(access){
    const root=document.getElementById('petition-browse');if(!root)return;
    const contactNote='<div class="petition-access-note"><i class="fas fa-circle-info" aria-hidden="true"></i><p>عند تقديم طلبك، تواصل مع الإدارة من قسم <button type="button" class="petition-contact-link">تواصل معنا</button> لتأكيد حسابك.</p></div>';
    if(access.status==='pending'){
      root.innerHTML='<section class="petition-access-card petition-access-pending"><div class="petition-access-icon"><i class="fas fa-hourglass-half" aria-hidden="true"></i></div><span class="petition-access-eyebrow">طلب الوصول</span><h3>طلبك قيد المراجعة</h3><p class="petition-access-description">استلمنا طلبك بنجاح. سيظهر محتوى العرائض بعد موافقة الإدارة.</p>'+contactNote+'</section>';
      root.querySelector('.petition-contact-link')?.addEventListener('click',()=>window.app?.navigateTo('contact'));
      return;
    }
    const canRequest=['none','rejected','revoked'].includes(access.status);
    root.innerHTML='<section class="petition-access-card"><div class="petition-access-icon"><i class="fas fa-lock" aria-hidden="true"></i></div><span class="petition-access-eyebrow">العرائض والطلبات</span><h3>الوصول إلى العرائض يتطلب موافقة الإدارة</h3><p class="petition-access-description">قدّم طلباً يوضح سبب حاجتك إلى النماذج القانونية. تبقى الموافقة سارية حتى تسحبها الإدارة.</p>'+(canRequest?'<form id="petition-access-request" class="petition-access-request"><label for="petition-access-reason">سبب طلب الوصول</label><textarea id="petition-access-reason" rows="4" minlength="10" maxlength="1000" required placeholder="اكتب سبب طلبك (10 محارف على الأقل)"></textarea><button type="submit" class="petition-primary"><i class="fas fa-paper-plane" aria-hidden="true"></i> إرسال طلب الوصول</button></form>':'')+contactNote+'</section>';
    root.querySelector('.petition-contact-link')?.addEventListener('click',()=>window.app?.navigateTo('contact'));
    const form=document.getElementById('petition-access-request');
    if(form)form.onsubmit=async event=>{event.preventDefault();const reason=String(form.querySelector('textarea').value||'').trim(),auth=window.publicAuth,user=auth?.user,db=auth?.firestore;if(reason.length<10||!user||!db)return;const button=form.querySelector('button');button.disabled=true;try{const ref=db.collection('petitionAccessRequests').doc(user.uid),existing=access.status!=='none',payload={uid:user.uid,displayName:auth.displayName(user),email:user.email||'',reason,status:'pending',updatedAt:firebase.firestore.FieldValue.serverTimestamp()};if(existing)await ref.update(payload);else await ref.set({...payload,createdAt:firebase.firestore.FieldValue.serverTimestamp()});petitionAccessCache={uid:user.uid,expiresAt:Date.now()+PETITION_ACCESS_CACHE_MS,value:{status:'pending',enabled:false}};petitionAccessCache={uid:user.uid,expiresAt:Date.now()+PETITION_ACCESS_CACHE_MS,value:{status:'pending',enabled:false}};renderAccessGate({status:'pending',enabled:false});}catch(e){console.error('Petition access request failed:',e);button.disabled=false;alert('تعذر إرسال الطلب. حاول مرة أخرى بعد التحقق من اتصالك.');}};
  }
  function navigateBack(target){
    // All petition screens share one app view, so browser history alone cannot
    // distinguish their visible sub-screens. Restore the requested parent UI directly.
    if(target==='home'){
      window.app.navigateTo('home');
      return;
    }
    if(target==='categories'){
      state.template=null;
      state.categoryId=null;
      renderHome();
      renderCategories();
      return;
    }
    if(target==='legal-tables'){
      window.app?.navigateTo?.('petitions',{parentView:'petitions',petitionLevel:'legal-tables'});
      state.template=null;
      state.categoryId=null;
      renderHome();
      renderLegalTables();
      return;
    }
    if(target==='category'){
      // Prefer the selected category's cached manifest, and never depend on
      // the document-loading promise to finish before restoring the list UI.
      state.template=null;
      state.mode='read';
      if(state.categoryId){
        const category=state.categories.find(c=>c.id===state.categoryId);
        const items=state.categoryTemplates[state.categoryId];
        if(category&&items){
          renderHome();
          renderCards('',category,items);
        }else{
          renderHome();
          openCategory(state.categoryId,false);
        }
      }else{
        state.categoryId=null;
        renderHome();
        renderCategories();
      }
    }
  }
  async function open(pushHistory=true){
    if(pushHistory)window.app.navigateTo('petitions',{parentView:'home'});
    state.template=null;state.categoryId=null;renderHome();
    const auth=window.publicAuth;if(!auth?.user){auth?.requireAuth?.(()=>open(false));return;}
    try{
      await auth.whenFirestoreReady?.();
      // Category metadata is a small static JSON file; load it while the access check runs.
      const [access]=await Promise.all([loadPetitionAccess(),loadCategories()]);
      if(!access.enabled){renderAccessGate(access);return;}
      await loadPetitionIndex();
      renderCategories();
    }catch(e){console.error('Petitions access check failed:',e);renderLoadError('تعذر التحقق من صلاحية الوصول أو تحميل الأقسام. حاول مرة أخرى.');}
  }
  function renderHome(){
    const root=document.getElementById('petitions-section');if(!root)return;
    root.innerHTML='<div class="petitions-shell"><div class="petitions-hero mizan-section-hero"><div class="mizan-section-hero-heading"><span class="mizan-section-hero-icon" aria-hidden="true"><i class="fas fa-file-signature"></i></span><h2>العرائض والطلبات</h2></div><p>اختر العريضة، اقرأها، ثم عدّل نصها بحرية واحفظها أو اطبعها.</p></div><div id="petition-browse"></div></div>';

  }
  function renderLoadError(message){const root=document.getElementById('petition-browse');if(root)root.innerHTML='<div class="petition-empty">'+esc(message)+' <button type="button" id="petition-retry">إعادة المحاولة</button></div>';const b=document.getElementById('petition-retry');if(b)b.onclick=()=>open();}
  function openLegalTables(pushHistory=true){
    state.template=null;state.categoryId=null;
    if(pushHistory)window.app.navigateTo('petitions',{parentView:'petitions',petitionLevel:'legal-tables'});
    renderHome();renderLegalTables();
  }
  const LEGAL_TABLES_STORAGE_KEY='mizan.legalTables.v1';
  let activeLegalTable=null;
  const legalTableTemplates={
    'marital-furniture':{title:'قائمة أثاث الزوجية',columns:['ت','وصف الأثاث والموجودات','العدد','القيمة (د.ع)','مصدر التملك','ملاحظات'],rows:6},
    'materials-prices':{title:'جدول المواد والأسعار',columns:['ت','نوع المادة','الكمية','السعر (د.ع)','الإجمالي (د.ع)'],rows:6}
  };
  function readLegalTables(){
    try{const value=JSON.parse(localStorage.getItem(LEGAL_TABLES_STORAGE_KEY)||'[]');if(!Array.isArray(value))return[];return value.filter(item=>item&&typeof item.id==='string'&&Array.isArray(item.columns)&&Array.isArray(item.rows)).map(item=>{if(item.type==='marital-furniture'&&!item.columns.includes('مصدر التملك')){const noteIndex=item.columns.findIndex(name=>String(name).trim()==='ملاحظات');const insertAt=noteIndex>=0?noteIndex:item.columns.length;item.columns.splice(insertAt,0,'مصدر التملك');item.rows.forEach(row=>row.splice(insertAt,0,''));}item.metadataFields=Array.isArray(item.metadataFields)?item.metadataFields.map(field=>typeof field==='string'?{value:field}:{value:String(field?.label?[field.label,field.value].filter(Boolean).join(': '):(field?.value??''))}):[];return item;});}
    catch(error){console.warn('تعذر قراءة الجداول المحفوظة:',error);return[];}
  }
  function writeLegalTables(items){
    try{localStorage.setItem(LEGAL_TABLES_STORAGE_KEY,JSON.stringify(items));return true;}
    catch(error){console.error('تعذر حفظ الجداول القانونية:',error);window.app?.showHomeNotice?.('تعذر الحفظ','مساحة التخزين المحلية غير كافية أو غير متاحة.');return false;}
  }
  function createLegalTable(type){
    const template=legalTableTemplates[type];if(!template)return;
    return {id:'lt-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),type,title:template.title,metadataFields:[],columns:[...template.columns],rows:Array.from({length:template.rows},()=>template.columns.map(()=>'')),updatedAt:new Date().toISOString()};
  }
  function parseLegalAmount(value){
    let normalized=String(value??'')
      .replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x0660))
      .replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x06F0))
      .replace(/[\s٬]/g,'')
      .replace(/[،٫]/g,'.')
      .replace(/[^0-9.,+-]/g,'');
    if(!normalized||!/[0-9]/.test(normalized))return null;
    const sign=normalized.startsWith('-')?'-':'';
    normalized=normalized.replace(/[+-]/g,'');
    const separators=[...normalized.matchAll(/[.,]/g)].map(match=>match.index);
    if(separators.length){
      const groups=normalized.split(/[.,]/);
      const isGrouped=groups.length>1&&groups.slice(1).every(group=>group.length===3)&&groups.every(group=>/^\d+$/.test(group));
      if(isGrouped)normalized=groups.join('');
      else{
        const last=separators[separators.length-1];
        const integerPart=normalized.slice(0,last).replace(/[.,]/g,'');
        const fractionPart=normalized.slice(last+1).replace(/[.,]/g,'');
        normalized=integerPart+'.'+fractionPart;
      }
    }
    const number=Number(sign+normalized);
    return Number.isFinite(number)?number:null;
  }
  function legalTableTotal(table){
    const totalIndex=table.columns.findIndex(name=>/الإجمالي|المجموع/i.test(String(name)));
    const amountIndex=table.columns.findIndex(name=>/القيمة|السعر|المبلغ/i.test(String(name)));
    if(totalIndex<0&&amountIndex<0)return 0;
    return table.rows.reduce((sum,row)=>{
      const totalValue=totalIndex>=0?parseLegalAmount(row[totalIndex]):null;
      const amountValue=amountIndex>=0?parseLegalAmount(row[amountIndex]):null;
      return sum+(totalValue!==null?totalValue:(amountValue!==null?amountValue:0));
    },0);
  }
  function renderLegalTables(){
    const root=document.getElementById('petition-browse');if(!root)return;
    const cards=[
      {id:'marital-furniture',icon:'fas fa-couch',title:'قائمة أثاث الزوجية',description:'قائمة تفصيلية للموجودات والأثاث والكميات والقيم والملاحظات.',tag:'قالب جاهز'},
      {id:'materials-prices',icon:'fas fa-calculator',title:'جدول المواد والأسعار',description:'تنظيم المواد والكميات والأسعار مع احتساب الإجماليات.',tag:'قالب جاهز'}
    ];
    const saved=readLegalTables();
    root.innerHTML='<div class="legal-tables-page"><button type="button" class="back-btn legal-tables-back" id="legal-tables-back"><i class="fas fa-arrow-right"></i> العودة إلى العرائض والطلبات</button><section class="legal-tables-hero mizan-section-hero"><div class="mizan-section-hero-heading"><span class="mizan-section-hero-icon"><i class="fas fa-table-cells-large"></i></span><h2>قسم الجداول القانونية</h2></div><p>أنشئ الجداول وعدّل خلاياها وأعمدتها وصفوفها، ثم احفظها واطبعها عند الحاجة.</p></section><div class="legal-tables-section-heading"><div><span>قوالب جاهزة</span><h3>إنشاء جدول جديد</h3></div><small>اختر القالب المناسب وابدأ التعديل</small></div><div class="legal-tables-grid">'+cards.map(item=>'<button type="button" class="legal-table-card" data-legal-table="'+item.id+'"><span class="legal-table-card-icon"><i class="'+item.icon+'" aria-hidden="true"></i></span><span class="legal-table-card-tag">'+item.tag+'</span><strong>'+item.title+'</strong><small>'+item.description+'</small><span class="legal-table-card-action">إنشاء جدول <i class="fas fa-arrow-left" aria-hidden="true"></i></span></button>').join('')+'</div><section class="legal-tables-saved"><div class="legal-tables-section-heading"><div><span>مساحة العمل</span><h3>الجداول المحفوظة</h3></div><small>'+saved.length.toLocaleString('ar-IQ')+' جدول</small></div><div class="legal-tables-saved-list">'+(saved.length?saved.map(item=>'<article class="legal-tables-saved-card"><span class="legal-table-card-icon"><i class="fas fa-table" aria-hidden="true"></i></span><div><strong>'+esc(item.title||'جدول قانوني')+'</strong><small>آخر تعديل: '+esc(item.updatedAt?new Date(item.updatedAt).toLocaleDateString('ar-IQ'):'—')+'</small></div><button type="button" data-open-saved-table="'+esc(item.id)+'">فتح وتعديل</button><button type="button" class="legal-tables-delete" data-delete-saved-table="'+esc(item.id)+'" aria-label="حذف الجدول"><i class="fas fa-trash"></i></button></article>').join(''):'<div class="legal-tables-empty-state"><span><i class="fas fa-folder-open" aria-hidden="true"></i></span><div><strong>لا توجد جداول محفوظة بعد</strong><p>أنشئ جدولاً من أحد القوالب أعلاه، وبعد حفظه سيظهر هنا ويمكنك فتحه وتعديله لاحقاً.</p></div></div>')+'</div></section></div>';
    document.getElementById('legal-tables-back')?.addEventListener('click',()=>navigateBack('categories'));
    root.querySelectorAll('[data-legal-table]').forEach(button=>button.addEventListener('click',()=>openLegalTableEditor(button.dataset.legalTable)));
    root.querySelectorAll('[data-open-saved-table]').forEach(button=>button.addEventListener('click',()=>openLegalTableEditor(null,button.dataset.openSavedTable)));
    root.querySelectorAll('[data-delete-saved-table]').forEach(button=>button.addEventListener('click',()=>{
      const item= saved.find(entry=>entry.id===button.dataset.deleteSavedTable);if(!item)return;
      if(!window.confirm('هل تريد حذف الجدول «'+(item.title||'جدول قانوني')+'» نهائياً من هذا الجهاز؟'))return;
      writeLegalTables(saved.filter(entry=>entry.id!==item.id));renderLegalTables();
    }));
  }
  function openLegalTableEditor(type,savedId=null,pushHistory=true){
    const table=savedId?readLegalTables().find(item=>item.id===savedId):createLegalTable(type);
    if(!table)return;
    activeLegalTable=JSON.parse(JSON.stringify(table));
    if(pushHistory)window.app?.navigateTo('petitions',{parentView:'petitions',petitionLevel:'legal-table-editor',legalTableId:activeLegalTable.id});
    renderLegalTableEditor();
  }
  function renderLegalTableEditor(){
    const root=document.getElementById('petition-browse');const table=activeLegalTable;if(!root||!table)return;
    const total=legalTableTotal(table);
    const hasSerialColumn=table.columns.some(column=>/^(ت|التسلسل|#)$/.test(String(column).trim()));
    const autoIndexHeader=hasSerialColumn?'':'<th class="legal-table-index">#</th>';
    table.metadataFields=Array.isArray(table.metadataFields)?table.metadataFields:[];
    root.innerHTML='<div class="legal-table-editor"><div class="legal-table-editor-top"><button type="button" class="back-btn" id="legal-table-editor-back"><i class="fas fa-arrow-right"></i> الجداول القانونية</button><span class="legal-table-editor-status"><i class="fas fa-shield-halved"></i> حفظ محلي على هذا الجهاز</span></div><section class="legal-table-editor-heading"><span>محرر الجداول القانونية</span><label for="legal-table-title">عنوان الجدول</label><input id="legal-table-title" maxlength="140" value="'+esc(table.title)+'" placeholder="اكتب عنوان الجدول"><div class="legal-table-meta-heading"><strong>البيانات الإضافية أعلى الجدول</strong><button type="button" id="legal-table-add-meta"><i class="fas fa-plus"></i> إضافة حقل</button></div><div class="legal-table-meta-fields">'+(table.metadataFields.length?table.metadataFields.map((field,index)=>'<div class="legal-table-meta-field"><input data-meta-value="'+index+'" maxlength="320" value="'+esc(field.value||'')+'" placeholder="مثلاً: اسم المدعية: زهراء — رقم الدعوى: ١٢٣"><button type="button" data-remove-meta="'+index+'" aria-label="حذف الحقل"><i class="fas fa-trash"></i></button></div>').join(''):'<p class="legal-table-meta-empty">اكتب في كل حقل أي معلومة تريد إظهارها أعلى الجدول.</p>')+'</div></section><div class="legal-table-editor-hint"><i class="fas fa-circle-info"></i> اضغط داخل أي خلية لتعديلها. يمكنك تعديل أسماء الأعمدة، وإضافة أو حذف الصفوف والأعمدة.</div><div class="legal-table-scroll"><table class="legal-table-grid" aria-label="'+esc(table.title)+'"><thead><tr>'+autoIndexHeader+table.columns.map((column,index)=>'<th><input class="legal-table-column-name" data-column-name="'+index+'" aria-label="اسم العمود '+(index+1)+'" value="'+esc(column)+'"><button type="button" class="legal-table-remove-column" data-remove-column="'+index+'" aria-label="حذف العمود"><i class="fas fa-xmark"></i></button></th>').join('')+'<th class="legal-table-actions-heading">إجراء</th></tr></thead><tbody>'+table.rows.map((row,rowIndex)=>'<tr>'+(hasSerialColumn?'': '<th class="legal-table-row-number">'+(rowIndex+1).toLocaleString('ar-IQ')+'</th>')+table.columns.map((column,columnIndex)=>'<td><input class="legal-table-cell" data-row="'+rowIndex+'" data-column="'+columnIndex+'" aria-label="الصف '+(rowIndex+1)+'، '+esc(column)+'" value="'+esc(/^(ت|التسلسل|#)$/.test(column.trim())?(rowIndex+1):(row[columnIndex]||''))+'" placeholder="—" '+(/^(ت|التسلسل|#)$/.test(column.trim())?'readonly':'')+'></td>').join('')+'<td class="legal-table-row-actions"><button type="button" data-remove-row="'+rowIndex+'" aria-label="حذف الصف '+(rowIndex+1)+'"><i class="fas fa-trash"></i></button></td></tr>').join('')+'</tbody></table></div><div class="legal-table-editor-footer"><div><span>عدد الصفوف</span><strong>'+table.rows.length.toLocaleString('ar-IQ')+'</strong></div><div><span>عدد الأعمدة</span><strong>'+table.columns.length.toLocaleString('ar-IQ')+'</strong></div><div><span>مجموع القيم المدخلة</span><strong>'+total.toLocaleString('en-US')+' د.ع</strong></div></div><div class="legal-table-toolbar legal-table-toolbar-bottom"><button type="button" class="primary" id="legal-table-add-row"><i class="fas fa-plus"></i> إضافة صف</button><button type="button" id="legal-table-add-column"><i class="fas fa-columns"></i> إضافة عمود</button><button type="button" id="legal-table-save"><i class="fas fa-floppy-disk"></i> حفظ الجدول</button><button type="button" id="legal-table-print"><i class="fas fa-file-pdf"></i> طباعة / PDF</button></div>';
    document.getElementById('legal-table-editor-back')?.addEventListener('click',()=>navigateBack('legal-tables'));
    document.getElementById('legal-table-title')?.addEventListener('input',event=>{table.title=event.target.value;});
    document.getElementById('legal-table-add-meta')?.addEventListener('click',()=>{table.metadataFields.push({value:''});renderLegalTableEditor();const fields=root.querySelectorAll('[data-meta-value]');fields[fields.length-1]?.focus();});
    root.querySelectorAll('[data-meta-value]').forEach(input=>input.addEventListener('input',event=>{table.metadataFields[Number(event.target.dataset.metaValue)].value=event.target.value;}));
    root.querySelectorAll('[data-remove-meta]').forEach(button=>button.addEventListener('click',()=>{table.metadataFields.splice(Number(button.dataset.removeMeta),1);renderLegalTableEditor();}));
    root.querySelectorAll('[data-column-name]').forEach(input=>input.addEventListener('input',event=>{table.columns[Number(event.target.dataset.columnName)]=event.target.value;}));
    root.querySelectorAll('[data-row][data-column]').forEach(input=>input.addEventListener('input',event=>{
      const row=Number(event.target.dataset.row),column=Number(event.target.dataset.column);table.rows[row][column]=event.target.value;
      if(/القيمة|السعر|المبلغ|الإجمالي|المجموع/i.test(table.columns[column])){const footer=root.querySelector('.legal-table-editor-footer div:last-child strong');if(footer)footer.textContent=legalTableTotal(table).toLocaleString('en-US')+' د.ع';}
    }));
    document.getElementById('legal-table-add-row')?.addEventListener('click',()=>{table.rows.push(table.columns.map(()=>''));renderLegalTableEditor();});
    document.getElementById('legal-table-add-column')?.addEventListener('click',()=>{
      const name='عمود جديد';table.columns.push(name);table.rows.forEach(row=>row.push(''));renderLegalTableEditor();
      const inputs=root.querySelectorAll('.legal-table-column-name');inputs[inputs.length-1]?.focus();inputs[inputs.length-1]?.select();
    });
    root.querySelectorAll('[data-remove-column]').forEach(button=>button.addEventListener('click',()=>{
      if(table.columns.length<=1){window.app?.showHomeNotice?.('تنبيه','يجب أن يحتوي الجدول على عمود واحد على الأقل.');return;}
      const index=Number(button.dataset.removeColumn);if(!window.confirm('حذف العمود «'+table.columns[index]+'» وجميع خلاياه؟'))return;
      table.columns.splice(index,1);table.rows.forEach(row=>row.splice(index,1));renderLegalTableEditor();
    }));
    root.querySelectorAll('[data-remove-row]').forEach(button=>button.addEventListener('click',()=>{
      if(table.rows.length<=1){window.app?.showHomeNotice?.('تنبيه','يجب أن يحتوي الجدول على صف واحد على الأقل.');return;}
      const index=Number(button.dataset.removeRow);table.rows.splice(index,1);renderLegalTableEditor();
    }));
    document.getElementById('legal-table-save')?.addEventListener('click',()=>{
      table.title=String(document.getElementById('legal-table-title')?.value||'').trim()||'جدول قانوني';
      table.updatedAt=new Date().toISOString();
      const saved=readLegalTables();const index=saved.findIndex(item=>item.id===table.id);
      if(index>=0)saved[index]=table;else saved.unshift(table);
      if(writeLegalTables(saved))window.app?.showHomeNotice?.('تم الحفظ','تم حفظ الجدول على هذا الجهاز بنجاح.');
    });
    document.getElementById('legal-table-print')?.addEventListener('click',()=>printLegalTable(table));
  }
  function printLegalTable(table){
    const popup=window.open('','_blank');if(!popup){window.app?.showHomeNotice?.('تعذر فتح الطباعة','اسمح بالنوافذ المنبثقة لهذا الموقع ثم حاول مجدداً.');return;}
    const serialIndex=table.columns.findIndex(column=>/^(ت|التسلسل|#)$/.test(String(column).trim()));
    const metadata=(table.metadataFields||[]).map(field=>String(field.value||'').trim()).filter(Boolean).map(value=>'<div class="meta-item">'+esc(value)+'</div>').join('');
    const printHeaders=(serialIndex<0?'<th>#</th>':'')+table.columns.map(name=>'<th>'+esc(name)+'</th>').join('');
    const rows=table.rows.map((row,rowIndex)=>'<tr>'+(serialIndex<0?'<td>'+(rowIndex+1).toLocaleString('ar-IQ')+'</td>':'')+table.columns.map((column,index)=>'<td>'+esc(serialIndex===index?(rowIndex+1).toLocaleString('ar-IQ'):(row[index]||''))+'</td>').join('')+'</tr>').join('');
    popup.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+esc(table.title)+'</title><link rel="stylesheet" href="'+esc(dataUrl('assets/shared/css/mizan-colors.css?v=6.61'))+'"><link rel="stylesheet" href="'+esc(dataUrl('assets/shared/css/mizan-design-tokens.css?v=2.24'))+'"><style>body{font-family:Arial,sans-serif;color:var(--mizan-legal-table-print-ink);padding:var(--mizan-space-6)}h1{text-align:center;font-size:var(--mizan-font-size-22);margin:0 0 var(--mizan-space-4)}.meta{display:flex;flex-wrap:wrap;gap:var(--mizan-space-2) var(--mizan-space-6);margin-bottom:var(--mizan-space-4)}.meta-item{display:flex;gap:var(--mizan-space-2);min-width:30%;white-space:pre-wrap}table{width:100%;border-collapse:collapse}th,td{border:1px solid var(--mizan-legal-table-print-border);padding:var(--mizan-space-2);text-align:right;vertical-align:middle}th{background:var(--mizan-legal-table-print-heading-bg);font-weight:700}tr{break-inside:avoid}@page{size:A4 landscape;margin:14mm}@media print{body{padding:0}}</style></head><body><h1>'+esc(table.title)+'</h1><section class="meta">'+metadata+'</section><table><thead><tr>'+printHeaders+'</tr></thead><tbody>'+rows+'</tbody></table><script>window.onload=()=>window.print();<\/script></body></html>');
    popup.document.close();
  }
  function renderCategories(){
    const root=document.getElementById('petition-browse');if(!root)return;
    root.innerHTML='<button type="button" class="legal-tables-entry-card" id="open-legal-tables"><span class="legal-tables-entry-icon"><i class="fas fa-table-cells-large" aria-hidden="true"></i></span><span><strong>قسم الجداول القانونية</strong><small>إنشاء قوائم الأثاث والجداول القانونية وتنظيمها</small></span><b>فتح القسم <i class="fas fa-arrow-left"></i></b></button><div class="petition-category-grid">'+state.categories.map(c=>{const count=state.petitionIndex.filter(item=>item.categoryId===c.id).length;return '<button class="petition-category-card" data-category="'+esc(c.id)+'" aria-label="فتح قسم '+esc(c.name)+'، '+count+' نموذج"><span class="petition-category-icon"><i class="'+esc(c.icon)+'" aria-hidden="true"></i></span><span class="petition-category-copy"><strong>'+esc(c.name)+'</strong><small>'+esc(c.description)+'</small></span><span class="petition-category-count"><b>'+count.toLocaleString('ar-IQ')+'</b><span>نموذج</span></span></button>';}).join('')+'</div>';
    root.querySelector('#open-legal-tables')?.addEventListener('click',()=>openLegalTables());
    root.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>openCategory(b.dataset.category));
  }
  async function openCategory(categoryId,pushHistory=true){
    const category=state.categories.find(c=>c.id===categoryId);if(!category)return;
    state.categoryId=categoryId;state.templates=[];
    if(pushHistory)window.app.navigateTo('petitions',{parentView:'petitions',petitionLevel:'category',categoryId});
    const root=document.getElementById('petition-browse');if(!root)return;
    root.innerHTML='<div class="petition-loading">جاري تحميل نماذج القسم...</div>';
    try{const items=await loadTemplates(categoryId);if(state.categoryId!==categoryId)return;renderCards('',category,items);}
    catch(e){renderLoadError('تعذر تحميل نماذج هذا القسم. حاول مرة أخرى.');}
  }
  function renderCards(query,category,items){
    const root=document.getElementById('petition-browse');if(!root)return;
    const q=String(query||'').trim().toLowerCase();const source=items||state.templates;
    const filtered=source.filter(t=>!q||[t.name,t.category,t.description].join(' ').toLowerCase().includes(q));
    root.innerHTML='<button class="back-btn petition-category-back" id="petition-category-back"><i class="fas fa-arrow-right"></i> الأقسام</button><div class="petition-category-heading"><span>'+esc(category.name)+'</span></div><div class="petition-tools"><label><i class="fas fa-search"></i><input id="petition-search" placeholder="ابحث ضمن نماذج هذا القسم..."></label><span id="petition-count">'+filtered.length+' نموذج</span></div><div id="petition-template-grid" class="petition-template-grid"></div>';
    document.getElementById('petition-category-back').onclick=()=>navigateBack('categories');
    document.getElementById('petition-search').oninput=e=>drawTemplateCards(e.target.value,category,source);
    drawTemplateCards(q,category,source);
  }
  function drawTemplateCards(query,category,items){
    const grid=document.getElementById('petition-template-grid');if(!grid)return;const q=String(query||'').trim().toLowerCase();
    const filtered=items.filter(t=>!q||[t.name,t.category,t.description].join(' ').toLowerCase().includes(q));
    const count=document.getElementById('petition-count');if(count)count.textContent=filtered.length+' نموذج';
    grid.innerHTML=filtered.length?filtered.map(t=>'<button class="petition-template-card" data-template="'+esc(t.uid)+'"><div class="petition-template-icon"><i class="'+esc(t.icon||'fas fa-file-signature')+'"></i></div><div><span>'+esc(category.name)+'</span><h3>'+esc(t.name)+'</h3><p>'+esc(t.description||'نموذج قابل للتعبئة والتعديل')+'</p></div><b>إنشاء العريضة ←</b></button>').join(''):'<div class="petition-empty">لا توجد نماذج مطابقة حالياً.</div>';
    grid.querySelectorAll('[data-template]').forEach(btn=>btn.onclick=()=>start(btn.dataset.template));
  }
  async function start(uid,pushHistory=true){
    const categoryId=state.categoryId;
    const meta=Object.values(state.categoryTemplates).flat().find(t=>t.uid===uid)||state.templates.find(t=>t.uid===uid);
    if(!meta)return;
    const root=document.getElementById('petitions-section');if(!root)return;
    if(pushHistory)window.app.navigateTo('petitions',{parentView:'petitions',petitionLevel:'document',categoryId:state.categoryId,templateUid:uid});
    root.innerHTML='<div class="petitions-shell"><button class="back-btn" id="petition-loading-back"><i class="fas fa-arrow-right"></i> العودة للنماذج</button><div class="petition-loading">جاري تحميل العريضة...</div></div>';
    document.getElementById('petition-loading-back').onclick=()=>navigateBack('category');
    try{
      state.template=await loadDocument(uid);
      if(state.categoryId!==categoryId||!document.getElementById('petitions-section')?.isConnected)return;
      const drafts=readDrafts();
      state.branded=drafts[uid]?.branded===true;
      state.editedBody=plainTextToEditor(drafts[uid]?.body??state.template.body);
      state.savedBody=state.editedBody;
      state.editedLetterhead=normalizeLetterheadHtml(drafts[uid]?.letterhead||'');
      state.savedLetterhead=state.editedLetterhead;
      state.mode='read';
      renderDocument();
    }catch(e){
      if(state.categoryId!==categoryId)return;
      root.innerHTML='<div class="petitions-shell"><button class="back-btn" id="petition-load-fail-back">العودة للنماذج</button><div class="petition-empty">تعذر تحميل العريضة. حاول مرة أخرى.</div></div>';
      document.getElementById('petition-load-fail-back').onclick=()=>navigateBack('category');
    }
  }
  function documentHeader(){
    const t=state.template;
    return '<div class="petition-builder-head"><div><span>'+esc(t.category||'نموذج قانوني')+'</span><h2>'+esc(t.name)+'</h2><p>'+esc(t.description||'')+'</p></div></div>';
  }
  function documentBodyHtml(){
    return plainTextToEditor(state.editedBody??'');
  }
  function letterheadHtml(nameOverride,logoOverride,nameHtmlOverride){
    const logoBase=location.pathname.includes('/exam-platform-v2')?'/exam-platform-v2/':'/';
    const imgUrl=logoOverride||(logoBase+'assets/iraqi-bar-association-modern.svg');
    const name=nameOverride??'اسم المحامي';
    const lawyerName=nameHtmlOverride===undefined?esc(name):sanitizeLetterheadNameHtml(nameHtmlOverride);
    return '<header class="petition-letterhead"><div class="petition-head-side petition-head-left" dir="rtl"><strong dir="rtl">جمهورية العراق</strong><b dir="rtl">نقابة المحامين العراقيين</b></div><div class="petition-bar-logo"><img src="'+esc(imgUrl)+'" alt="شعار نقابة المحامين العراقيين"></div><div class="petition-head-side petition-head-right" dir="rtl">'+lawyerName+'</div></header>';
  }
  function sanitizeLetterheadNameHtml(source){
    const doc=new DOMParser().parseFromString(String(source??''),'text/html');
    const allowed=new Set(['SPAN','B','STRONG','EM','I','U','BR']);
    Array.from(doc.body.querySelectorAll('*')).reverse().forEach(node=>{
      if(!allowed.has(node.tagName)){
        node.replaceWith(...Array.from(node.childNodes));
        return;
      }
      const style=node.getAttribute('style')||'';
      Array.from(node.attributes).forEach(attr=>node.removeAttribute(attr.name));
      if(node.tagName==='SPAN'&&style){
        const parsed=document.createElement('span');
        parsed.setAttribute('style',style);
        const safe=[];
        const size=parsed.style.fontSize;
        const weight=parsed.style.fontWeight;
        const fontStyle=parsed.style.fontStyle;
        const decoration=parsed.style.textDecoration;
        if(/^(?:\d+(?:\.\d+)?)(?:px|pt|em|rem|%)$/.test(size))safe.push('font-size:'+size);
        if(/^(?:normal|bold|[1-9]00)$/.test(weight))safe.push('font-weight:'+weight);
        if(/^(?:normal|italic|oblique)$/.test(fontStyle))safe.push('font-style:'+fontStyle);
        if(/^(?:none|underline|line-through|overline)$/.test(decoration))safe.push('text-decoration:'+decoration);
        if(safe.length)node.setAttribute('style',safe.join(';'));
      }
    });
    return doc.body.innerHTML;
  }
  function normalizeLetterheadHtml(source){
    if(!source)return '';
    try{
      const doc=new DOMParser().parseFromString(String(source),'text/html');
      const header=doc.body.querySelector('.petition-letterhead');
      if(!header)return '';
      const nameContainer=header.querySelector('.petition-head-right');
      const nameHtml=nameContainer?.innerHTML??'';
      const name=nameContainer?.textContent??'';
      const logo=header.querySelector('.petition-bar-logo img')?.getAttribute('src')||'';
      return letterheadHtml(name,logo||undefined,nameHtml);
    }catch(e){return '';}
  }
  function brandingToggleHtml(){
    return '<button type="button" class="petition-brand-toggle" id="petition-brand-toggle" aria-pressed="'+String(state.branded)+'"><i class="fas fa-scale-balanced"></i> '+(state.branded?'إخفاء ترويسة المحامي':'إظهار تصميم المحامي')+'</button>';
  }
  function renderDocument(){
    const root=document.getElementById('petitions-section'),t=state.template;
    if(!root||!t)return;
    root.innerHTML='<div class="petitions-shell petition-document-shell"><button class="back-btn" id="petition-document-back"><i class="fas fa-arrow-right"></i> النماذج</button>'+documentHeader()+brandingToggleHtml()+
      '<div class="petition-live-preview petition-document-preview" aria-label="معاينة العريضة بحجم A4"><iframe class="petition-a4-preview-frame" title="معاينة العريضة بحجم A4" tabindex="0"></iframe></div>'+
      '<div class="petition-document-actions"><button type="button" class="petition-primary" id="petition-edit"><i class="fas fa-pen-to-square"></i> تعديل العريضة</button></div></div>';
    const documentPreview=root.querySelector('.petition-document-preview');
    const documentFrame=documentPreview?.querySelector('.petition-a4-preview-frame');
    if(documentFrame&&documentPreview)fitPetitionPreview(documentFrame,documentPreview,true);
    document.getElementById('petition-document-back').onclick=()=>navigateBack('category');
    document.getElementById('petition-brand-toggle').onclick=()=>{state.branded=!state.branded;renderDocument();};
    document.getElementById('petition-edit').onclick=()=>{state.mode='edit';renderEditor();};
  }
  function renderEditor(){
    const root=document.getElementById('petitions-section'),t=state.template;
    if(!root||!t)return;
    root.innerHTML='<div class="petitions-shell petition-editor-shell"><button class="back-btn" id="petition-editor-back"><i class="fas fa-arrow-right"></i> العودة للقراءة</button>'+documentHeader()+
      '<div class="petition-editor-branding">'+brandingToggleHtml()+'<input type="file" id="petition-logo-file" accept="image/*" hidden></div><div class="petition-editor-panel"><div class="petition-editor-toolbar" role="toolbar" aria-label="أدوات تنسيق العريضة">'+
      '<label class="petition-font-size-control" title="حجم الخط">حجم الخط <select id="petition-font-size" aria-label="اختيار حجم الخط"><option value="">اختر</option><option value="12">12</option><option value="14">14</option><option value="16">16</option><option value="18">18</option><option value="20" selected>20</option><option value="22">22</option><option value="24">24</option><option value="28">28</option><option value="32">32</option><option value="36">36</option><option value="40">40</option><option value="48">48</option></select></label>'+
      '<span class="petition-editor-separator"></span>'+
      '<button type="button" data-indent-step="1" aria-label="إزاحة إلى اليمين" title="إزاحة إلى اليمين"><i class="fas fa-indent fa-flip-horizontal"></i></button>'+
      '<button type="button" data-indent-step="-1" aria-label="إزاحة إلى اليسار" title="إزاحة إلى اليسار"><i class="fas fa-outdent fa-flip-horizontal"></i></button>'+
      '<span class="petition-editor-separator"></span>'+
      '<button type="button" data-command="bold" aria-label="خط عريض" title="خط عريض"><strong>B</strong></button>'+
      '<button type="button" data-command="italic" aria-label="خط مائل" title="خط مائل"><em>I</em></button>'+
      '<button type="button" data-command="underline" aria-label="تسطير" title="تسطير"><u>U</u></button>'+
      '<span class="petition-editor-separator"></span>'+
      '<button type="button" data-command="justifyRight" aria-label="محاذاة لليمين" title="محاذاة لليمين"><i class="fas fa-align-right"></i></button>'+
      '<button type="button" data-command="justifyCenter" aria-label="توسيط" title="توسيط"><i class="fas fa-align-center"></i></button>'+
      '<button type="button" data-command="justifyLeft" aria-label="محاذاة لليسار" title="محاذاة لليسار"><i class="fas fa-align-left"></i></button>'+
      '<button type="button" data-command="insertUnorderedList" title="قائمة نقطية">• قائمة</button>'+
      '<button type="button" data-command="insertOrderedList" title="قائمة مرقمة">١. قائمة</button>'+
      '<button type="button" data-command="undo" aria-label="تراجع" title="تراجع"><i class="fas fa-rotate-left"></i></button>'+
      '<button type="button" data-command="redo" aria-label="إعادة" title="إعادة"><i class="fas fa-rotate-right"></i></button>'+
      '</div><div class="petition-editor-page-wrap" id="petition-editor-page-wrap"><article class="petition-a4 petition-rich-editor '+(state.branded?'is-branded':'')+'" id="petition-rich-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-label="تحرير العريضة كاملة" dir="rtl">'+(state.branded?(state.editedLetterhead||letterheadHtml()):'')+'<div class="petition-doc-body">'+plainTextToEditor(state.editedBody)+'</div></article></div></div>'+
      '<div class="petition-live-preview" id="petition-live-preview" aria-label="معاينة ورقة A4" hidden><iframe class="petition-a4-preview-frame" title="معاينة العريضة بحجم A4" tabindex="0"></iframe></div>'+
      '<div class="petition-document-actions petition-editor-actions" role="group" aria-label="إجراءات العريضة"><button type="button" class="petition-secondary" id="petition-editor-cancel">إلغاء التعديلات</button><button type="button" class="petition-secondary" id="petition-editor-save">حفظ نسخة العمل</button><button type="button" class="petition-secondary" id="petition-editor-restore"><i class="fas fa-rotate-left"></i> استعادة النص الأصلي</button><button type="button" class="petition-primary" id="petition-editor-preview"><i class="fas fa-eye"></i> معاينة</button><button type="button" class="petition-primary" id="petition-editor-print"><i class="fas fa-print"></i> طباعة / حفظ PDF</button><button type="button" class="petition-secondary" id="petition-editor-word">تصدير Word</button></div></div>';
    const editor=document.getElementById('petition-rich-editor');
    let savedEditorHtml=editor?.innerHTML??'';
    state.editorSavedHtml=savedEditorHtml;
    const editorToolbar=root.querySelector('.petition-editor-toolbar');
    if(editor&&editorToolbar){
      const mobileEditorQuery=window.matchMedia('(max-width: 600px) and (pointer: coarse)');
      const viewport=window.visualViewport;
      const toolbarHome=editorToolbar.parentNode;
      const toolbarMarker=document.createComment('petition-editor-toolbar-home');
      toolbarHome.insertBefore(toolbarMarker,editorToolbar);
      let keyboardActive=false;
      let baselineHeight=window.innerHeight;
      let closeTimer=0;
      let toolbarInteractionUntil=0;
      const toolbarIsActive=()=>editorToolbar.contains(document.activeElement);
      const markToolbarInteraction=()=>{toolbarInteractionUntil=Date.now()+2500;clearTimeout(closeTimer);};
      const setKeyboardToolbar=(active)=>{
        if(!mobileEditorQuery.matches)active=false;
        if(active===keyboardActive)return;
        keyboardActive=active;
        if(active){
          // Portal to body so fixed positioning is independent of the scrolling/transformed app shell.
          document.body.appendChild(editorToolbar);
          editorToolbar.classList.add('petition-toolbar-docked');
        }else{
          editorToolbar.classList.remove('petition-toolbar-docked');
          root.classList.remove('petition-keyboard-active');
          root.style.removeProperty('--petition-keyboard-offset');
          if(toolbarMarker.parentNode)toolbarMarker.parentNode.insertBefore(editorToolbar,toolbarMarker.nextSibling);
          baselineHeight=window.innerHeight;
        }
      };
      const updateMobileEditorToolbar=()=>{
        if(!mobileEditorQuery.matches){
          setKeyboardToolbar(false);
          return;
        }
        const visibleHeight=viewport?viewport.height:window.innerHeight;
        const visibleTop=viewport?viewport.offsetTop:0;
        const layoutHeight=window.innerHeight;
        const keyboardGap=Math.max(0,layoutHeight-visibleHeight-visibleTop);
        const keyboardReduced=baselineHeight-visibleHeight>100;
        const editorHasFocus=document.activeElement===editor;
        const toolbarHasFocus=toolbarIsActive();
        const toolbarInteractionPending=Date.now()<toolbarInteractionUntil;
        const keyboardOpen=(keyboardGap>100||keyboardReduced)&&
          (editorHasFocus||keyboardActive||toolbarHasFocus||toolbarInteractionPending);
        if(keyboardOpen){
          clearTimeout(closeTimer);
          setKeyboardToolbar(true);
          // Track the visual viewport's lower edge; do not add a second offset when the
          // browser has already resized the layout viewport to the keyboard.
          editorToolbar.style.bottom=Math.max(0,keyboardGap)+'px';
        }else if(keyboardActive&&!toolbarInteractionPending&&visibleHeight>=baselineHeight-80){
          // The keyboard can be dismissed while the editor retains focus.
          // Visibility, not editor blur, is the reliable close signal on mobile.
          clearTimeout(closeTimer);
          closeTimer=setTimeout(()=>{
            const nowHeight=viewport?viewport.height:window.innerHeight;
            const nowGap=Math.max(0,window.innerHeight-nowHeight-(viewport?viewport.offsetTop:0));
            const focusStillInToolbar=toolbarIsActive();
            if(nowHeight>=baselineHeight-80&&nowGap<=80&&!focusStillInToolbar&&Date.now()>=toolbarInteractionUntil){
              setKeyboardToolbar(false);
              editorToolbar.style.removeProperty('bottom');
            }
          },350);
        }else if(!keyboardActive){
          editorToolbar.style.removeProperty('bottom');
        }
      };
      editor.addEventListener('focus',()=>{
        clearTimeout(closeTimer);
        baselineHeight=Math.max(baselineHeight,window.innerHeight,viewport?viewport.height:0);
        setTimeout(updateMobileEditorToolbar,80);
      });
      editor.addEventListener('blur',()=>{
        clearTimeout(closeTimer);
        closeTimer=setTimeout(updateMobileEditorToolbar,250);
      });
      editorToolbar.addEventListener('pointerdown',markToolbarInteraction,{passive:true});
      editorToolbar.addEventListener('touchstart',markToolbarInteraction,{passive:true});
      editorToolbar.addEventListener('mousedown',markToolbarInteraction);
      editorToolbar.addEventListener('focusin',markToolbarInteraction);
      editorToolbar.addEventListener('change',markToolbarInteraction,true);
      if(viewport){
        viewport.addEventListener('resize',updateMobileEditorToolbar,{passive:true});
        viewport.addEventListener('scroll',updateMobileEditorToolbar,{passive:true});
      }
      window.addEventListener('resize',updateMobileEditorToolbar,{passive:true});
      mobileEditorQuery.addEventListener?.('change',updateMobileEditorToolbar);
    }
    const editorPageWrap=document.getElementById('petition-editor-page-wrap');
    if(editor&&editorPageWrap){
      const fitEditorPage=()=>{
        const pageWidth=210*96/25.4;
        const availableWidth=Math.max(1,editorPageWrap.clientWidth);
        const scale=Math.min(1,availableWidth/pageWidth);
        editor.style.width='210mm';
        editor.style.minHeight='297mm';
        editor.style.boxSizing='border-box';
        editor.style.margin='0';
        editor.style.transformOrigin='top left';
        editor.style.transform='scale('+scale+')';
        editorPageWrap.style.height=(Math.max(editor.scrollHeight,297*96/25.4)*scale)+'px';
        editor.style.marginLeft=Math.max(0,(availableWidth-pageWidth*scale)/2)+'px';
      };
      fitEditorPage();
      editor.addEventListener('input',fitEditorPage);
      window.addEventListener('resize',fitEditorPage,{passive:true});
      editorPageWrap.dataset.fitBound='true';
    }
    const logoInput=document.getElementById('petition-logo-file');
    const logoImage=editor?.querySelector('.petition-bar-logo img');
    if(logoImage&&logoInput){
      logoImage.title='اضغط لاستبدال الشعار';
      logoImage.style.cursor='pointer';
      logoImage.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();logoInput.click();});
      logoInput.addEventListener('change',()=>{
        const file=logoInput.files&&logoInput.files[0];
        if(!file)return;
        if(!file.type.startsWith('image/')){alert('يرجى اختيار ملف صورة صالح.');logoInput.value='';return;}
        if(file.size>5*1024*1024){alert('حجم الصورة كبير. اختر صورة لا يتجاوز حجمها 5 ميغابايت.');logoInput.value='';return;}
        const reader=new FileReader();
        reader.onload=()=>{
          const image=new Image();
          image.onload=()=>{
            const scale=Math.min(1,360/Math.max(image.naturalWidth,image.naturalHeight));
            const canvas=document.createElement('canvas');
            canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
            canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
            canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
            logoImage.src=canvas.toDataURL('image/webp',0.82);
            syncEditorContent(editor);
            const preview=document.getElementById('petition-live-preview');
            if(preview&&!preview.hidden){const frame=preview.querySelector('.petition-a4-preview-frame');if(frame){fitPetitionPreview(frame,preview,true);}}
          };
          image.onerror=()=>alert('تعذر قراءة الصورة. جرّب صورة أخرى.');
          image.src=String(reader.result);
        };
        reader.onerror=()=>alert('تعذر تحميل الصورة.');
        reader.readAsDataURL(file);
        logoInput.value='';
      });
    }
    let dotPressTimer=null,dotPressStart=null;
    const clearDotPress=()=>{if(dotPressTimer!==null){clearTimeout(dotPressTimer);dotPressTimer=null;}};
    const selectDottedPlaceholder=(x,y)=>{
      let caret=null;
      if(document.caretPositionFromPoint){
        const point=document.caretPositionFromPoint(x,y);
        if(point)caret={node:point.offsetNode,offset:point.offset};
      }else if(document.caretRangeFromPoint){
        const point=document.caretRangeFromPoint(x,y);
        if(point)caret={node:point.startContainer,offset:point.startOffset};
      }
      if(!caret||caret.node.nodeType!==Node.TEXT_NODE||!editor.contains(caret.node))return;
      const text=caret.node.nodeValue||'';
      const pattern=/[.．…]{4,}/g;
      let match;
      while((match=pattern.exec(text))){
        const end=match.index+match[0].length;
        if(caret.offset>=match.index&&caret.offset<=end){
          const range=document.createRange();
          range.setStart(caret.node,match.index);
          range.setEnd(caret.node,end);
          const selection=window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }
      }
    };
    editor.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse'&&event.button!==0)return;
      clearDotPress();
      dotPressStart={x:event.clientX,y:event.clientY};
      const x=event.clientX,y=event.clientY;
      dotPressTimer=setTimeout(()=>{selectDottedPlaceholder(x,y);dotPressTimer=null;},500);
    });
    editor.addEventListener('pointermove',event=>{
      if(!dotPressStart)return;
      if(Math.abs(event.clientX-dotPressStart.x)>10||Math.abs(event.clientY-dotPressStart.y)>10)clearDotPress();
    });
    ['pointerup','pointercancel','pointerleave'].forEach(type=>editor.addEventListener(type,()=>{clearDotPress();dotPressStart=null;}));
    document.getElementById('petition-editor-back').onclick=()=>{
      const hasUnsavedChanges=editor.innerHTML!==savedEditorHtml;
      syncEditorContent(editor);
      if(hasUnsavedChanges){
        const leave=window.confirm('تنبيه: الرجوع الآن سيؤدي إلى فقدان التعديلات التي لم تحفظها كنسخة عمل. هل تريد الرجوع إلى معاينة العريضة؟');
        if(!leave)return;
        state.editedBody=state.savedBody??t.body;
        state.editedLetterhead=state.savedLetterhead||'';
      }
      state.mode='read';
      renderDocument();
    };
    document.getElementById('petition-brand-toggle').onclick=()=>{syncEditorContent(editor);state.branded=!state.branded;renderEditor();};
    document.getElementById('petition-editor-cancel').onclick=()=>{state.editedBody=state.savedBody??t.body;state.editedLetterhead=state.savedLetterhead||'';renderDocument();};
    document.getElementById('petition-editor-save').onclick=()=>{if(saveDraft(editor)){savedEditorHtml=editor.innerHTML;state.editorSavedHtml=savedEditorHtml;}};
    document.getElementById('petition-editor-restore').onclick=()=>{
      if(!window.confirm('هل تريد استعادة النص الأصلي للعريضة؟ ستُحذف نسخة العمل المحفوظة لهذا النموذج.'))return;
      state.editedBody=plainTextToEditor(t.body);
      state.savedBody=state.editedBody;
      state.editedLetterhead='';
      state.savedLetterhead='';
      try{
        const drafts=readDrafts();
        delete drafts[t.uid];
        localStorage.setItem('mizan-petition-drafts',JSON.stringify(drafts));
      }catch(e){
        alert('تعذّر حذف نسخة العمل المحفوظة. حاول مرة أخرى.');
        return;
      }
      renderEditor();
    };
    document.getElementById('petition-editor-preview').onclick=()=>{
      syncEditorContent(editor);
      const preview=document.getElementById('petition-live-preview');
      const panel=document.querySelector('.petition-editor-panel');
      const button=document.getElementById('petition-editor-preview');
      const showing=preview&&!preview.hidden;
      if(preview){
        const frame=preview.querySelector('.petition-a4-preview-frame');
        if(!showing){
          preview.hidden=false;
          if(frame){fitPetitionPreview(frame,preview,true);}
        }else{
          preview.hidden=true;
        }
      }
      if(panel)panel.hidden=!showing;
      if(button)button.innerHTML=showing?'<i class="fas fa-eye"></i> معاينة':'<i class="fas fa-pen"></i> متابعة التعديل';
      if(showing)editor.focus();
    };
    document.getElementById('petition-editor-print').onclick=()=>{syncEditorContent(editor);printPetition();};
    document.getElementById('petition-editor-word').onclick=()=>{syncEditorContent(editor);exportWord();};
    let savedEditorRange=null;
    const rememberEditorSelection=()=>{
      const selection=window.getSelection();
      if(selection&&selection.rangeCount&&editor.contains(selection.anchorNode))savedEditorRange=selection.getRangeAt(0).cloneRange();
    };
    editor.addEventListener('keyup',rememberEditorSelection);
    editor.addEventListener('mouseup',rememberEditorSelection);
    editor.addEventListener('input',rememberEditorSelection);
    document.addEventListener('selectionchange',rememberEditorSelection);
    const restoreEditorSelection=()=>{
      if(!savedEditorRange||!editor.contains(savedEditorRange.commonAncestorContainer))return false;
      const selection=window.getSelection();selection.removeAllRanges();selection.addRange(savedEditorRange);return true;
    };
    const applyFontSize=size=>{
      if(!restoreEditorSelection())return;
      const selection=window.getSelection(),range=selection.getRangeAt(0);
      let target=range.commonAncestorContainer;
      if(target.nodeType===Node.TEXT_NODE)target=target.parentElement;
      if(!target||!editor.contains(target))return;
      if(range.collapsed){
        const block=target.closest('.petition-head-right')||target.closest('p,li,h1,h2,h3,h4,h5,h6,div')||target;
        block.style.fontSize=size+'px';
      }else{
        const span=document.createElement('span');span.style.fontSize=size+'px';
        try{span.appendChild(range.extractContents());range.insertNode(span);const next=document.createRange();next.selectNodeContents(span);selection.removeAllRanges();selection.addRange(next);savedEditorRange=next.cloneRange();}catch(e){return;}
      }
      syncEditorContent(editor);
    };
    const fontSizeSelect=document.getElementById('petition-font-size');
    if(fontSizeSelect){
      fontSizeSelect.addEventListener('pointerdown',rememberEditorSelection);
      fontSizeSelect.addEventListener('mousedown',rememberEditorSelection);
      fontSizeSelect.addEventListener('touchstart',rememberEditorSelection,{passive:true});
      fontSizeSelect.addEventListener('change',()=>{
        const size=Number(fontSizeSelect.value);
        if(size>=8&&size<=72)applyFontSize(size);
        // Restore the text selection without immediately stealing focus from the
        // native mobile select popup; return focus to the editor after its UI closes.
        setTimeout(()=>{
          editor.focus({preventScroll:true});
          restoreEditorSelection();
        },120);
      });
    }
    const changeIndent=step=>{
      if(!restoreEditorSelection())return;
      const selection=window.getSelection();
      if(!selection||!selection.rangeCount)return;
      let range=selection.getRangeAt(0);
      if(!editor.contains(range.startContainer))return;
      const indentText='\u00a0\u00a0\u00a0\u00a0';
      if(step>0){
        const textNode=document.createTextNode(indentText);
        range.insertNode(textNode);
        range=document.createRange();
        range.setStart(textNode,indentText.length);
        range.collapse(true);
      }else{
        let node=range.startContainer,offset=range.startOffset;
        if(node.nodeType!==Node.TEXT_NODE){
          const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);
          let current,last=null;
          while((current=walker.nextNode())){
            if(current===node.childNodes?.[offset-1])last=current;
            if(current.compareDocumentPosition(node)&Node.DOCUMENT_POSITION_FOLLOWING)last=current;
          }
          if(last){node=last;offset=node.nodeValue.length;}
          else return;
        }
        let remaining=4;
        while(remaining>0&&node){
          const value=node.nodeValue||'';
          let i=offset-1;
          while(i>=0&&remaining>0&&(value[i]==='\u00a0'||value[i]===' ')){i--;remaining--;}
          const removeFrom=i+1,removeCount=offset-removeFrom;
          if(removeCount>0){node.deleteData(removeFrom,removeCount);offset=removeFrom;}
          if(remaining===0)break;
          let previous=node.previousSibling;
          while(previous&&previous.nodeType!==Node.TEXT_NODE){
            if(previous.nodeType===Node.ELEMENT_NODE&&previous.lastChild){previous=previous.lastChild;while(previous&&previous.lastChild)previous=previous.lastChild;}
            else previous=previous.previousSibling;
          }
          if(!previous||previous.nodeType!==Node.TEXT_NODE)break;
          node=previous;offset=node.nodeValue.length;
        }
        range=document.createRange();
        range.setStart(node,Math.min(offset,node.nodeValue.length));
        range.collapse(true);
      }
      editor.focus();
      selection.removeAllRanges();selection.addRange(range);
      savedEditorRange=range.cloneRange();
      syncEditorContent(editor);
    };
    root.querySelectorAll('[data-indent-step]').forEach(btn=>{
      btn.addEventListener('mousedown',event=>{rememberEditorSelection();event.preventDefault();});
      btn.onclick=()=>changeIndent(Number(btn.dataset.indentStep));
    });
    root.querySelectorAll('[data-command]').forEach(btn=>{
      btn.addEventListener('mousedown',event=>event.preventDefault());
      btn.addEventListener('pointerdown',event=>{rememberEditorSelection();event.preventDefault();});
      btn.onclick=()=>{
        if(!restoreEditorSelection())return;
        editor.focus({preventScroll:true});
        if(!restoreEditorSelection())return;
        const applied=document.execCommand(btn.dataset.command,false,null);
        if(applied){
          rememberEditorSelection();
          syncEditorContent(editor);
        }
      };
    });
  }
  function plainTextToEditor(text){
    const value=String(text??'');
    const html=/<\/?(?:p|br|strong|b|em|i|u|ul|ol|li|div|h[1-6])\b/i.test(value)
      ?value
      :esc(value).split('\n').map(line=>line?'<p>'+line+'</p>':'<p><br></p>').join('');
    return indentPetitionSignature(html);
  }
  function indentPetitionSignature(html){
    const doc=new DOMParser().parseFromString(String(html??''),'text/html');
    const paragraphs=Array.from(doc.body.querySelectorAll('p'));
    const thanksIndex=paragraphs.findIndex(p=>/مع\s+الشكر\s+والتقدير/.test(p.textContent||''));
    if(thanksIndex<0)return doc.body.innerHTML;
    let found=false;
    for(let i=thanksIndex+1;i<paragraphs.length;i++){
      const p=paragraphs[i];
      const text=(p.textContent||'').trim();
      if(/^(المرفقات|المرفقـات)\s*[:：]?/.test(text))break;
      if(!text)continue;
      if(/^(المدعي|المدعية|وكيله\s+المحامي|وكيلها\s+المحامي|بموجب\s+الوكالة\s+المرفقة)/.test(text)){
        p.removeAttribute('dir');
        p.style.removeProperty('text-align');
        p.style.removeProperty('direction');
        p.style.removeProperty('width');
        p.style.removeProperty('display');
        p.style.whiteSpace='pre-wrap';
        if(p.dataset.petitionIndent==='true'){
          const first=p.firstChild;
          if(first&&first.nodeType===Node.TEXT_NODE){
            first.textContent=first.textContent.replace(/^[ \u00a0]+/,'');
            if(!first.textContent)p.removeChild(first);
          }
        }
        p.insertBefore(doc.createTextNode('                                                                                               '),p.firstChild);
        p.dataset.petitionIndent='true';
        found=true;
      }else if(found)break;
    }
    return doc.body.innerHTML;
  }
  function syncEditorContent(editor){
    if(!editor)return;
    const doc=new DOMParser().parseFromString(editor.innerHTML,'text/html');
    const header=doc.body.querySelector('.petition-letterhead');
    state.editedLetterhead=header?header.outerHTML:'';
    const body=doc.body.querySelector('.petition-doc-body');
    state.editedBody=body?body.innerHTML:editor.innerHTML;
  }
  function readDrafts(){
    try{return JSON.parse(localStorage.getItem('mizan-petition-drafts')||'{}');}
    catch(e){return {};}
  }
  function saveDraft(editor){
    syncEditorContent(editor);
    try{
      const drafts=readDrafts();
      drafts[state.template.uid]={name:state.template.name,body:state.editedBody,letterhead:state.editedLetterhead,branded:state.branded===true,updatedAt:new Date().toISOString()};
      localStorage.setItem('mizan-petition-drafts',JSON.stringify(drafts));
      state.savedBody=state.editedBody;
      state.savedLetterhead=state.editedLetterhead;
      const button=document.getElementById('petition-editor-save');
      if(button){button.innerHTML='<i class="fas fa-check"></i> تم حفظ نسخة العمل';setTimeout(()=>{if(button.isConnected)button.textContent='حفظ نسخة العمل';},1800);}
      return true;
    }catch(e){alert('تعذر حفظ نسخة العمل على هذا الجهاز. انسخ النص أو صدّره إلى Word.');return false;}
  }
  function syncPreview(){
    const editor=document.getElementById('petition-rich-editor');
    if(editor)state.editedBody=editor.innerHTML;
  }
  function buildPrintHtml(){
    const t=state.template;if(!t)return '';
    const body=plainTextToEditor(state.editedBody??t.body);
    const branded=state.branded;
    const header=branded?(state.editedLetterhead||letterheadHtml()):'';
    const css='@font-face{font-family:"AMoshref Thulth";src:url("https://cdn.jsdelivr.net/gh/mokhtarbsaid/rare-arabic-fonts@415c96ea2ee5bd29f46691460f944c0cc9676e1b/amoshref-thulth/amoshref-thulth.ttf") format("truetype");font-style:normal;font-weight:400;font-display:swap}@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff;color:#20252b;font-family:Arial,Tahoma,sans-serif;direction:rtl}.petition-a4{position:relative;width:210mm;height:297mm;min-height:297mm;margin:0 auto;padding:'+(branded?'12mm 14mm 17mm':'20mm 17mm')+';background:#fffdf8;color:#20252b;direction:rtl;border:1.4mm solid #172b45;outline:.55mm solid #c59b4d;outline-offset:-3mm;overflow:hidden;break-after:auto;page-break-after:auto}.petition-a4:before{content:"";position:absolute;inset:4.5mm;border:.35mm solid #c59b4d;pointer-events:none}.petition-a4:after{content:"⚖";position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);font-size:105mm;color:rgba(197,155,77,.045);pointer-events:none}.petition-letterhead{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) 17mm minmax(0,1fr);align-items:center;gap:3mm;padding:1mm 1mm 4mm;margin:0 0 4mm;border-bottom:.7mm solid #172b45;direction:ltr}.petition-head-side{text-align:center;color:#172b45;line-height:1.25;min-width:0;direction:rtl;unicode-bidi:plaintext}.petition-head-side strong,.petition-head-side b{direction:rtl;unicode-bidi:plaintext}.petition-head-side strong{display:block;font-size:16px}.petition-head-side b{display:block;margin-top:1.5mm;font-size:12px}.petition-head-right,.petition-head-right *{font-family:"AMoshref Thulth",Tahoma,serif;font-synthesis:weight}.petition-head-right{font-size:17px;font-weight:400;white-space:nowrap;overflow:visible}.petition-bar-logo{width:17mm;height:22mm;margin:auto}.petition-bar-logo img{width:100%;height:100%;object-fit:contain}.petition-doc-body{position:relative;z-index:1;font-size:20px;line-height:1.5;text-align:justify;overflow-wrap:break-word;word-spacing:0}.petition-doc-body p{margin:0;line-height:1.5;orphans:2;widows:2;white-space:pre-wrap}.petition-doc-body li{line-height:1.5}.petition-doc-body u,.petition-doc-body [style*="text-decoration: underline"],.petition-doc-body [style*="text-decoration-line: underline"],.petition-doc-body [style*="underline"]{text-underline-offset:.35em!important;text-decoration-thickness:1px}.petition-doc-body ul,.petition-doc-body ol{padding-right:1.6em}.petition-document-title{font-size:21px;font-weight:bold}.petition-signature{margin-top:12mm;position:relative;z-index:1}';
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(t.name)+'</title><style>'+css+'</style></head><body><article class="petition-a4 '+(branded?'is-branded':'')+'">'+header+'<div class="petition-doc-body">'+body+'</div></article></body></html>';
  }
  function fitPetitionPreview(frame,container,refresh=false){
    if(!frame||!container)return;
    const applyPageScale=()=>{
      const pageWidth=210*96/25.4;
      const availableWidth=Math.max(1,container.clientWidth);
      const scale=Math.min(1,availableWidth/pageWidth);
      const pageHeight=pageWidth*(297/210);
      frame.style.display='block';
      frame.style.width='100%';
      frame.style.height=(pageHeight*scale)+'px';
      frame.style.border='0';
      frame.style.margin='0';
      const doc=frame.contentDocument;
      if(!doc)return;
      const page=doc.querySelector('.petition-a4');
      if(!page)return;
      doc.documentElement.style.width='210mm';
      doc.documentElement.style.minWidth='210mm';
      doc.documentElement.style.direction='ltr';
      doc.documentElement.style.margin='0';
      doc.documentElement.style.padding='0';
      doc.documentElement.style.overflow='hidden';
      doc.body.style.width='210mm';
      doc.body.style.minWidth='210mm';
      doc.body.style.direction='ltr';
      doc.body.style.margin='0';
      doc.body.style.padding='0';
      doc.body.style.overflow='hidden';
      page.style.width='210mm';
      page.style.minHeight='297mm';
      page.style.margin='0';
      page.style.direction='rtl';
      page.style.transformOrigin='top left';
      page.style.transform='scale('+scale+')';
    };
    if(refresh||!frame.srcdoc){
      const html=buildPrintHtml();
      if(!html)return;
      frame.onload=applyPageScale;
      frame.srcdoc=html;
    }else{
      applyPageScale();
    }
    if(!container.dataset.fitBound){
      window.addEventListener('resize',applyPageScale,{passive:true});
      container.dataset.fitBound='true';
    }
  }
  function printPetition(){
    const html=buildPrintHtml();if(!html)return;
    const w=window.open('','_blank');
    if(!w)return alert('اسمح بالنوافذ المنبثقة من المتصفح ثم أعد المحاولة.');
    w.document.open();w.document.write(html);w.document.close();
    const print=()=>{w.focus();w.print();};
    if(w.document.readyState==='complete')setTimeout(print,100);else w.onload=()=>setTimeout(print,100);
  }
  function exportWord(){
    const html=buildPrintHtml();if(!html)return;
    const blob=new Blob(['\ufeff',html],{type:'application/msword'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download=(state.template.name||'عريضة').replace(/[\\/:*?"<>|]/g,'_')+'.doc';a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  async function restoreHistoryState(historyState={}){
    const level=historyState.petitionLevel||'categories';
    try{
      const auth=window.publicAuth;
      if(!auth?.user){renderHome();auth?.requireAuth?.(()=>open(false));return;}
      await auth.whenFirestoreReady?.();
      const [access]=await Promise.all([loadPetitionAccess(),loadCategories()]);
      if(!access.enabled){renderHome();renderAccessGate(access);return;}
      if(level==='legal-tables'){state.template=null;state.categoryId=null;renderHome();renderLegalTables();return;}
      if(level==='legal-table-editor'&&historyState.legalTableId){const table=readLegalTables().find(item=>item.id===historyState.legalTableId);if(table){state.template=null;state.categoryId=null;renderHome();openLegalTableEditor(null,table.id,false);return;}state.template=null;state.categoryId=null;renderHome();renderLegalTables();return;}
      if(level==='document'&&historyState.categoryId&&historyState.templateUid){
        state.categoryId=historyState.categoryId;
        await loadTemplates(state.categoryId);
        await start(historyState.templateUid,false);
        return;
      }
      if(level==='category'&&historyState.categoryId){
        state.template=null;
        await openCategory(historyState.categoryId,false);
        return;
      }
      state.template=null;
      state.categoryId=null;
      renderHome();
      renderCategories();
    }catch(e){
      state.template=null;
      state.categoryId=null;
      renderHome();
      renderLoadError('تعذر استعادة قسم العرائض. حاول مرة أخرى.');
    }
  }
  function handleEditorHistoryBack(){
    if(state.mode!=='edit'||!state.template)return false;
    const editor=document.getElementById('petition-rich-editor');
    const hasUnsavedChanges=!!editor&&editor.innerHTML!==(state.editorSavedHtml??'');
    if(hasUnsavedChanges){
      const leave=window.confirm('تنبيه: الرجوع الآن سيؤدي إلى فقدان التعديلات التي لم تحفظها كنسخة عمل. هل تريد الخروج من محرر العريضة؟');
      if(!leave){
        // popstate has already moved one entry back; restore the editor entry so
        // Android's physical Back button leaves the user in the same editor.
        history.pushState({
          view:'petitions',
          petitionLevel:'document',
          categoryId:state.categoryId,
          templateUid:state.template.uid,
          bookId:null,
          chapter:null
        },'',window.location.href);
        return true;
      }
      state.editedBody=state.savedBody??state.template.body;
      state.editedLetterhead=state.savedLetterhead||'';
    }
    state.mode='read';
    return false;
  }
  function getCurrentDocumentCategory(){return state.template&&state.categoryId?state.categoryId:null;}
  function backToCategoryFromDocument(){
    const categoryId=getCurrentDocumentCategory();
    if(!categoryId)return false;
    state.template=null;
    state.mode='read';
    const category=state.categories.find(c=>c.id===categoryId);
    const items=state.categoryTemplates[categoryId];
    renderHome();
    if(category&&items)renderCards('',category,items);
    else openCategory(categoryId,false);
    return true;
  }
  Object.assign(window.petitions,{open,openLegalTables,renderHome,loadTemplates,loadCategories,restoreHistoryState,handleEditorHistoryBack,getCurrentDocumentCategory,backToCategoryFromDocument,loadSearchIndex:loadPetitionIndex});
})();
