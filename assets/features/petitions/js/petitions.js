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
    state.template=null;state.categoryId=null;
    renderHome();
    loadLawyerBranding().catch(()=>{});
    try{await loadCategories();renderCategories();}catch(e){renderLoadError('تعذر تحميل أقسام العرائض. تحقق من الاتصال ثم أعد المحاولة.');}
  }
  function renderHome(){
    const root=document.getElementById('petitions-section');if(!root)return;
    root.innerHTML='<div class="petitions-shell"><div class="petitions-hero"><span>ميزان • العرائض والطلبات</span><h2>أنشئ عريضتك القانونية بطريقة منظمة</h2><p>اختر العريضة، اقرأها، ثم عدّل نصها بحرية واحفظها أو اطبعها.</p></div><div id="petition-browse"></div></div>';

  }
  function renderLoadError(message){const root=document.getElementById('petition-browse');if(root)root.innerHTML='<div class="petition-empty">'+esc(message)+' <button type="button" id="petition-retry">إعادة المحاولة</button></div>';const b=document.getElementById('petition-retry');if(b)b.onclick=()=>open();}
  function renderCategories(){
    const root=document.getElementById('petition-browse');if(!root)return;
    root.innerHTML='<div class="petition-category-grid">'+state.categories.map(c=>'<button class="petition-category-card" data-category="'+esc(c.id)+'" aria-label="فتح قسم '+esc(c.name)+'"><span class="petition-category-icon"><i class="'+esc(c.icon)+'" aria-hidden="true"></i></span><span class="petition-category-copy"><strong>'+esc(c.name)+'</strong><small>'+esc(c.description)+'</small></span></button>').join('')+'</div>';
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
    root.innerHTML='<button class="back-btn petition-category-back" id="petition-category-back"><i class="fas fa-arrow-right"></i> الأقسام</button><div class="petition-category-heading"><span>'+esc(category.name)+'</span><h2>النماذج المتاحة</h2><p>يُحمّل نص النموذج الكامل عند فتحه فقط.</p></div><div class="petition-tools"><label><i class="fas fa-search"></i><input id="petition-search" placeholder="ابحث ضمن نماذج هذا القسم..."></label><span id="petition-count">'+filtered.length+' نموذج</span></div><div id="petition-template-grid" class="petition-template-grid"></div>';
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
      state.branded=false;
      const drafts=readDrafts();
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
  function letterheadHtml(nameOverride,logoOverride){
    const logoBase=location.pathname.includes('/exam-platform-v2')?'/exam-platform-v2/':'/';
    const imgUrl=logoOverride||(logoBase+'assets/iraqi-bar-association-modern.svg');
    const name=nameOverride||(state.lawyer.name||(window.publicAuth?.user?.displayName||''));
    return '<header class="petition-letterhead"><div class="petition-head-side petition-head-left"><strong>جمهورية العراق</strong><b>نقابة المحامين العراقيين</b></div><div class="petition-bar-logo"><img src="'+esc(imgUrl)+'" alt="شعار نقابة المحامين العراقيين"></div><div class="petition-head-side petition-head-right"><strong>'+esc(name||'اسم المحامي')+'</strong></div></header>';
  }
  function normalizeLetterheadHtml(source){
    if(!source)return '';
    try{
      const doc=new DOMParser().parseFromString(String(source),'text/html');
      const header=doc.body.querySelector('.petition-letterhead');
      if(!header)return '';
      const name=header.querySelector('.petition-head-right strong')?.textContent?.trim()||'';
      const logo=header.querySelector('.petition-bar-logo img')?.getAttribute('src')||'';
      return letterheadHtml(name,logo||undefined);
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
    document.getElementById('petition-editor-back').onclick=()=>{syncEditorContent(editor);renderDocument();};
    document.getElementById('petition-brand-toggle').onclick=()=>{syncEditorContent(editor);state.branded=!state.branded;renderEditor();};
    document.getElementById('petition-editor-cancel').onclick=()=>{state.editedBody=state.savedBody??t.body;state.editedLetterhead=state.savedLetterhead||'';renderDocument();};
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
        const block=target.closest('p,li,h1,h2,h3,h4,h5,h6,div')||target;
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
      btn.onclick=()=>{
        editor.focus();
        document.execCommand(btn.dataset.command,false,null);
        syncEditorContent(editor);
      };
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
    const header=branded?(state.editedLetterhead||letterheadHtml()):'';
    const css='@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff;color:#20252b;font-family:Arial,Tahoma,sans-serif;direction:rtl}.petition-a4{position:relative;width:210mm;height:297mm;min-height:297mm;margin:0 auto;padding:'+(branded?'12mm 14mm 17mm':'20mm 17mm')+';background:#fffdf8;color:#20252b;direction:rtl;border:1.4mm solid #172b45;outline:.55mm solid #c59b4d;outline-offset:-3mm;overflow:hidden;break-after:auto;page-break-after:auto}.petition-a4:before{content:"";position:absolute;inset:4.5mm;border:.35mm solid #c59b4d;pointer-events:none}.petition-a4:after{content:"⚖";position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);font-size:105mm;color:rgba(197,155,77,.045);pointer-events:none}.petition-letterhead{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) 17mm minmax(0,1fr);align-items:center;gap:3mm;padding:1mm 1mm 4mm;margin:0 0 4mm;border-bottom:.7mm solid #172b45;direction:ltr}.petition-head-side{text-align:center;color:#172b45;line-height:1.25;min-width:0}.petition-head-side strong{display:block;font-size:16px}.petition-head-side b{display:block;margin-top:1.5mm;font-size:12px}.petition-head-right strong{font-size:17px;white-space:nowrap;overflow:visible}.petition-bar-logo{width:17mm;height:22mm;margin:auto}.petition-bar-logo img{width:100%;height:100%;object-fit:contain}.petition-doc-body{position:relative;z-index:1;font-size:20px;line-height:1.5;text-align:justify;overflow-wrap:break-word;word-spacing:0}.petition-doc-body p{margin:0;line-height:1.5;orphans:2;widows:2}.petition-doc-body li{line-height:1.5}.petition-doc-body u,.petition-doc-body [style*="text-decoration: underline"],.petition-doc-body [style*="text-decoration-line: underline"],.petition-doc-body [style*="underline"]{text-underline-offset:.28em!important;text-decoration-thickness:1px}.petition-doc-body ul,.petition-doc-body ol{padding-right:1.6em}.petition-document-title{font-size:21px;font-weight:bold}.petition-signature{margin-top:12mm;position:relative;z-index:1}';
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
      await loadCategories();
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
  Object.assign(window.petitions,{open,renderHome,loadTemplates,loadCategories,loadLawyerBranding,restoreHistoryState,getCurrentDocumentCategory,backToCategoryFromDocument});
})();
