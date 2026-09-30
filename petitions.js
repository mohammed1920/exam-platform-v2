/* Mizan — Smart Legal Petitions */
(function(){
  'use strict';
  const state={templates:[],template:null,values:{},branded:true};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const val=k=>state.values[k]||'';
  const placeholderKeys={'المحكمة':'court','اسم المحكمة':'court','اسم المدعي':'plaintiff','اسم مقدم الطلب':'plaintiff','اسم المدعى عليه':'defendant','الجهة المقابلة':'defendant','موضوع العريضة':'subject','موضوع الطلب':'subject','مبلغ المطالبة':'amount','رقم الدعوى':'caseNumber','التاريخ':'date','اسم المحامي':'lawyerName'};
  const resolveKey=k=>placeholderKeys[k.trim()]||k.trim();
  const replacePlaceholders=t=>String(t||'').replace(/\[([^\]]+)\]/g,(_,k)=>val(resolveKey(k))||'['+k+']');
  async function loadTemplates(){try{const base=location.pathname.includes('/exam-platform-v2')?'/exam-platform-v2':'';const r=await fetch(base+'/data/petitions.json?v=1&ts='+Date.now(),{cache:'no-store'});state.templates=r.ok?await r.json():[];}catch(e){state.templates=[];}}
  async function open(){await loadTemplates();window.app.navigateTo('petitions');renderHome();}
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
    grid.innerHTML=items.length?items.map(t=>'<button class="petition-template-card" data-template="'+esc(t.uid)+'"><div class="petition-template-icon"><i class="'+esc(t.icon||'fas fa-file-signature')+'"></i></div><div><span>'+esc(t.category||'نماذج قانونية')+'</span><h3>'+esc(t.name)+'</h3><p>'+esc(t.description||'نموذج قابل للتعبئة والتعديل')+'</p></div><b>إنشاء العريضة ←</b></button>').join(''):'<div class="petition-empty">لا توجد نماذج مطابقة حالياً.</div>';
    grid.querySelectorAll('[data-template]').forEach(btn=>btn.onclick=()=>start(btn.dataset.template));
  }
  function start(uid){state.template=state.templates.find(t=>t.uid===uid);if(!state.template)return;const u=window.publicAuth&&window.publicAuth.user;state.values={lawyerName:u?(u.displayName||u.email||''):''};state.branded=true;renderBuilder();}
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
    const name=val('lawyerName')||(window.publicAuth?.user?.displayName||'اسم المحامي');
    const court=val('court')||'المحكمة المختصة',subject=val('subject')||state.template?.name||'عريضة قانونية';
    const body=esc(replacePlaceholders(editor.value)).replace(/\n/g,'<br>');
    document.getElementById('petition-a4-wrap').innerHTML='<article class="petition-a4 '+(state.branded?'is-branded':'')+'">'+(state.branded?'<header><div class="petition-lawyer-brand"><strong>'+esc(name)+'</strong><small>المحامي</small></div><div class="petition-brand-mark">م</div></header>':'')+'<div class="petition-doc-meta"><span>'+esc(court)+'</span><span>'+esc(val('date')||new Date().toLocaleDateString('ar-IQ'))+'</span></div><h1>'+esc(subject)+'</h1><div class="petition-doc-body">'+body+'</div><footer><div>مع التقدير والاحترام</div>'+(state.branded?'<div class="petition-signature"><strong>'+esc(name)+'</strong><small>المحامي</small></div>':'')+'</footer></article>';
  }
  function buildPrintHtml(){const a4=document.querySelector('.petition-a4');if(!a4)return '';return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+esc(state.template.name)+'</title><style>@page{size:A4;margin:0}body{margin:0;background:#fff;font-family:Arial,Tahoma,sans-serif}.petition-a4{box-sizing:border-box;width:210mm;min-height:297mm;padding:22mm 20mm;background:#fff;color:#111;direction:rtl}.petition-a4 header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #b78b3d;padding-bottom:9mm;margin-bottom:8mm}.petition-lawyer-brand strong{display:block;font-size:17px}.petition-lawyer-brand small{color:#777}.petition-brand-mark{width:17mm;height:17mm;border:1.5px solid #b78b3d;border-radius:50%;display:grid;place-items:center;color:#b78b3d;font-size:22px;font-weight:bold}.petition-doc-meta{display:flex;justify-content:space-between;color:#555;font-size:12px;margin-bottom:10mm}.petition-a4 h1{text-align:center;font-size:20px;margin:0 0 10mm}.petition-doc-body{font-size:15px;line-height:2.1;white-space:normal}.petition-a4 footer{margin-top:22mm;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #ddd;padding-top:7mm}.petition-signature{text-align:center}.petition-signature strong,.petition-signature small{display:block}</style></head><body>'+a4.outerHTML+'</body></html>';}
  function printPetition(){const html=buildPrintHtml();if(!html)return;const w=window.open('','_blank');if(!w)return alert('اسمح للنوافذ المنبثقة من المتصفح ثم أعد المحاولة.');w.document.write(html);w.document.close();setTimeout(()=>w.print(),300);}
  function exportWord(){const html=buildPrintHtml();if(!html)return;const blob=new Blob(['\\ufeff',html],{type:'application/msword'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(state.template.name||'عريضة').replace(/[\\/:*?"<>|]/g,'_')+'.doc';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);}
  window.petitions={open,renderHome,loadTemplates};document.addEventListener('DOMContentLoaded',loadTemplates);
})();