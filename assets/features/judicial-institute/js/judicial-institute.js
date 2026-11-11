/* قسم المعهد القضائي — أرشيف JSON مستقل دون اتصالات Firestore. */
(function () {
  'use strict';
  const DATA_URL='data/judicial-institute/manifest.json';
  const SAVED_KEY='mizan-judicial-institute-saved-v1';
  const ROOT_ID='judicial-institute-section';
  let data=null, dataPromise=null;
  const questionCache=new Map();
  let state={level:'home',year:null,subjectId:null,query:'',fromYear:2005,toYear:2026};
  const root=()=>document.getElementById(ROOT_ID);
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function savedIds(){try{const v=JSON.parse(localStorage.getItem(SAVED_KEY)||'[]');return Array.isArray(v)?v.map(String):[];}catch(_){return[];}}
  function saveIds(ids){try{localStorage.setItem(SAVED_KEY,JSON.stringify(Array.from(new Set(ids))));}catch(_){notice('تعذر الحفظ','مساحة التخزين المحلي غير متاحة حالياً.');}}
  function notice(title,message){if(window.app&&window.app.showHomeNotice)window.app.showHomeNotice(title,message);else window.alert(title+'\n'+message);}
  function loadData(){
    if(data)return Promise.resolve(data);
    if(!dataPromise)dataPromise=fetch(DATA_URL,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(v=>{
      if(!v||v.schemaVersion!==1||!Array.isArray(v.subjects)||!Array.isArray(v.years))throw new Error('Invalid archive manifest');
      data=v;return data;
    }).catch(e=>{dataPromise=null;throw e;});
    return dataPromise;
  }
  function archiveYears(){return data.years.map(y=>Number(y.year)).filter(Number.isInteger).sort((a,b)=>b-a);}
  function yearEntry(year){return data.years.find(y=>Number(y.year)===Number(year));}
  function subject(id){return data.subjects.find(s=>s.id===id);}
  function subjectQuestions(id,year){return questionCache.get(String(year)+'/'+String(id))||[];}
  async function loadYearSubject(year,id){
    const key=String(year)+'/'+String(id);
    if(questionCache.has(key))return questionCache.get(key);
    const entry=yearEntry(year), item=entry&&entry.subjects.find(s=>s.subjectId===id);
    if(!item)throw new Error('Subject archive is not listed in manifest');
    const response=await fetch(item.file,{cache:'no-cache'});
    if(!response.ok)throw new Error('Archive file HTTP '+response.status);
    const file=await response.json();
    if(file.schemaVersion!==1||file.year!==Number(year)||file.subjectId!==id||!Array.isArray(file.questions))throw new Error('Invalid subject archive file');
    questionCache.set(key,file.questions);
    return file.questions;
  }
  function shell(content){
    const showBack=state.level!=='home';
    return '<div class="ji-shell" dir="rtl"><header class="ji-header '+(showBack?'ji-header-inner':'ji-header-home')+'">'+
      (showBack?'<button class="ji-back" type="button" data-ji-action="back" aria-label="رجوع"><i class="fas fa-arrow-right" aria-hidden="true"></i><span>رجوع</span></button>':'')+
      '<div class="ji-brand"><span class="ji-brand-icon"><i class="fas fa-landmark" aria-hidden="true"></i></span><div><span class="ji-eyebrow">ميزان · القسم التعليمي</span><h1>المعهد القضائي</h1>'+(showBack?'':'<p class="ji-brand-description">مساحة منظمة للتحضير لامتحانات المعهد القضائي ومراجعة المواد القانونية.</p>')+'</div></div>'+
      '</header>'+content+
      '</div>';
  }
  function renderLanding(){
    const all=archiveYears();
    const savedCount=savedIds().length;
    return shell(
      '<section class="ji-entry-list">'+
      '<button type="button" class="ji-bank-card" data-ji-action="archive">'+
        '<span class="ji-entry-icon"><i class="fas fa-landmark" aria-hidden="true"></i></span>'+
        '<span class="ji-entry-copy"><strong>بنك أسئلة الأعوام السابقة</strong><small>تصفح أسئلة الامتحانات حسب السنة والمادة القانونية.</small></span>'+
        '<span class="ji-entry-stats">'+
          '<span><strong>'+data.years.reduce((n,y)=>n+Number(y.questionCount||0),0)+'</strong><small>سؤال</small></span>'+
          '<span><strong>'+data.subjects.length+'</strong><small>مواد</small></span>'+
          '<span><strong>'+all.length+'</strong><small>سنوات</small></span>'+
        '</span>'+
        '<i class="fas fa-arrow-left ji-entry-arrow" aria-hidden="true"></i>'+
      '</button>'+
      '<button type="button" class="ji-entry-card ji-saved-entry" data-ji-action="saved">'+
        '<span class="ji-entry-icon"><i class="fas fa-bookmark" aria-hidden="true"></i></span>'+
        '<span class="ji-entry-copy"><strong>المحفوظات</strong><small>الأسئلة التي حفظتها للرجوع إليها لاحقاً.</small></span>'+
        '<b class="ji-entry-count">'+savedCount+'</b>'+
        '<i class="fas fa-arrow-left ji-entry-arrow" aria-hidden="true"></i>'+
      '</button>'+
      '</section>');
  }
  function renderYears(){
    const all=archiveYears(), low=Math.min(Number(state.fromYear)||2005,Number(state.toYear)||2026), high=Math.max(Number(state.fromYear)||2005,Number(state.toYear)||2026);
    const filtered=all.filter(y=>y>=low&&y<=high);
    const options=all.slice().sort((a,b)=>a-b).map(y=>'<option value="'+y+'" '+(y===Number(state.fromYear)?'selected':'')+'>'+y+'</option>').join('');
    const toOptions=all.slice().sort((a,b)=>a-b).map(y=>'<option value="'+y+'" '+(y===Number(state.toYear)?'selected':'')+'>'+y+'</option>').join('');
    return shell('<section class="ji-panel"><div class="ji-section-heading"><div><span class="ji-kicker">تصفح الأرشيف</span><h2>سنوات الامتحانات</h2></div><span class="ji-count">'+filtered.length+' سنة</span></div>'+
      '<div class="ji-year-filters"><label>من سنة<select data-ji-filter="from">'+options+'</select></label><label>إلى سنة<select data-ji-filter="to">'+toOptions+'</select></label></div>'+
      '<div class="ji-year-grid">'+filtered.map(y=>'<button class="ji-year-card" type="button" data-ji-action="year" data-year="'+y+'"><span class="ji-year-icon"><i class="fas fa-calendar-days" aria-hidden="true"></i></span><strong>'+y+'</strong><small>'+Number((yearEntry(y)||{}).questionCount||0)+' سؤال</small><i class="fas fa-arrow-left ji-card-arrow" aria-hidden="true"></i></button>').join('')+'</div>'+
      (filtered.length?'':'<p class="ji-empty">لا توجد سنوات ضمن النطاق المحدد.</p>')+
      '<p class="ji-note"><i class="fas fa-circle-info" aria-hidden="true"></i> السنوات المعروضة هي فهرس الأرشيف؛ ظهور السنة لا يعني أن أسئلتها أُضيفت بعد.</p></section>');
  }
  function renderSubjects(){
    const entry=yearEntry(state.year), available=entry?entry.subjects:[], count=Number((entry||{}).questionCount||0);
    return shell('<section class="ji-breadcrumb"><button type="button" data-ji-action="years">الأرشيف</button><i class="fas fa-chevron-left"></i><span>امتحانات '+esc(state.year)+'</span></section>'+
      '<section class="ji-intro ji-intro-compact"><span class="ji-kicker">أرشيف سنة '+esc(state.year)+'</span><h2>اختر المادة القانونية</h2><p>تصفح الأسئلة الأصلية حسب المادة، مع المحافظة على رقم السؤال ومصدره.</p><div class="ji-stats ji-stats-single"><div><strong>'+count+'</strong><span>سؤال متاح لهذه السنة</span></div><div><strong>7</strong><span>مواد في الأرشيف</span></div></div></section>'+
      '<section class="ji-panel"><div class="ji-section-heading"><div><span class="ji-kicker">المواد الدراسية</span><h2>مواد المعهد القضائي</h2></div></div><div class="ji-subject-grid">'+data.subjects.map((s,i)=>{
        const total=Number(item.questionCount||0);
        return '<button class="ji-subject-card" type="button" data-ji-action="subject" data-subject="'+esc(s.id)+'"><span class="ji-subject-number">'+String(i+1).padStart(2,'0')+'</span><span class="ji-subject-copy"><strong>'+esc(s.name)+'</strong><small>'+esc(s.description)+'</small></span><span class="ji-subject-count">'+total+' سؤال</span><i class="fas fa-arrow-left" aria-hidden="true"></i></button>';
      }).join('')+'</div></section>');
  }
  function questionCard(q,index){
    const uid=String(q.uid||q.id||''), saved=uid&&savedIds().includes(uid), number=q.number==null?(q.questionNumber==null?index+1:q.questionNumber):q.number;
    const text=q.question||q.text||'', answer=q.answer, hasAnswer=answer!==undefined&&answer!==null&&String(answer).trim()!=='';
    const options=Array.isArray(q.options)&&q.options.length?'<ol class="ji-options">'+q.options.map(o=>'<li>'+esc(o)+'</li>').join('')+'</ol>':'';
    const answerText=hasAnswer&&typeof answer==='number'&&Array.isArray(q.options)?(q.options[answer]===undefined?String(answer):q.options[answer]):answer;
    return '<article class="ji-question-card"><div class="ji-question-meta"><span>السؤال '+esc(number)+'</span><span>'+esc(q.year||state.year)+'</span>'+(q.source?'<span>'+esc(q.source)+'</span>':'')+'</div><h3>'+esc(text)+'</h3>'+options+
      '<div class="ji-question-bottom">'+(hasAnswer?'<details class="ji-answer"><summary><i class="fas fa-lightbulb" aria-hidden="true"></i> عرض الإجابة</summary><div>'+esc(answerText)+'</div></details>':'<span class="ji-answer-pending"><i class="fas fa-hourglass-half" aria-hidden="true"></i> الإجابة غير مضافة بعد</span>')+
      '<button type="button" class="ji-save-question '+(saved?'is-saved':'')+'" data-ji-action="save" data-uid="'+esc(uid)+'" '+(uid?'':'disabled')+'><i class="fas fa-bookmark" aria-hidden="true"></i>'+(saved?'إزالة من المحفوظات':'حفظ السؤال')+'</button></div></article>';
  }
  function emptyState(title,message){
    return '<div class="ji-empty-state"><span><i class="fas fa-folder-open" aria-hidden="true"></i></span><h3>'+title+'</h3><p>'+message+'</p></div>';
  }
  function renderQuestions(){
    const s=subject(state.subjectId);if(!s){state.level='years';return renderYears();}
    const list=subjectQuestions(s.id,state.year).filter(q=>String(q.question||q.text||'').toLocaleLowerCase('ar').includes(state.query.toLocaleLowerCase('ar')));
    return shell('<section class="ji-breadcrumb"><button type="button" data-ji-action="years">الأرشيف</button><i class="fas fa-chevron-left"></i><button type="button" data-ji-action="subjects">'+esc(state.year)+'</button><i class="fas fa-chevron-left"></i><span>'+esc(s.name)+'</span></section>'+
      '<section class="ji-intro ji-intro-compact"><span class="ji-kicker">أسئلة سنة '+esc(state.year)+'</span><h2>'+esc(s.name)+'</h2><p>النصوص المعروضة تحفظ صياغة السؤال وترقيمه كما وردا في المصدر.</p><div class="ji-stats ji-stats-single"><div><strong>'+subjectQuestions(s.id,state.year).length+'</strong><span>سؤال في المادة</span></div><div><strong>'+savedIds().length+'</strong><span>سؤال محفوظ</span></div></div></section>'+
      '<section class="ji-panel"><div class="ji-question-toolbar"><div><span class="ji-kicker">بنك الأسئلة</span><h2>أسئلة المادة</h2></div><label class="ji-search"><i class="fas fa-search" aria-hidden="true"></i><input type="search" data-ji-search placeholder="ابحث في نصوص الأسئلة..." value="'+esc(state.query)+'"></label></div>'+
      (list.length?'<div class="ji-question-list">'+list.map(questionCard).join('')+'</div>':emptyState(state.query?'لا توجد نتائج مطابقة':'لا توجد أسئلة مضافة لهذه المادة في هذه السنة بعد',state.query?'جرّب كلمات بحث أخرى.':'ستظهر الأسئلة بعد إضافة بياناتها الأصلية إلى ملف الأرشيف، دون إنشاء أسئلة افتراضية.'))+'</section>');
  }
  function renderSaved(){
    const ids=savedIds(), list=Array.from(questionCache.values()).flat().filter(q=>ids.includes(String(q.uid||q.id||'')));
    return shell('<section class="ji-breadcrumb"><button type="button" data-ji-action="years">الأرشيف</button><i class="fas fa-chevron-left"></i><span>الأسئلة المحفوظة</span></section><section class="ji-panel"><div class="ji-section-heading"><div><span class="ji-kicker">مكتبتك الخاصة</span><h2>الأسئلة المحفوظة</h2></div><span class="ji-count">'+list.length+' سؤال</span></div>'+
      (list.length?'<div class="ji-question-list">'+list.map(questionCard).join('')+'</div>':emptyState('لا توجد أسئلة محفوظة','استخدم زر «حفظ السؤال» في بنك الأسئلة لإضافته إلى هذه القائمة.'))+'</section>');
  }
  function render(){
    const el=root();if(!el)return;
    if(!data){el.innerHTML=shell('<div class="ji-loading"><span class="ji-spinner"></span><p>جاري تحميل أرشيف المعهد القضائي...</p></div>');return;}
    if(state.level==='home')el.innerHTML=renderLanding();
    else if(state.level==='subjects')el.innerHTML=renderSubjects();
    else if(state.level==='questions')el.innerHTML=renderQuestions();
    else if(state.level==='saved')el.innerHTML=renderSaved();
    else el.innerHTML=renderYears();
    bind();
  }
  function pushLevel(level,extra){
    const next={view:'judicial-institute',judicialLevel:level,...(extra||{})};
    history.pushState(next,'',window.location.href);
    state={...state,level:level,year:next.year===undefined?state.year:next.year,subjectId:next.subjectId===undefined?state.subjectId:next.subjectId,query:''};
    render();
  }
  function back(){
    if(history.state&&history.state.view==='judicial-institute'&&history.state.judicialLevel!=='years')history.back();
    else if(window.app&&window.app.navigateTo)window.app.navigateTo('home');
  }
  function toggleSaved(uid){
    if(!uid)return;
    const ids=savedIds(),key=String(uid);
    saveIds(ids.includes(key)?ids.filter(v=>v!==key):ids.concat(key));
    render();
  }
  function bind(){
    const el=root();
    el.querySelectorAll('[data-ji-action]').forEach(button=>button.addEventListener('click',()=>{
      const action=button.dataset.jiAction;
      if(action==='back')return back();
      if(action==='years')return pushLevel('years',{year:null,subjectId:null});
      if(action==='archive')return pushLevel('years',{year:null,subjectId:null});
      if(action==='subjects')return pushLevel('subjects',{year:state.year,subjectId:null});
      if(action==='saved')return pushLevel('saved',{year:null,subjectId:null});
      if(action==='year')return pushLevel('subjects',{year:Number(button.dataset.year),subjectId:null});
      if(action==='subject'){const id=button.dataset.subject,year=state.year;button.disabled=true;button.setAttribute('aria-busy','true');loadYearSubject(year,id).then(()=>pushLevel('questions',{year,subjectId:id})).catch(error=>{console.error('تعذر تحميل ملف أسئلة المادة:',error);notice('تعذر تحميل الأسئلة','تحقق من ملف المادة ثم أعد المحاولة.');button.disabled=false;button.removeAttribute('aria-busy');});return;}
      if(action==='save')return toggleSaved(button.dataset.uid);
    }));
    el.querySelectorAll('[data-ji-filter]').forEach(select=>select.addEventListener('change',()=>{
      state[select.dataset.jiFilter==='from'?'fromYear':'toYear']=Number(select.value);render();
    }));
    const search=el.querySelector('[data-ji-search]');
    if(search)search.addEventListener('input',()=>{
      state.query=search.value;
      const position=search.selectionStart;
      render();
      const next=root().querySelector('[data-ji-search]');
      if(next){next.focus();next.setSelectionRange(position,position);}
    });
  }
  async function open(){
    state={level:'home',year:null,subjectId:null,query:'',fromYear:2005,toYear:2026};
    if(window.app&&window.app.navigateTo)window.app.navigateTo('judicial-institute',{judicialLevel:'home'});
    render();
    try{await loadData();render();}
    catch(error){
      console.error('Judicial institute archive load failed:',error);
      const el=root();
      if(el){el.innerHTML=shell(emptyState('تعذر تحميل الأرشيف','تحقق من الاتصال ثم أعد فتح القسم.')+'<button type="button" class="ji-primary-button" data-ji-retry>إعادة المحاولة</button>');
        el.querySelector('[data-ji-retry]').addEventListener('click',()=>{data=null;dataPromise=null;open();});}
    }
  }
  async function restoreHistoryState(historyState){
    try{await loadData();state={level:historyState.judicialLevel||'years',year:historyState.year==null?null:Number(historyState.year),subjectId:historyState.subjectId||null,query:'',fromYear:state.fromYear||2005,toYear:state.toYear||2026};render();}
    catch(error){console.error('تعذر استعادة أرشيف المعهد القضائي:',error);}
  }
  window.judicialInstitute={open:open,restoreHistoryState:restoreHistoryState};
})();