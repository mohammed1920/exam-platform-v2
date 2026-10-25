/* Mizan — Smart Legal Petitions */
(function(){
  'use strict';
  const state={templates:[],template:null,branded:false,lawyer:{},templatesLoaded:false,brandingLoaded:false,categories:[],categoriesLoaded:false,categoryTemplates:{},categoryId:null,mode:'read',editedBody:'',savedBody:'',editedLetterhead:'',savedLetterhead:''};
  window.petitions = window.petitions || {};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const dataCache=new Map();
  function dataUrl(path){const base=location.pathname.includes('/exam-platform-v2')?'/exam-platform-v2':'';return base+'/'+path;}
  async function fetchJson(path){if(dataCache.has(path))return dataCache.get(path);const pending=fetch(dataUrl(path),{cache:'default'}).then(r=>{if(!r.ok)throw new Error('تعذر تحميل '+path);return r.json();});dataCache.set(path,pending);try{return await pending;}catch(e){dataCache.delete(path);throw e;}}
  async function loadCategories(){if(state.categoriesLoaded)return state.categories;state.categories=await fetchJson('data/petitions/categories.json');state.categoriesLoaded=true;return state.categories;}
  async function loadTemplates(categoryId){if(!categoryId){await loadCategories();state.templates=[];state.templatesLoaded=true;return state.templates;}if(state.categoryTemplates?.[categoryId])return state.categoryTemplates[categoryId];const category=state.categories?.find(c=>c.id===categoryId);if(!category)return [];const items=await fetchJson(category.manifest);state.categoryTemplates=state.categoryTemplates||{};state.categoryTemplates[categoryId]=items;state.templates=items;state.templatesLoaded=true;return items;}
  async function loadDocument(uid){const cached=dataCache.get('document:'+uid);if(cached)return cached;const meta=(state.categoryTemplates&&Object.values(state.categoryTemplates).flat().find(t=>t.uid===uid))||state.templates.find(t=>t.uid===uid);if(!meta)throw new Error('لم يتم العثور على العريضة');const pending=fetchJson(meta.document);dataCache.set('document:'+uid,pending);try{return await pending;}catch(e){dataCache.delete('document:'+uid);throw e;}}
  async function loadLawyerBranding(){
    state.lawyer={};
    const auth=window.publicAuth,user=auth&&auth.user,db=auth&&auth.firestore;
    if(!user||!db)return;
    try{
      const snap=await db.collection('lawyerApplications').where('applicantUid','==',user.uid).get();
      const approved=snap.docs.map(d=>({id:d.id,...d.data()})).find(x=>String(x.status||'').toLowerCase()==='approved');
      if(!approved)return;
      const profile=await db.collection('lawyerProfiles').doc(approved.id).get();
      if(profile.exists)state.lawyer=profile.data()||{};
      else state.lawyer=approved;
    }catch(e){console.warn('تعذر تحميل بيانات المحامي للعريضة',e);}
  }
  async function open(){
    window.app.navigateTo('petitions');
    state.template=null;state.categoryId=null;
    renderHome();
    loadLawyerBranding().catch(()=>{});
    try{await loadCategories();renderCategories();}catch(e){renderLoadError('تعذر تحميل أقسام العرائض. تحقق من الاتصال ثم أعد المحاولة.');}
  }
  function renderHome(){
    const root=document.getElementById('petitions-section');if(!root)return;
    root.innerHTML='<div class="petitions-shell"><button class="back-btn" id="petitions-back"><i class="fas fa-arrow-right"></i> العودة للرئيسية</button><div class="petitions-hero"><span>ميزان • العرائض والطلبات</span><h2>أنشئ عريضتك القانونية بطريقة منظمة</h2><p>اختر العريضة، اقرأها، ثم عدّل نصها بحرية واحفظها أو اطبعها.</p></div><div id="petition-browse"></div></div>';
    document.getElementById('petitions-back').onclick=()=>window.app.navigateTo('home');
  }
  function renderLoadError(message){const root=document.getElementById('petition-browse');if(root)root.innerHTML='<div class="petition-empty">'+esc(message)+' <button type="button" id="petition-retry">إعادة المحاولة</button></div>';const b=document.getElementById('petition-retry');if(b)b.onclick=()=>open();}
  function renderCategories(){
    const root=document.getElementById('petition-browse');if(!root)return;
    root.innerHTML='<div class="petition-category-grid">'+state.categories.map(c=>'<button class="petition-category-card" data-category="'+esc(c.id)+'" aria-label="فتح قسم '+esc(c.name)+'"><span class="petition-category-icon"><i class="'+esc(c.icon)+'" aria-hidden="true"></i></span><span class="petition-category-copy"><strong>'+esc(c.name)+'</strong><small>'+esc(c.description)+'</small></span></button>').join('')+'</div>';
    root.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>openCategory(b.dataset.category));
  }
  async function openCategory(categoryId){
    const category=state.categories.find(c=>c.id===categoryId);if(!category)return;
    state.categoryId=categoryId;state.templates=[];
    const root=document.getElementById('petition-browse');if(!root)return;
    root.innerHTML='<div class="petition-loading">جاري تحميل نماذج القسم...</div>';
    try{const items=await loadTemplates(categoryId);if(state.categoryId!==categoryId)return;renderCards('',category,items);}
    catch(e){renderLoadError('تعذر تحميل نماذج هذا القسم. حاول مرة أخرى.');}
  }
  function renderCards(query,category,items){
    const root=document.getElementById('petition-browse');if(!root)return;
    const q=String(query||'').trim().toLowerCase();const source=items||state.templates;
    const filtered=source.filter(t=>!q||[t.name,t.category,t.description].join(' ').toLowerCase().includes(q));
    root.innerHTML='<button class="back-btn petition-category-back" id="petition-category-back"><i class="fas fa-arrow-right"></i> الأقسام</button><div class="petition-category-heading"><span>'+esc(category.name)+'</span><h2>النماذج المتاحة</h2><p>يُحمّل نص النموذج الكامل عند فتحه فقط.</p></div><div class="petition-tools"><label><i class="fas fa-search"></i><input id="petition-search" placeholder="ابحث ضمن نماذج هذا القسم..."></label><span id="petition-count">'+filtered.length+' نموذج</span></div><div id="petition-template-grid" class="petition-template-grid"></div>';
    document.getElementById('petition-category-back').onclick=()=>{state.categoryId=null;renderCategories();};
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
  async function start(uid){
    const meta=Object.values(state.categoryTemplates).flat().find(t=>t.uid===uid)||state.templates.find(t=>t.uid===uid);
    if(!meta)return;
    const root=document.getElementById('petitions-section');if(!root)return;
    root.innerHTML='<div class="petitions-shell"><button class="back-btn" id="petition-loading-back"><i class="fas fa-arrow-right"></i> العودة للنماذج</button><div class="petition-loading">جاري تحميل العريضة...</div></div>';
    document.getElementById('petition-loading-back').onclick=()=>openCategory(state.categoryId);
    try{
      state.template=await loadDocument(uid);
      if(state.categoryId===null)return;
      state.branded=false;
      const drafts=readDrafts();
      state.editedBody=plainTextToEditor(drafts[uid]?.body??state.template.body);
      state.savedBody=state.editedBody;
      state.editedLetterhead=drafts[uid]?.letterhead||'';
      state.savedLetterhead=state.editedLetterhead;
      state.mode='read';
      renderDocument();
    }catch(e){
      root.innerHTML='<div class="petitions-shell"><button class="back-btn" id="petition-load-fail-back">العودة للنماذج</button><div class="petition-empty">تعذر تحميل العريضة. حاول مرة أخرى.</div></div>';
      document.getElementById('petition-load-fail-back').onclick=()=>openCategory(state.categoryId);
    }
  }
  function documentHeader(){
    const t=state.template;
    return '<div class="petition-builder-head"><div><span>'+esc(t.category||'نموذج قانوني')+'</span><h2>'+esc(t.name)+'</h2><p>'+esc(t.description||'')+'</p></div></div>';
  }
  function documentBodyHtml(){
    return plainTextToEditor(state.editedBody??'');
  }
  function letterheadHtml(){
    if(!state.branded)return '';
    const logoBase=location.pathname.includes('/exam-platform-v2')?'/exam-platform-v2/':'/';
    const imgUrl=logoBase+'assets/iraqi-bar-association-modern.svg';
    const name=state.lawyer.name||(window.publicAuth?.user?.displayName||'');
    const office=state.lawyer.office||'',phone=state.lawyer.phone||'';
    return '<header class="petition-letterhead"><div class="petition-head-side petition-head-left"><strong>جمهورية العراق</strong><small>The Republic of Iraq</small><b>نقابة المحامين العراقيين</b><small>Iraqi Bar Association</small></div><div class="petition-bar-logo"><img src="'+imgUrl+'" alt="شعار نقابة المحامين العراقيين"></div><div class="petition-head-side petition-head-right"><small>المحامي</small><strong>'+esc(name||'اسم المحامي')+'</strong><b>محامٍ لدى المحاكم العراقية</b>'+(office?'<em>'+esc(office)+'</em>':'')+(phone?'<small>'+esc(phone)+'</small>':'')+'</div></header>';
  }
  function brandingToggleHtml(){
    return '<button type="button" class="petition-brand-toggle" id="petition-brand-toggle" aria-pressed="'+String(state.branded)+'"><i class="fas fa-scale-balanced"></i> '+(state.branded?'إخفاء ترويسة المحامي':'إظهار تصميم المحامي')+'</button>';
  }
  function renderDocument(){
    const root=document.getElementById('petitions-section'),t=state.template;
    if(!root||!t)return;
    root.innerHTML='<div class="petitions-shell petition-document-shell"><button class="back-btn" id="petition-document-back"><i class="fas fa-arrow-right"></i> النماذج</button>'+documentHeader()+brandingToggleHtml()+
      '<article class="petition-a4 '+(state.branded?'is-branded':'')+'" aria-label="نص العريضة">'+letterheadHtml()+'<div class="petition-doc-body" id="petition-document-body">'+documentBodyHtml()+'</div></article>'+
      '<div class="petition-document-actions"><button type="button" class="petition-primary" id="petition-edit"><i class="fas fa-pen-to-square"></i> تعديل العريضة</button></div></div>';
    document.getElementById('petition-document-back').onclick=()=>openCategory(state.categoryId);
    document.getElementById('petition-brand-toggle').onclick=()=>{state.branded=!state.branded;renderDocument();};
    document.getElementById('petition-edit').onclick=()=>{state.mode='edit';renderEditor();};
  }
  function renderEditor(){
    const root=document.getElementById('petitions-section'),t=state.template;
    if(!root||!t)return;
    root.innerHTML='<div class="petitions-shell petition-editor-shell"><button class="back-btn" id="petition-editor-back"><i class="fas fa-arrow-right"></i> العودة للقراءة</button>'+documentHeader()+
      '<div class="petition-editor-panel"><div class="petition-editor-toolbar" role="toolbar" aria-label="أدوات تنسيق العريضة">'+
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
      brandingToggleHtml()+
      '</div><article class="petition-a4 petition-rich-editor '+(state.branded?'is-branded':'')+'" id="petition-rich-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-label="تحرير العريضة كاملة" dir="rtl">'+(state.branded?(state.editedLetterhead||letterheadHtml()):'')+'<div class="petition-doc-body">'+plainTextToEditor(state.editedBody)+'</div></article></div>'+
      '<article class="petition-a4 petition-live-preview '+(state.branded?'is-branded':'')+'" id="petition-live-preview" aria-label="معاينة العريضة" hidden>'+(state.branded?(state.editedLetterhead||letterheadHtml()):'')+'<div class="petition-doc-body">'+plainTextToEditor(state.editedBody)+'</div></article>'+
      '<div class="petition-document-actions petition-editor-actions" role="group" aria-label="إجراءات العريضة"><button type="button" class="petition-secondary" id="petition-editor-cancel">إلغاء التعديلات</button><button type="button" class="petition-secondary" id="petition-editor-save">حفظ نسخة العمل</button><button type="button" class="petition-secondary" id="petition-editor-restore"><i class="fas fa-rotate-left"></i> استعادة النص الأصلي</button><button type="button" class="petition-primary" id="petition-editor-preview"><i class="fas fa-eye"></i> معاينة</button><button type="button" class="petition-primary" id="petition-editor-print"><i class="fas fa-print"></i> طباعة / حفظ PDF</button><button type="button" class="petition-secondary" id="petition-editor-word">تصدير Word</button></div></div>';
    const editor=document.getElementById('petition-rich-editor');
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
    document.getElementById('petition-editor-back').onclick=()=>{syncEditorContent(editor);renderDocument();};
    document.getElementById('petition-brand-toggle').onclick=()=>{syncEditorContent(editor);state.branded=!state.branded;renderEditor();};
    document.getElementById('petition-editor-cancel').onclick=()=>{state.editedBody=state.savedBody??t.body;renderDocument();};
    document.getElementById('petition-editor-save').onclick=()=>saveDraft(editor);
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
      if(preview){preview.innerHTML=(state.branded?state.editedLetterhead:'')+'<div class="petition-doc-body">'+plainTextToEditor(state.editedBody)+'</div>';preview.classList.toggle('is-branded',state.branded);preview.hidden=showing;}
      if(panel)panel.hidden=!showing;
      if(button)button.innerHTML=showing?'<i class="fas fa-eye"></i> معاينة':'<i class="fas fa-pen"></i> متابعة التعديل';
      if(showing)editor.focus();
    };
    document.getElementById('petition-editor-print').onclick=()=>{syncEditorContent(editor);printPetition();};
    document.getElementById('petition-editor-word').onclick=()=>{syncEditorContent(editor);exportWord();};
    root.querySelectorAll('[data-command]').forEach(btn=>btn.onclick=()=>{
      editor.focus();
      document.execCommand(btn.dataset.command,false,null);
    });
  }
  function plainTextToEditor(text){
    const value=String(text??'');
    if(/<\/?(?:p|br|strong|b|em|i|u|ul|ol|li|div|h[1-6])\b/i.test(value))return value;
    return esc(value).split('\n').map(line=>line?'<p>'+line+'</p>':'<p><br></p>').join('');
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
    state.savedBody=state.editedBody;
    state.savedLetterhead=state.editedLetterhead;
    try{
      const drafts=readDrafts();
      drafts[state.template.uid]={name:state.template.name,body:state.editedBody,letterhead:state.editedLetterhead,updatedAt:new Date().toISOString()};
      localStorage.setItem('mizan-petition-drafts',JSON.stringify(drafts));
      const button=document.getElementById('petition-editor-save');
      if(button){button.innerHTML='<i class="fas fa-check"></i> تم حفظ نسخة العمل';setTimeout(()=>{if(button.isConnected)button.textContent='حفظ نسخة العمل';},1800);}
    }catch(e){alert('تعذر حفظ نسخة العمل على هذا الجهاز. انسخ النص أو صدّره إلى Word.');}
  }
  function syncPreview(){
    const editor=document.getElementById('petition-rich-editor');
    if(editor)state.editedBody=editor.innerHTML;
  }
  function buildPrintHtml(){
    const t=state.template;if(!t)return '';
    const body=plainTextToEditor(state.editedBody??t.body);
    const branded=state.branded;
    const header=state.editedLetterhead||letterheadHtml();
    const css='@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff;color:#20252b;font-family:Arial,Tahoma,sans-serif;direction:rtl}.petition-a4{position:relative;width:210mm;min-height:297mm;margin:0 auto;padding:'+(branded?'12mm 14mm 17mm':'20mm 17mm')+';background:#fffdf8;color:#20252b;direction:rtl;border:1.4mm solid #172b45;outline:.55mm solid #c59b4d;outline-offset:-3mm;overflow:visible;break-after:page}.petition-a4:before{content:"";position:absolute;inset:4.5mm;border:.35mm solid #c59b4d;pointer-events:none}.petition-a4:after{content:"⚖";position:absolute;left:50%;top:54%;transform:translate(-50%,-50%);font-size:105mm;color:rgba(197,155,77,.045);pointer-events:none}.petition-letterhead{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) 34mm minmax(0,1fr);align-items:center;gap:7mm;padding:1mm 2mm 7mm;margin:0 0 7mm;border-bottom:.7mm solid #172b45}.petition-head-side{text-align:center;color:#172b45;line-height:1.25}.petition-head-side strong{display:block;font-size:18px}.petition-head-side small{display:block;font-size:8.5px;color:#5d6875}.petition-head-side b{display:block;margin-top:2mm;font-size:12px}.petition-head-right strong{font-size:23px}.petition-bar-logo{width:34mm;height:46mm;margin:auto}.petition-bar-logo img{width:100%;height:100%;object-fit:contain}.petition-doc-body{position:relative;z-index:1;font-size:13.6px;line-height:2.05;text-align:justify;overflow-wrap:anywhere}.petition-doc-body p{margin:0 0 .5em}.petition-doc-body ul,.petition-doc-body ol{padding-right:1.6em}.petition-document-title{font-size:16px;font-weight:bold}.petition-signature{margin-top:12mm;position:relative;z-index:1}';
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(t.name)+'</title><style>'+css+'</style></head><body><article class="petition-a4 '+(branded?'is-branded':'')+'">'+header+'<div class="petition-doc-body">'+body+'</div></article></body></html>';
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
  Object.assign(window.petitions,{open,renderHome,loadTemplates,loadCategories,loadLawyerBranding});
})();