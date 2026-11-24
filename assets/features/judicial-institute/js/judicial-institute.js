/* قسم المعهد القضائي — أرشيف JSON مستقل دون اتصالات Firestore. */
(function () {
  'use strict';
  const DATA_URL='data/judicial-institute/manifest.json';
  const SAVED_KEY='mizan-judicial-institute-saved-v1';
  const SAVED_DATA_KEY='mizan-judicial-institute-saved-data-v1';
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
    if(!dataPromise)dataPromise=fetch(DATA_URL,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(v=>{
      if(!v||v.schemaVersion!==1||!Array.isArray(v.subjects)||!Array.isArray(v.years))throw new Error('Invalid archive manifest');
      data=v;return data;
    }).catch(e=>{dataPromise=null;throw e;});
    return dataPromise;
  }
  function archiveYears(){return data.years.map(y=>Number(y.year)).filter(Number.isInteger).sort((a,b)=>b-a);}
  function yearEntry(year){return data.years.find(y=>Number(y.year)===Number(year));}
  function yearQuestionCount(entry){return Number(entry&&entry.questionCount!=null?entry.questionCount:(entry&&Array.isArray(entry.subjects)?entry.subjects.reduce((n,item)=>n+Number(item.questionCount||0),0):0));}
  function subject(id){return data.subjects.find(s=>s.id===id);}
  function subjectQuestions(id,year){return questionCache.get(String(year)+'/'+String(id))||[];}
  async function loadYearSubject(year,id){
    const key=String(year)+'/'+String(id);
    if(questionCache.has(key))return questionCache.get(key);
    const entry=yearEntry(year), item=entry&&entry.subjects.find(s=>s.subjectId===id);
    if(!item)throw new Error('Subject archive is not listed in manifest');
    const filePath=item.path||item.file;
    if(!filePath)throw new Error('Subject archive path is missing from manifest');
    const manifestUrl=new URL(DATA_URL,window.location.href);
    const archiveUrl=new URL(filePath,manifestUrl).toString();
    const response=await fetch(archiveUrl,{cache:'no-store'});
    if(!response.ok)throw new Error('Archive file HTTP '+response.status);
    const file=await response.json();
    if(file.schemaVersion!==1||file.year!==Number(year)||file.subjectId!==id||!Array.isArray(file.questions))throw new Error('Invalid subject archive file');
    questionCache.set(key,file.questions);
    return file.questions;
  }
  function shell(content){
    const showBack=state.level!=='home';
    return '<div class="ji-shell" dir="rtl"><header class="ji-header mizan-section-hero '+(showBack?'ji-header-inner':'ji-header-home')+'">'+
      (showBack?'<button class="ji-back" type="button" data-ji-action="back" aria-label="رجوع"><i class="fas fa-arrow-right" aria-hidden="true"></i><span>رجوع</span></button>':'')+
      '<div class="mizan-section-hero-heading"><span class="mizan-section-hero-icon ji-brand-icon" aria-hidden="true"><i class="fas fa-landmark"></i></span><h1>المعهد القضائي</h1></div>'+
      (showBack?'':'<p class="ji-brand-description">مساحة منظمة للتحضير لامتحانات المعهد القضائي ومراجعة المواد القانونية.</p>')+
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
          '<span><strong>'+data.years.reduce((n,y)=>n+yearQuestionCount(y),0)+'</strong><small>سؤال</small></span>'+
          '<span><strong>'+data.subjects.length+'</strong><small>مواد</small></span>'+
          '<span><strong>'+all.length+'</strong><small>سنوات</small></span>'+
        '</span>'+
        '<i class="fas fa-arrow-left ji-entry-arrow" aria-hidden="true"></i>'+
      '</button>'+
      '<button type="button" class="ji-bank-card ji-answers-entry" data-ji-action="answers">'+
        '<span class="ji-entry-icon"><i class="fas fa-book-open" aria-hidden="true"></i></span>'+
        '<span class="ji-entry-copy"><strong>أسئلة وأجوبة المعهد القضائي</strong><small>أسئلة نظرية ووقائع عملية مع الإجابات والحلول القانونية.</small></span>'+
        '<span class="ji-entry-stats"><span><strong>Q&amp;A</strong><small>موسوعة مستقلة</small></span></span>'+
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
      '<div class="ji-year-grid">'+filtered.map(y=>'<button class="ji-year-card" type="button" data-ji-action="year" data-year="'+y+'"><span class="ji-year-icon"><i class="fas fa-calendar-days" aria-hidden="true"></i></span><strong>'+y+'</strong><small>'+yearQuestionCount(yearEntry(y))+' سؤال</small><i class="fas fa-arrow-left ji-card-arrow" aria-hidden="true"></i></button>').join('')+'</div>'+
      (filtered.length?'':'<p class="ji-empty">لا توجد سنوات ضمن النطاق المحدد.</p>')+
      '<p class="ji-note"><i class="fas fa-circle-info" aria-hidden="true"></i> السنوات المعروضة هي فهرس الأرشيف؛ ظهور السنة لا يعني أن أسئلتها أُضيفت بعد.</p></section>');
  }
  function renderSubjects(){
    const entry=yearEntry(state.year), available=entry&&Array.isArray(entry.subjects)?entry.subjects:[], count=yearQuestionCount(entry);
    return shell('<section class="ji-breadcrumb"><button type="button" data-ji-action="years">الأرشيف</button><i class="fas fa-chevron-left"></i><span>امتحانات '+esc(state.year)+'</span></section>'+
      '<section class="ji-intro ji-intro-compact mizan-section-hero"><span class="ji-kicker">أرشيف سنة '+esc(state.year)+'</span><div class="mizan-section-hero-heading"><span class="mizan-section-hero-icon" aria-hidden="true"><i class="fas fa-folder-open"></i></span><h2>اختر المادة القانونية</h2></div><p>تصفح الأسئلة الأصلية حسب المادة، مع المحافظة على رقم السؤال ومصدره.</p><div class="ji-stats ji-stats-single"><div><strong>'+count+'</strong><span>سؤال متاح لهذه السنة</span></div><div><strong>'+available.length+'</strong><span>مواد متاحة لهذه السنة</span></div></div></section>'+
      '<section class="ji-panel"><div class="ji-section-heading"><div><span class="ji-kicker">المواد الدراسية</span><h2>مواد المعهد القضائي</h2></div></div><div class="ji-subject-grid">'+available.map((item,i)=>{
        const s=subject(item.subjectId);if(!s)return '';
        const total=Number(item.questionCount||0);
        const description=String(s.description||'').trim();
        return '<button class="ji-subject-card" type="button" data-ji-action="subject" data-subject="'+esc(s.id)+'"><span class="ji-subject-number">'+String(i+1).padStart(2,'0')+'</span><span class="ji-subject-copy"><strong>'+esc(s.name)+'</strong>'+(description?'<small>'+esc(description)+'</small>':'')+'</span><span class="ji-subject-count">'+total+' سؤال</span><i class="fas fa-arrow-left" aria-hidden="true"></i></button>';
      }).join('')+'</div></section>');
  }
  function questionCard(q,index){
    const uid=String(q.uid||q.id||''), saved=uid&&savedIds().includes(uid), number=q.id==null?(q.questionNumber==null?index+1:q.questionNumber):q.id;
    const text=q.text||q.question||'', answer=q.answer, hasAnswer=answer!==undefined&&answer!==null&&String(answer).trim()!=='';
    const options=Array.isArray(q.options)&&q.options.length?'<ol class="ji-options">'+q.options.map(o=>'<li>'+esc(typeof o==='string'?o:o.text||'')+'</li>').join('')+'</ol>':'';
    const parts=Array.isArray(q.parts)&&q.parts.length?'<div class="ji-question-parts">'+q.parts.map(p=>'<div class="ji-question-part"><strong>'+esc(p.label||'')+'</strong><p>'+esc(p.text||'')+'</p></div>').join('')+'</div>':'';
    let source='';
    if(q.source&&typeof q.source==='object'){
      const sourceParts=[];
      if(q.source.file)sourceParts.push('الملف: '+esc(q.source.file));
      if(q.source.page)sourceParts.push('الصفحة '+esc(q.source.page));
      if(q.source.questionNumber)sourceParts.push('رقم السؤال الأصلي '+esc(q.source.questionNumber));
      if(sourceParts.length)source='<div class="ji-question-source">'+sourceParts.join(' · ')+'</div>';
    }else if(q.source)source='<div class="ji-question-source">'+esc(q.source)+'</div>';
    const notes=q.verification&&q.verification.notes?'<p class="ji-question-note">ملاحظة التحقق: '+esc(q.verification.notes)+'</p>':'';
    const answerText=hasAnswer&&typeof answer==='number'&&Array.isArray(q.options)?(q.options[answer]===undefined?String(answer):typeof q.options[answer]==='string'?q.options[answer]:q.options[answer].text):answer;
    return '<article class="ji-question-card"><div class="ji-question-meta"><span>السؤال '+esc(number)+'</span><span>'+esc(q.year||state.year||'')+'</span><span>'+esc(q.type||'سؤال')+'</span></div>'+(String(text).trim()?'<h3>'+esc(text)+'</h3>':'')+parts+options+source+notes+
      '<div class="ji-question-bottom"><span class="ji-answer-pending"><i class="fas fa-book-open" aria-hidden="true"></i> بنك القبول: أسئلة دون إجابات</span>'+
      '<button type="button" class="ji-save-question '+(saved?'is-saved':'')+'" data-ji-action="save" data-uid="'+esc(uid)+'" '+(uid?'':'disabled')+'><i class="fas fa-bookmark" aria-hidden="true"></i>'+(saved?'إزالة من المحفوظات':'حفظ السؤال')+'</button></div></article>';
  }
  function emptyState(title,message){
    return '<div class="ji-empty-state"><span><i class="fas fa-folder-open" aria-hidden="true"></i></span><h3>'+title+'</h3><p>'+message+'</p></div>';
  }
  function renderQuestions(){
    const s=subject(state.subjectId);if(!s){state.level='years';return renderYears();}
    const all=subjectQuestions(s.id,state.year);
    const list=all.filter(q=>[q.question,q.text,...(Array.isArray(q.parts)?q.parts.map(p=>p.text):[])].filter(Boolean).join(' ').toLocaleLowerCase('ar').includes(state.query.toLocaleLowerCase('ar')));
    return shell('<section class="ji-breadcrumb"><button type="button" data-ji-action="years">الأرشيف</button><i class="fas fa-chevron-left"></i><button type="button" data-ji-action="subjects">'+esc(state.year)+'</button><i class="fas fa-chevron-left"></i><span>'+esc(s.name)+'</span></section>'+
      '<section class="ji-panel"><div class="ji-question-toolbar"><div><span class="ji-kicker">بنك الأسئلة</span><h2>أسئلة المادة</h2><span class="ji-count">'+list.length+' من '+all.length+' سؤال</span></div><label class="ji-search"><i class="fas fa-search" aria-hidden="true"></i><input type="search" data-ji-search placeholder="ابحث في نصوص الأسئلة..." value="'+esc(state.query)+'"></label></div>'+
      (list.length?'<div class="ji-question-list">'+list.map(questionCard).join('')+'</div>':emptyState(state.query?'لا توجد نتائج مطابقة':'لا توجد أسئلة مضافة لهذه المادة في هذه السنة بعد',state.query?'جرّب كلمات بحث أخرى.':'ستظهر الأسئلة بعد إضافة بياناتها الأصلية إلى ملف الأرشيف، دون إنشاء أسئلة افتراضية.'))+'</section>');
  }
  function readSavedRecords(){
    try{const value=JSON.parse(localStorage.getItem(SAVED_DATA_KEY)||'[]');return Array.isArray(value)?value.filter(item=>item&&item.uid&&item.question):[];}catch(_){return[];}
  }
  async function loadSavedQuestions(){
    const ids=savedIds(), records=readSavedRecords(), known=new Set(records.map(item=>String(item.uid)));
    const pending=ids.filter(uid=>!known.has(String(uid)));
    const targets=new Map();
    pending.forEach(uid=>{
      const match=String(uid).match(/^JI-(\d{4})-(.+)-(\d+)$/);
      if(!match)return;
      const year=Number(match[1]), subjectId=match[2].toLowerCase();
      const key=year+'/'+subjectId;
      if(subject(subjectId)&&yearEntry(year)&&!targets.has(key))targets.set(key,{year,subjectId,uids:[]});
      const target=targets.get(key);if(target)target.uids.push(String(uid));
    });
    const results=await Promise.allSettled(Array.from(targets.values()).map(async target=>{
      const questions=await loadYearSubject(target.year,target.subjectId);
      target.uids.forEach(uid=>{
        const question=questions.find(item=>String(item.uid||item.id||'')===uid);
        if(question&&!known.has(uid)){records.push({uid,year:target.year,subjectId:target.subjectId,question});known.add(uid);}
      });
    }));
    results.filter(result=>result.status==='rejected').forEach(result=>console.warn('تعذر تحميل ملف من المحفوظات القديمة:',result.reason));
    try{localStorage.setItem(SAVED_DATA_KEY,JSON.stringify(records));}catch(_){notice('تعذر استرجاع المحفوظات','مساحة التخزين المحلي غير متاحة حالياً.');}
  }
  let judicialAnswersCache=null,judicialAnswersPromise=null;
  async function loadJudicialAnswers(){
    if(judicialAnswersCache)return judicialAnswersCache;
    if(!window.publicAuth?.firestore)throw new Error('Firebase غير جاهز حالياً');
    const user=window.publicAuth.user;
    if(!user)throw new Error('سجّل الدخول أولاً لتقديم طلب الوصول.');
    const db=window.publicAuth.firestore,uid=user.uid;
    const grant=await db.collection('judicialInstituteAccess').doc(uid).get();
    if(!grant.exists||grant.data()?.enabled!==true)throw new Error('ACCESS_REQUIRED');
    if(!judicialAnswersPromise)judicialAnswersPromise=db.collection('judicialInstituteAnswers').where('published','==',true).limit(100).get().then(snap=>{
      judicialAnswersCache=snap.docs.map(doc=>({id:doc.id,...doc.data()}));return judicialAnswersCache;
    }).catch(error=>{judicialAnswersPromise=null;throw error;});
    return judicialAnswersPromise;
  }
  async function renderJudicialAccessGate(){
    const el=root(),user=window.publicAuth?.user,db=window.publicAuth?.firestore;
    if(!user){el.innerHTML=shell(emptyState('تسجيل الدخول مطلوب','سجّل الدخول إلى حسابك في ميزان أولاً، ثم قدّم طلب الوصول إلى موسوعة الأسئلة والأجوبة.'));return;}
    if(!db){el.innerHTML=shell(emptyState('الخدمة غير متاحة حالياً','تعذر الاتصال بخدمة الحسابات. حاول مرة أخرى لاحقاً.'));return;}
    try{
      const uid=user.uid,[grantSnap,requestSnap]=await Promise.all([
        db.collection('judicialInstituteAccess').doc(uid).get(),
        db.collection('judicialInstituteAccessRequests').doc(uid).get()
      ]);
      if(grantSnap.exists&&grantSnap.data()?.enabled===true){judicialAnswersCache=null;judicialAnswersPromise=null;await loadJudicialAnswers();state.level='answers';render();return;}
      const request=requestSnap.exists?requestSnap.data():null;
      const pending=request?.status==='pending';
      const status=request?.status==='rejected'?'سبق رفض طلبك. يمكنك تقديم طلب جديد بعد توضيح السبب.':request?.status==='revoked'?'تم سحب صلاحية الوصول السابقة. يمكنك تقديم طلب جديد.':'';
      el.innerHTML=shell('<section class="ji-panel ji-access-panel"><div class="ji-section-heading"><div><span class="ji-kicker">محتوى محمي</span><h2>طلب الوصول إلى أسئلة وأجوبة المعهد القضائي</h2></div></div><p>للاطلاع على الأسئلة والإجابات والحلول القانونية، يرجى تقديم طلب إلى إدارة ميزان. ستتمكن من فتح المحتوى بعد الموافقة.</p>'+
        (pending?'<div class="ji-access-status"><strong>طلبك قيد المراجعة</strong><p>تم استلام طلبك، وسيظهر المحتوى بعد موافقة الإدارة.</p></div>':
        '<form data-ji-access-form class="ji-access-form"><label>سبب طلب الوصول<textarea name="reason" rows="4" minlength="10" maxlength="1000" required placeholder="اكتب سبب رغبتك بالاطلاع على الموسوعة..."></textarea></label><button class="ji-primary-button" type="submit">إرسال طلب الوصول</button></form>')+
        (status?'<p class="ji-note">'+esc(status)+'</p>':'')+'</section>');
      const form=el.querySelector('[data-ji-access-form]');
      form?.addEventListener('submit',async event=>{
        event.preventDefault();const reason=String(new FormData(form).get('reason')||'').trim();
        if(reason.length<10)return notice('سبب الطلب قصير','يرجى كتابة سبب لا يقل عن 10 أحرف.');
        const button=form.querySelector('button');button.disabled=true;button.textContent='جارٍ إرسال الطلب...';
        try{
          const payload={uid,displayName:user.displayName||'مستخدم ميزان',email:user.email||'',reason,status:'pending',updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
          if(request?.createdAt)payload.createdAt=request.createdAt;else payload.createdAt=firebase.firestore.FieldValue.serverTimestamp();
          await db.collection('judicialInstituteAccessRequests').doc(uid).set(payload);
          notice('تم إرسال الطلب','سيصبح المحتوى متاحاً بعد موافقة الإدارة.');
          await renderJudicialAccessGate();
        }catch(error){console.error('Judicial institute access request failed:',error);notice('تعذر إرسال الطلب','تحقق من الاتصال ثم أعد المحاولة.');button.disabled=false;button.textContent='إرسال طلب الوصول';}
      });
    }catch(error){console.error('Judicial institute access check failed:',error);el.innerHTML=shell(emptyState('تعذر التحقق من صلاحية الوصول','حاول تحديث الصفحة أو إعادة فتح القسم.'));}
  }
  function renderAnswers(){
    const rows=judicialAnswersCache||[],subjects=Array.from(new Set(rows.map(row=>String(row.subject||'').trim()).filter(Boolean)));
    const selected=state.answerSubject||'all',query=String(state.query||'').trim().toLocaleLowerCase('ar');
    const filtered=rows.filter(row=>(selected==='all'||row.subject===selected)&&[row.subject,row.question,row.answer,row.source].filter(Boolean).join(' ').toLocaleLowerCase('ar').includes(query));
    return shell('<section class="ji-breadcrumb"><button type="button" data-ji-action="home">المعهد القضائي</button><i class="fas fa-chevron-left"></i><span>أسئلة وأجوبة المعهد القضائي</span></section>'+
      '<section class="ji-panel"><div class="ji-question-toolbar"><div><span class="ji-kicker">موسوعة مستقلة</span><h2>الأسئلة والحلول</h2><span class="ji-count">'+filtered.length+' سؤال وجواب</span></div><label class="ji-search"><i class="fas fa-search" aria-hidden="true"></i><input type="search" data-ji-answer-search placeholder="ابحث في الأسئلة والإجابات..." value="'+esc(state.query)+'"></label></div>'+
      '<div class="ji-year-filters"><label>المادة القانونية<select data-ji-answer-subject><option value="all">جميع المواد</option>'+subjects.map(s=>'<option value="'+esc(s)+'" '+(selected===s?'selected':'')+'>'+esc(s)+'</option>').join('')+'</select></label></div>'+
      (filtered.length?'<div class="ji-question-list">'+filtered.map((row,index)=>'<article class="ji-question-card ji-answer-library-card"><div class="ji-question-meta"><span>'+esc(row.subject)+'</span><span>'+esc(row.type==='practical'?'واقعة عملية':row.type==='topic'?'موضوع قانوني':'سؤال نظري')+'</span></div><h3>'+esc(row.question)+'</h3><details class="ji-answer" open><summary><i class="fas fa-lightbulb" aria-hidden="true"></i> الإجابة والحل</summary><div class="ji-answer-content">'+esc(row.answer).replace(/\n/g,'<br>')+'</div></details>'+(row.source?'<div class="ji-question-source">'+esc(row.source)+'</div>':'')+'</article>').join('')+'</div>':emptyState(rows.length?'لا توجد نتائج مطابقة':'لم تُنشر أسئلة وأجوبة بعد',rows.length?'جرّب كلمات بحث أخرى أو اختر مادة مختلفة.':'ستظهر الأسئلة والحلول هنا بعد إضافتها واعتماد نشرها من الإدارة.'))+'</section>');
  }
  function renderSaved(){
    const ids=savedIds(), records=readSavedRecords(), byId=new Map(records.map(item=>[String(item.uid),item]));
    Array.from(questionCache.values()).flat().forEach(q=>{
      const uid=String(q.uid||q.id||'');
      if(ids.includes(uid)&&!byId.has(uid))byId.set(uid,{uid,year:q.year||null,subjectId:null,question:q});
    });
    const list=ids.map(uid=>byId.get(String(uid))).filter(Boolean).map(item=>({...item.question,year:item.year||item.question.year}));
    const missing=ids.length-list.length;
    return shell('<section class="ji-breadcrumb"><button type="button" data-ji-action="years">الأرشيف</button><i class="fas fa-chevron-left"></i><span>الأسئلة المحفوظة</span></section><section class="ji-panel"><div class="ji-section-heading"><div><span class="ji-kicker">مكتبتك الخاصة</span><h2>الأسئلة المحفوظة</h2></div><span class="ji-count">'+list.length+' سؤال</span></div>'+
      (list.length?'<div class="ji-question-list">'+list.map(questionCard).join('')+'</div>':emptyState('لا توجد أسئلة محفوظة','استخدم زر «حفظ السؤال» في بنك الأسئلة لإضافته إلى هذه القائمة.'))+
      (missing?'<p class="ji-note">تعذر العثور على بيانات '+missing+' من الأسئلة المحفوظة القديمة في الأرشيف الحالي.</p>':'')+'</section>');
  }
  function render(){
    const el=root();if(!el)return;
    if(!data){el.innerHTML=shell('<div class="ji-loading"><span class="ji-spinner"></span><p>جاري تحميل أرشيف المعهد القضائي...</p></div>');return;}
    if(state.level==='home')el.innerHTML=renderLanding();
    else if(state.level==='subjects')el.innerHTML=renderSubjects();
    else if(state.level==='questions')el.innerHTML=renderQuestions();
    else if(state.level==='answers')el.innerHTML=renderAnswers();
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
    const ids=savedIds(),key=String(uid),records=readSavedRecords(),alreadySaved=ids.includes(key);
    saveIds(alreadySaved?ids.filter(v=>v!==key):ids.concat(key));
    const nextRecords=alreadySaved?records.filter(item=>String(item.uid)!==key):records;
    if(!alreadySaved){
      const question=Array.from(questionCache.values()).flat().find(item=>String(item.uid||item.id||'')===key);
      if(question)nextRecords.push({uid:key,year:Number(state.year)||question.year||null,subjectId:state.subjectId||null,question});
    }
    try{localStorage.setItem(SAVED_DATA_KEY,JSON.stringify(nextRecords));}catch(_){notice('تعذر حفظ السؤال','مساحة التخزين المحلي غير متاحة حالياً.');}
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
      if(action==='home')return pushLevel('home',{year:null,subjectId:null});
      if(action==='answers'){state.answerSubject='all';state.query='';button.disabled=true;button.setAttribute('aria-busy','true');el.innerHTML=shell('<div class="ji-loading"><span class="ji-spinner"></span><p>جارٍ التحقق من صلاحية الوصول...</p></div>');const user=window.publicAuth?.user,db=window.publicAuth?.firestore;if(!user){button.disabled=false;button.removeAttribute('aria-busy');return notice('تسجيل الدخول مطلوب','سجّل الدخول أولاً لتقديم طلب الوصول.');}if(!db){button.disabled=false;button.removeAttribute('aria-busy');return notice('الخدمة غير متاحة','تعذر الاتصال بخدمة الحسابات.');}db.collection('judicialInstituteAccess').doc(user.uid).get().then(snap=>{if(snap.exists&&snap.data()?.enabled===true){return loadJudicialAnswers().then(()=>pushLevel('answers',{year:null,subjectId:null}));}return renderJudicialAccessGate();}).catch(error=>{console.error('Judicial institute access check failed:',error);return renderJudicialAccessGate();}).finally(()=>{button.disabled=false;button.removeAttribute('aria-busy');});return;}
      if(action==='saved'){button.disabled=true;loadSavedQuestions().then(()=>pushLevel('saved',{year:null,subjectId:null})).catch(error=>{console.error('تعذر استرجاع الأسئلة المحفوظة:',error);notice('تعذر استرجاع المحفوظات','تعذر تحميل بعض ملفات الأرشيف.');pushLevel('saved',{year:null,subjectId:null});}).finally(()=>{button.disabled=false;});return;}
      if(action==='year')return pushLevel('subjects',{year:Number(button.dataset.year),subjectId:null});
      if(action==='subject'){const id=button.dataset.subject,year=state.year;button.disabled=true;button.setAttribute('aria-busy','true');loadYearSubject(year,id).then(()=>pushLevel('questions',{year,subjectId:id})).catch(error=>{console.error('تعذر تحميل ملف أسئلة المادة:',error);notice('تعذر تحميل الأسئلة','تحقق من ملف المادة ثم أعد المحاولة.');button.disabled=false;button.removeAttribute('aria-busy');});return;}
      if(action==='save')return toggleSaved(button.dataset.uid);
    }));
    el.querySelectorAll('[data-ji-filter]').forEach(select=>select.addEventListener('change',()=>{
      state[select.dataset.jiFilter==='from'?'fromYear':'toYear']=Number(select.value);render();
    }));
    const answerSearch=el.querySelector('[data-ji-answer-search]');
    if(answerSearch)answerSearch.addEventListener('input',()=>{state.query=answerSearch.value;render();const next=root().querySelector('[data-ji-answer-search]');if(next){next.focus();next.setSelectionRange(next.value.length,next.value.length);}});
    const answerSubject=el.querySelector('[data-ji-answer-subject]');
    if(answerSubject)answerSubject.addEventListener('change',()=>{state.answerSubject=answerSubject.value;render();});
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