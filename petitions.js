/* Mizan — Smart Legal Petitions */
(function(){
  'use strict';
  const state={templates:[],template:null,values:{},branded:true,lawyer:{}};
  const LAWSUIT_LOGO_URL='https://raw.githubusercontent.com/mohammed1920/exam-platform-v2/main/assets/iraqi-bar-association-lawsuits.webp';
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const val=k=>state.values[k]||'';
  const placeholderKeys={'المحكمة':'court','اسم المحكمة':'court','اسم المدعي':'plaintiff','اسم مقدم الطلب':'plaintiff','اسم المدعى عليه':'defendant','الجهة المقابلة':'defendant','موضوع العريضة':'subject','موضوع الطلب':'subject','مبلغ المطالبة':'amount','رقم الدعوى':'caseNumber','التاريخ':'date','اسم المحامي':'lawyerName'};
  const resolveKey=k=>placeholderKeys[k.trim()]||k.trim();
  const replacePlaceholders=t=>String(t||'').replace(/\[([^\]]+)\]/g,(_,k)=>val(resolveKey(k))||'['+k+']');
  async function loadTemplates(){try{const base=location.pathname.includes('/exam-platform-v2')?'/exam-platform-v2':'';const r=await fetch(base+'/data/petitions.json?v=1&ts='+Date.now(),{cache:'no-store'});state.templates=r.ok?await r.json():[];}catch(e){state.templates=[];}}
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
  async function open(){await loadTemplates();await loadLawyerBranding();window.app.navigateTo('petitions');renderHome();}
  function renderHome(){
    const root=document.getElementById('petitions-section');if(!root)return;
    root.innerHTML='<div class="petitions-shell"><button class="back-btn" id="petitions-back"><i class="fas fa-arrow-right"></i> العودة للرئيسية</button><div class="petitions-hero"><span>ميزان • العرائض والطلبات</span><h2>أنشئ عريضتك القانونية بطريقة منظمة</h2><p>اختر نموذجاً، عبّئ البيانات مرة واحدة، ثم عدّل النص وعاينه على ورقة A4 قبل الطباعة أو التصدير.</p></div><div class="petition-tools"><label><i class="fas fa-search"></i><input id="petition-search" placeholder="ابحث عن عريضة أو طلب..."></label><span id="petition-count"></span></div><div id="petition-template-grid" class="petition-template-grid"></div></div>';
    document.getElementById('petitions-back').onclick=()=>window.app.navigateTo('home');
    document.getElementById('petition-search').oninput=e=>renderCards(e.target.value);renderCards('');
  }
  function renderCards(query){
    const grid=document.getElementById('petition-template-grid');if(!grid)return;const q=String(query||'').trim().toLowerCase();
    const items=state.templates.filter(t=>!q||[t.name,t.category,t.description].join(' ').toLowerCase().includes(q));
    const count=document.getElementById('petition-count');if(count)count.textContent=items.length+' نموذج';
    grid.innerHTML=items.length?items.map(t=>{const iconHtml='<i class="'+esc(t.icon||'fas fa-file-signature')+'"></i>';return '<button class="petition-template-card" data-template="'+esc(t.uid)+'"><div class="petition-template-icon">'+iconHtml+'</div><div><span>'+esc(t.category||'نماذج قانونية')+'</span><h3>'+esc(t.name)+'</h3><p>'+esc(t.description||'نموذج قابل للتعبئة والتعديل')+'</p></div><b>إنشاء العريضة ←</b></button>';}).join(''):'<div class="petition-empty">لا توجد نماذج مطابقة حالياً.</div>';
    grid.querySelectorAll('[data-template]').forEach(btn=>btn.onclick=()=>start(btn.dataset.template));
  }
  function start(uid){state.template=state.templates.find(t=>t.uid===uid);if(!state.template)return;const u=window.publicAuth&&window.publicAuth.user;state.values={lawyerName:state.lawyer.name||(u?(u.displayName||u.email||''):'')};state.branded=true;renderBuilder();}
  function renderBuilder(){
    const root=document.getElementById('petitions-section'),t=state.template;
    root.innerHTML='<div class="petitions-shell petition-builder-shell"><button class="back-btn" id="petition-builder-back"><i class="fas fa-arrow-right"></i> النماذج</button><div class="petition-builder-head"><div><span>'+esc(t.category||'نموذج قانوني')+'</span><h2>'+esc(t.name)+'</h2><p>'+esc(t.description||'')+'</p></div><div class="petition-status"><i class="fas fa-shield-halved"></i> نسخة عمل خاصة بك</div></div><div class="petition-layout"><div class="petition-form-panel"><div class="petition-panel-title"><i class="fas fa-pen-to-square"></i> بيانات العريضة</div><div class="petition-fields">'+(t.fields||[]).map(f=>'<label><span>'+esc(f.label)+(f.required?' *':'')+'</span><input data-field="'+esc(f.key)+'" value="'+esc(val(f.key))+'" placeholder="'+esc(f.placeholder||'')+'"></label>').join('')+'</div><label class="petition-long-field"><span>نص العريضة</span><textarea id="petition-body-editor" rows="16">'+esc(replacePlaceholders(t.body))+'</textarea></label><div class="petition-design"><span>شكل العريضة</span><button type="button" class="'+(state.branded?'active':'')+'" data-brand="1"><i class="fas fa-user-tie"></i> بتصميم المحامي</button><button type="button" class="'+(!state.branded?'active':'')+'" data-brand="0"><i class="fas fa-file-lines"></i> بدون تصميم</button></div><div class="petition-actions"><button class="petition-primary" id="petition-print"><i class="fas fa-print"></i> طباعة / حفظ PDF</button><button class="petition-secondary" id="petition-word"><i class="fas fa-file-word"></i> تصدير Word</button></div></div><div class="petition-preview-panel"><div class="petition-panel-title"><i class="fas fa-eye"></i> معاينة A4</div><div id="petition-a4-wrap"></div></div></div></div>';
    document.getElementById('petition-builder-back').onclick=renderHome;
    root.querySelectorAll('[data-field]').forEach(input=>input.oninput=()=>{state.values[input.dataset.field]=input.value;syncPreview();});
    document.getElementById('petition-body-editor').oninput=syncPreview;
    root.querySelectorAll('[data-brand]').forEach(btn=>btn.onclick=()=>{state.branded=btn.dataset.brand==='1';renderBuilder();});
    document.getElementById('petition-print').onclick=printPetition;document.getElementById('petition-word').onclick=exportWord;syncPreview();
  }
  function syncPreview(){
    const editor=document.getElementById('petition-body-editor');if(!editor)return;
    const name=val('lawyerName')||state.lawyer.name||(window.publicAuth?.user?.displayName||'اسم المحامي');
    const office=state.lawyer.office||'',phone=state.lawyer.phone||'';
    const rawBody=replacePlaceholders(editor.value);
    const cleanBody=rawBody.replace(/\n?\s*(?:مع التقدير(?: والاحترام)?\.?|مع الشكر والتقدير\.?|ولكم الشكر والاحترام\.?|ولكم وافر الشكر والتقدير\.?) [\s\S]*$/,'').replace(/\n?\s*(?:المحامي|المدعي|المدعية|وكيله? المحامي|وكيلها المحامي|بموجب الوكالة المرفقة|بموجب الوكالة المرقمة.*)$/,'');
    const body=esc(cleanBody.trim()).replace(/\n/g,'<br>');
    const plaintiff=val('plaintiff')||'';
    const attachments=String(val('attachments')||'').split(/\n|،/).map(x=>x.trim()).filter(Boolean);
    const logoUrl=LAWSUIT_LOGO_URL;
    const attachmentHtml=attachments.length?attachments.map((x,i)=>'<div class="attachment-item">'+(i+1)+'- '+esc(x)+'</div>').join(''):'<div class="attachment-item">1- </div><div class="attachment-item">2- </div>';
    document.getElementById('petition-a4-wrap').innerHTML='<article class="petition-a4 '+(state.branded?'is-branded':'')+'">'+(state.branded?'<header class="petition-letterhead"><div class="petition-head-side petition-head-left"><strong>جمهورية العراق</strong><small>The Republic of Iraq</small><b>نقابة المحامين العراقيين</b><small>Iraqi Bar Association</small></div><div class="petition-bar-logo"><img src="'+logoUrl+'" alt="شعار نقابة المحامين العراقيين"></div><div class="petition-head-side petition-head-right"><small>المحامي</small><strong>'+esc(name)+'</strong><b>محامٍ لدى المحاكم العراقية</b>'+(office?'<em>'+esc(office)+'</em>':'')+(phone?'<small>'+esc(phone)+'</small>':'')+'</div></header>':'')+'<div class="petition-doc-body">'+body+'</div><footer><div class="petition-signature"><strong>المدعي</strong><small>'+esc(plaintiff)+'</small></div><div class="petition-attachments"><strong>المرفقات</strong><div class="attachments-line"></div>'+attachmentHtml+'</div></footer></article>';
    const logo=document.querySelector('.petition-bar-logo img');
    if(logo){logo.loading='eager';logo.addEventListener('error',()=>{logo.onerror=null;logo.src='/assets/iraqi-bar-association-modern.svg';},{once:true});}
  }
  function buildPrintHtml(){
    const a4=document.querySelector('.petition-a4');if(!a4)return '';
    const css=`@page{size:A4;margin:0}body{margin:0;background:#fff;font-family:Arial,Tahoma,sans-serif}.petition-a4{box-sizing:border-box;width:210mm;min-height:297mm;padding:12mm 14mm 17mm;background:#fffdf8;color:#20252b;direction:rtl;position:relative;overflow:hidden;border:1.4mm solid #172b45;outline:.55mm solid #c59b4d;outline-offset:-3mm}.petition-a4:before{content:"";position:absolute;inset:4.5mm;border:.35mm solid #c59b4d;pointer-events:none}.petition-a4:after{content:"⚖";position:absolute;left:50%;top:54%;transform:translate(-50%,-50%);font-size:105mm;color:rgba(197,155,77,.045);pointer-events:none}.petition-letterhead{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) 34mm minmax(0,1fr);align-items:center;gap:7mm;padding:1mm 2mm 7mm;margin:0 0 7mm}.petition-letterhead:after{content:"";position:absolute;left:0;right:0;bottom:0;height:.7mm;background:linear-gradient(90deg,#172b45,#c59b4d 50%,#172b45)}.petition-head-side{text-align:center;color:#172b45;line-height:1.25}.petition-head-side strong{display:block;font-family:Georgia,"Times New Roman",serif;font-size:18px;line-height:1.25}.petition-head-side small{display:block;font-size:8.5px;color:#5d6875;line-height:1.4}.petition-head-side b{display:block;margin-top:2mm;font-size:12px}.petition-head-right small{color:#8c6b2d}.petition-head-right strong{display:block;font-family:"Amiri","Noto Naskh Arabic",Tahoma,serif;font-size:23px;line-height:1.35;color:#172b45}.petition-head-right b{font-size:10px;margin-top:1.5mm}.petition-head-right em{display:block;font-style:normal;font-size:8.5px;color:#68727c;margin-top:1mm}.petition-bar-logo{width:34mm;height:46mm;margin:auto;display:flex;align-items:center;justify-content:center}.petition-bar-logo img{display:block;width:100%;height:100%;object-fit:contain;object-position:center}.petition-doc-body{position:relative;z-index:1;font-size:13.6px;line-height:2.05;text-align:justify;padding:0 2mm}.petition-a4 footer{position:relative;z-index:1;margin-top:15mm;display:grid;grid-template-columns:1fr 1fr;gap:18mm;align-items:start;border-top:.25mm solid #d7d0c0;padding-top:6mm;direction:ltr}.petition-signature{text-align:left;padding-left:4mm}.petition-signature strong,.petition-signature small{display:block}.petition-signature strong{font-size:12px}.petition-signature small{font-size:10px;margin-top:2mm}.petition-attachments{text-align:right;direction:rtl}.petition-attachments strong{display:block;font-size:12px;color:#172b45;margin-bottom:3mm}.attachments-line{height:1px;background:#333;width:100%;margin-bottom:4mm}.attachment-item{font-size:10px;line-height:1.8;margin-bottom:1mm}`;
    const imgUrl=LAWSUIT_LOGO_URL;
    const html=a4.outerHTML.replace(/src="[^"]*"/,'src="'+imgUrl+'"');
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+esc(state.template.name)+'</title><style>'+css+'</style></head><body>'+html+'</body></html>';
  }
  function printPetition(){const html=buildPrintHtml();if(!html)return;const w=window.open('','_blank');if(!w)return alert('اسمح للنوافذ المنبثقة من المتصفح ثم أعد المحاولة.');w.document.write(html);w.document.close();setTimeout(()=>w.print(),300);}
  function exportWord(){const html=buildPrintHtml();if(!html)return;const blob=new Blob(['\\ufeff',html],{type:'application/msword'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(state.template.name||'عريضة').replace(/[\\/:*?"<>|]/g,'_')+'.doc';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);}
  window.petitions={open,renderHome,loadTemplates};document.addEventListener('DOMContentLoaded',loadTemplates);
})();