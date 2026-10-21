/* Mizan legal procedures: request-based access and protected section entry. */
(function () {
  'use strict';

  const collectionNames = { requests: 'procedureAccessRequests', access: 'procedureAccess' };
  let root = null;
  let currentUser = null;
  let currentRequest = null;
  let hasAccess = false;
  let busy = false;
  let titles = [];
  const detailCache = new Map();

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));

  function ensureSection() {
    if (root && document.body.contains(root)) return root;
    root = document.getElementById('procedures-section');
    if (root) return root;
    root = document.createElement('section');
    root.id = 'procedures-section';
    root.className = 'view-section procedures-view';
    const footer = document.querySelector('footer');
    const main = document.querySelector('main.container');
    if (main) {
      if (footer && footer.parentNode === main) main.insertBefore(root, footer);
      else main.appendChild(root);
    } else {
      document.body.appendChild(root);
    }
    return root;
  }

  function setMessage(message, error) {
    const el = root?.querySelector('#procedures-feedback');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
    el.classList.toggle('is-error', Boolean(error));
  }

  function renderIntro() {
    root.innerHTML = `
      <div class="procedures-shell">
        <button class="procedures-back" id="procedures-back" type="button"><i class="fas fa-arrow-right" aria-hidden="true"></i> العودة للرئيسية</button>
        <section class="procedures-hero">
          <div class="procedures-hero-mark"><i class="fas fa-file-signature" aria-hidden="true"></i></div>
          <div class="procedures-eyebrow">مكتبة ميزان القانونية</div>
          <h2>إجراءات الدعاوى</h2>
          <p>دليل عملي منظم للإجراءات القضائية في العراق، يربط خطوات العمل بالسند القانوني والنماذج ذات الصلة.</p>
          <div class="procedures-hero-meta"><span><i class="fas fa-book-open" aria-hidden="true"></i> إجراءات مرتبة حسب الموضوع</span><span><i class="fas fa-shield-halved" aria-hidden="true"></i> دخول بموافقة الإدارة</span></div>
        </section>
        <div id="procedures-feedback" class="procedures-feedback" role="status" hidden></div>
        <div id="procedures-access-state" class="procedures-access-state"></div>
        <p class="procedures-disclaimer">المحتوى للتثقيف والمعرفة القانونية، ويجب مراجعة النصوص الرسمية النافذة والتحقق من المدد والاختصاص قبل اتخاذ أي إجراء.</p>
      </div>`;
    root.querySelector('#procedures-back').addEventListener('click', () => window.app?.navigateTo('home'));
  }

  function renderRequestState(kind, detail) {
    const host = root.querySelector('#procedures-access-state');
    if (!host) return;
    const states = {
      login: { icon: 'fa-user-lock', title: 'سجّل الدخول لتقديم طلب الوصول', body: 'القسم ظاهر للجميع، لكن قراءة الإجراءات تتطلب حساباً وموافقة إدارية.' },
      pending: { icon: 'fa-hourglass-half', title: 'طلبك قيد المراجعة', body: 'استلمت ميزان طلبك. ستُفتح الإجراءات بعد مراجعة الإدارة والموافقة عليه.' },
      rejected: { icon: 'fa-circle-exclamation', title: 'لم تتم الموافقة على طلبك', body: 'يمكنك تقديم طلب جديد مع توضيح سبب الحاجة إلى القسم.' },
      revoked: { icon: 'fa-lock', title: 'صلاحية الوصول غير مفعّلة', body: 'تم إيقاف صلاحية الوصول لهذا الحساب. يمكنك إرسال طلب جديد لمراجعته.' },
      error: { icon: 'fa-triangle-exclamation', title: 'تعذر التحقق من صلاحية الوصول', body: 'تحقق من اتصال الإنترنت ثم أعد المحاولة. لن يُعرض المحتوى قبل التحقق من الصلاحية.' }
    };
    const state = states[kind] || states.error;
    host.innerHTML = `
      <div class="procedures-lock-card">
        <div class="procedures-lock-icon"><i class="fas ${state.icon}" aria-hidden="true"></i></div>
        <div class="procedures-lock-copy"><span class="procedures-lock-label">الوصول إلى المحتوى</span><h3>${state.title}</h3><p>${state.body}</p></div>
        ${kind === 'login' ? '<button type="button" class="procedures-primary" id="procedures-login">تسجيل الدخول</button>' : ''}
        ${kind === 'rejected' || kind === 'revoked' ? requestForm() : ''}
        ${kind === 'error' ? '<button type="button" class="procedures-secondary" id="procedures-retry">إعادة المحاولة</button>' : ''}
      </div>`;
    const login = host.querySelector('#procedures-login');
    if (login) login.addEventListener('click', () => window.publicAuth?.requireAuth(() => open()));
    const retry = host.querySelector('#procedures-retry');
    if (retry) retry.addEventListener('click', () => refreshAccess());
    host.querySelector('#procedures-request-form')?.addEventListener('submit', submitRequest);
  }

  function requestForm() {
    return `<form id="procedures-request-form" class="procedures-request-form">
      <label for="procedures-request-reason">سبب طلب الوصول <span>مطلوب</span></label>
      <textarea id="procedures-request-reason" name="reason" rows="3" maxlength="1000" required placeholder="اكتب باختصار كيف ستستفيد من دليل الإجراءات القانونية..."></textarea>
      <button type="submit" class="procedures-primary" id="procedures-submit-request"><i class="fas fa-paper-plane" aria-hidden="true"></i> إرسال طلب الوصول</button>
    </form>`;
  }

  function renderNewRequest() {
    const host = root.querySelector('#procedures-access-state');
    host.innerHTML = `
      <div class="procedures-lock-card">
        <div class="procedures-lock-icon"><i class="fas fa-lock" aria-hidden="true"></i></div>
        <div class="procedures-lock-copy"><span class="procedures-lock-label">قسم محمي</span><h3>اطلب الوصول إلى إجراءات الدعاوى</h3><p>قدّم طلبك مرة واحدة، وستراجعه الإدارة. لا تُفتح تفاصيل الإجراءات إلا بعد الموافقة.</p></div>
        ${requestForm()}
      </div>`;
    host.querySelector('#procedures-request-form')?.addEventListener('submit', submitRequest);
  }

  function renderPending() { renderRequestState('pending'); }

  async function loadTitleIndex() {
    const db = window.publicAuth?.firestore;
    if (!db) throw new Error('خدمة قاعدة البيانات غير متاحة');
    const snapshot = await db.collection('publicIndexes').doc('procedures').get();
    if (!snapshot.exists) { titles = []; return; }
    const data = snapshot.data()?.items;
    if (!Array.isArray(data)) throw new Error('صيغة فهرس الإجراءات غير صحيحة');
    const validCategories = new Set(['civil', 'criminal', 'administrative', 'personal']);
    titles = data.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && item.title.trim() && validCategories.has(item.category))
      .map(item => ({ id: item.id, title: item.title.trim(), category: item.category, categoryTitle: typeof item.categoryTitle === 'string' ? item.categoryTitle : '', summary: typeof item.summary === 'string' ? item.summary : '' }));
  }
  const procedureCategories = [{id:'civil',title:'الدعاوى المدنية',description:'المطالبة بالحقوق المدنية والديون والعقود والتعويض.'},{id:'criminal',title:'الدعاوى الجزائية',description:'الشكوى والتحقيق والمحاكمة والطعن في الدعاوى الجزائية.'},{id:'administrative',title:'الدعاوى الإدارية',description:'الطعن بالقرارات الإدارية وطلبات الإلغاء بحسب الاختصاص.'},{id:'personal',title:'دعاوى الأحوال الشخصية',description:'الزواج والطلاق والنفقة والحضانة وما يتصل بها.'}];
  function normalizeProcedureSearch(value){return String(value||'').toLocaleLowerCase('ar').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();}
  function procedureCategory(item){return ['civil','criminal','administrative','personal'].includes(item?.category)?item.category:null;}
  let activeProcedureCategory = null;
  function renderCatalog(){
    const host=root.querySelector('#procedures-access-state');
    const counts=procedureCategories.reduce((result,category)=>{result[category.id]=titles.filter(item=>procedureCategory(item)===category.id).length;return result;},{});
    host.innerHTML=`
      <div class="procedures-approved-banner"><i class="fas fa-circle-check" aria-hidden="true"></i><div><strong>تم تفعيل وصولك</strong><span>ابحث عن الإجراء أو اختر تصنيف الدعوى. تُحمّل التفاصيل عند فتح الإجراء فقط.</span></div></div>
      <div class="procedures-catalog-heading"><div><span>فهرس الإجراءات</span><h3>اختر نوع الدعوى</h3></div><span class="procedures-count">${titles.length} إجراء</span></div>
      <section class="procedures-search-panel" aria-label="البحث في إجراءات الدعاوى"><label for="procedures-search-input"><i class="fas fa-magnifying-glass" aria-hidden="true"></i> ابحث عن الإجراء الذي تحتاجه</label><div class="procedures-search-field"><input id="procedures-search-input" type="search" autocomplete="off" placeholder="مثلاً: مطالبة بدين أو مدة الطعن"><button type="button" id="procedures-search-clear" hidden aria-label="مسح البحث"><i class="fas fa-xmark" aria-hidden="true"></i></button></div><div id="procedures-search-results" class="procedures-search-results" aria-live="polite"><p class="procedures-search-empty">اكتب اسم الإجراء أو جزءاً منه للعثور عليه بسرعة.</p></div></section>
      <section id="procedures-content-panel" class="procedures-content-panel"><div id="procedures-category-grid" class="procedures-category-grid">${procedureCategories.map(category=>`<button type="button" class="procedures-category-card procedures-category-card--${category.id}" data-procedure-category="${category.id}"><span class="procedures-category-title">${esc(category.title)}</span><span class="procedures-category-description">${esc(category.description)}</span><span class="procedures-category-count">${counts[category.id]} إجراء <i class="fas fa-angle-left" aria-hidden="true"></i></span></button>`).join('')}</div><section id="procedures-category-results" class="procedures-category-results" hidden></section><div id="procedures-detail" class="procedures-detail" hidden></div></section>`;
    host.querySelectorAll('[data-procedure-category]').forEach(button=>button.addEventListener('click',()=>renderProcedureCategoryResults(button.dataset.procedureCategory)));
    const input=host.querySelector('#procedures-search-input'),clear=host.querySelector('#procedures-search-clear');
    input.addEventListener('input',()=>{clear.hidden=!input.value;renderProcedureSearchResults(input.value);});
    clear.addEventListener('click',()=>{input.value='';clear.hidden=true;renderProcedureSearchResults('');input.focus();});
  }
  function renderProcedureItems(items,heading,target){if(!target)return;target.hidden=false;target.innerHTML=`<div class="procedures-results-heading"><h4>${esc(heading)}</h4><span>${items.length} نتيجة</span></div>${items.length?`<div class="procedures-title-list">${items.map(item=>`<button type="button" class="procedures-title-item" data-procedure-id="${esc(item.id)}"><span>${esc(item.title)}</span><i class="fas fa-angle-left" aria-hidden="true"></i></button>`).join('')}</div>`:'<p class="procedures-empty">ما لقينا إجراءات مطابقة. جرّب كلمة ثانية.</p>'}`;target.querySelectorAll('[data-procedure-id]').forEach(button=>button.addEventListener('click',()=>openDetail(button.dataset.procedureId)));}
  function renderProcedureCategoryResults(categoryId){const category=procedureCategories.find(item=>item.id===categoryId),grid=root.querySelector('#procedures-category-grid'),target=root.querySelector('#procedures-category-results'),detail=root.querySelector('#procedures-detail');if(!category||!target||!grid||!detail)return;activeProcedureCategory=categoryId;grid.hidden=true;detail.hidden=true;detail.innerHTML='';target.hidden=false;renderProcedureItems(titles.filter(item=>procedureCategory(item)===categoryId),category.title,target);target.insertAdjacentHTML('afterbegin','<button type="button" class="procedures-detail-back procedures-category-back" id="procedures-category-back"><i class="fas fa-arrow-right" aria-hidden="true"></i> العودة إلى تصنيفات الدعاوى</button>');target.querySelector('#procedures-category-back')?.addEventListener('click',()=>{activeProcedureCategory=null;target.hidden=true;target.innerHTML='';grid.hidden=false;grid.scrollIntoView({behavior:'smooth',block:'start'});});target.scrollIntoView({behavior:'smooth',block:'start'});}
  function renderProcedureSearchResults(query){const target=root.querySelector('#procedures-search-results');if(!target)return;const normalized=normalizeProcedureSearch(query);if(!normalized){target.innerHTML='<p class="procedures-search-empty">اكتب اسم الإجراء أو جزءاً منه للعثور عليه بسرعة.</p>';return;}const terms=normalized.split(' ').filter(Boolean);const matches=titles.filter(item=>{const text=normalizeProcedureSearch([item.title,item.categoryTitle,item.summary].filter(Boolean).join(' '));return terms.every(term=>text.includes(term));}).slice(0,30);renderProcedureItems(matches,'نتائج البحث في إجراءات الدعاوى',target);}
  function detailBlock(title, value) {
    const values = Array.isArray(value) ? value : String(value || '').split(/\\r?\\n/);
    const clean = values.map(v => String(v || '').trim()).filter(Boolean);
    if (!clean.length) return '';
    return `<section class="procedures-detail-section"><h4>${esc(title)}</h4>${clean.length > 1 ? `<ol>${clean.map(v => `<li>${esc(v)}</li>`).join('')}</ol>` : `<p>${esc(clean[0])}</p>`}</section>`;
  }

  async function openDetail(id) {
    if (!hasAccess || !currentUser) return;
    const host = root.querySelector('#procedures-detail');
    const grid = root.querySelector('#procedures-category-grid');
    const categoryResults = root.querySelector('#procedures-category-results');
    if (!host || !grid || !categoryResults) return;
    grid.hidden = true;
    categoryResults.hidden = true;
    host.hidden = false;
    host.innerHTML = '<p class="procedures-loading" role="status">جارٍ تحميل الإجراء...</p>';
    try {
      let data = detailCache.get(id);
      if (!data) {
        const snap = await window.publicAuth.firestore.collection('legalProcedures').doc(id).get();
        if (!snap.exists || snap.data()?.published !== true) throw new Error('الإجراء غير متاح أو لم يعد منشوراً');
        data = { id: snap.id, ...snap.data() };
        detailCache.set(id, data);
      }
      host.innerHTML = `<button type="button" class="procedures-detail-back" id="procedures-detail-back"><i class="fas fa-arrow-right" aria-hidden="true"></i> العودة إلى الفهرس</button><article class="procedures-detail-card"><div class="procedures-detail-kicker">إجراءات الدعاوى · ميزان</div><h3>${esc(data.title || titles.find(item => item.id === id)?.title || 'إجراء قانوني')}</h3>${detailBlock('نبذة عن الإجراء', data.summary)}${detailBlock('الشروط والاختصاص', data.requirements)}${detailBlock('المستندات المطلوبة', data.documents)}${detailBlock('خطوات الإجراء', data.steps)}${detailBlock('السند القانوني', data.legalBasis)}${detailBlock('الرسوم', data.fees)}${detailBlock('المدد القانونية أو المتوقعة', data.duration)}<p class="procedures-detail-disclaimer">تحقّق من النصوص الرسمية النافذة قبل اتخاذ أي إجراء.</p></article>`;
      host.querySelector('#procedures-detail-back')?.addEventListener('click', () => { host.hidden = true; host.innerHTML = ''; if (activeProcedureCategory) { renderProcedureCategoryResults(activeProcedureCategory); } else { grid.hidden = false; grid.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
      host.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      console.error('Mizan procedure detail load failed:', error);
      host.innerHTML = '<div class="procedures-lock-card"><div class="procedures-lock-copy"><h3>تعذر تحميل الإجراء</h3><p>تحقق من الاتصال والصلاحية ثم أعد المحاولة.</p></div><button type="button" class="procedures-secondary" id="procedures-detail-retry">إعادة المحاولة</button></div>';
      host.querySelector('#procedures-detail-retry')?.addEventListener('click', () => openDetail(id));
    }
  }
  async function refreshAccess() {
    ensureSection();
    if (!window.publicAuth?.user) {
      detailCache.clear();
      currentUser = null; currentRequest = null; hasAccess = false;
      renderRequestState('login');
      return;
    }
    if (currentUser?.uid && currentUser.uid !== window.publicAuth.user.uid) detailCache.clear();
    currentUser = window.publicAuth.user;
    const db = window.publicAuth.firestore;
    if (!db) { renderRequestState('error'); return; }
    try {
      const isAdmin = window.firebaseAdminPanel?.isAdmin === true;
      if (isAdmin) {
        hasAccess = true;
        currentRequest = null;
        try { await loadTitleIndex(); renderCatalog(); }
        catch (error) { console.error('Procedure index load failed:', error); renderRequestState('error'); setMessage('تعذر تحميل فهرس الإجراءات من قاعدة البيانات.', true); }
        return;
      }

      const accessSnap = await db.collection(collectionNames.access).doc(currentUser.uid).get();
      hasAccess = Boolean(accessSnap.exists && accessSnap.data()?.enabled === true);
      if (hasAccess) {
        currentRequest = null;
        try { await loadTitleIndex(); renderCatalog(); }
        catch (error) { console.error('Procedure index load failed:', error); renderRequestState('error'); setMessage('تعذر تحميل فهرس الإجراءات من قاعدة البيانات.', true); }
        return;
      }

      detailCache.clear();
      const requestSnap = await db.collection(collectionNames.requests).doc(currentUser.uid).get();
      currentRequest = requestSnap.exists ? { id: requestSnap.id, ...requestSnap.data() } : null;
      if (!currentRequest) { renderNewRequest(); return; }
      if (currentRequest.status === 'pending') { renderPending(); return; }
      if (currentRequest.status === 'rejected') { renderRequestState('rejected'); return; }
      if (currentRequest.status === 'revoked') { renderRequestState('revoked'); return; }
      renderNewRequest();
    } catch (error) {
      console.error('Mizan procedures access check failed:', error);
      hasAccess = false;
      detailCache.clear();
      renderRequestState('error');
    }
  }

  async function submitRequest(event) {
    event.preventDefault();
    if (busy) return;
    const user = window.publicAuth?.user;
    const db = window.publicAuth?.firestore;
    if (!user) { window.publicAuth?.requireAuth(() => open()); return; }
    if (!db) { setMessage('خدمة حفظ الطلب غير متاحة حالياً. حاول لاحقاً.', true); return; }
    const reasonInput = root.querySelector('#procedures-request-reason');
    const reason = String(reasonInput?.value || '').trim();
    if (reason.length < 10) { setMessage('يرجى توضيح سبب الطلب بعشر كلمات/محارف على الأقل.', true); reasonInput?.focus(); return; }
    const button = root.querySelector('#procedures-submit-request');
    busy = true;
    if (button) { button.disabled = true; button.textContent = 'جارٍ إرسال الطلب...'; }
    try {
      const ref = db.collection(collectionNames.requests).doc(user.uid);
      const now = firebase.firestore.FieldValue.serverTimestamp();
      const payload = {
        uid: user.uid,
        displayName: String(user.displayName || user.email || 'مستخدم ميزان').slice(0, 120),
        email: String(user.email || '').slice(0, 254),
        reason: reason.slice(0, 1000),
        status: 'pending',
        updatedAt: now
      };
      if (currentRequest) {
        if (!['rejected', 'revoked'].includes(currentRequest.status)) {
          setMessage('لديك طلب سابق؛ لا يمكن إرسال طلب مكرر.', true);
          return;
        }
        await ref.update(payload);
      } else {
        payload.createdAt = now;
        await ref.set(payload);
      }
      currentRequest = { ...payload, status: 'pending' };
      renderPending();
      setMessage('تم إرسال طلبك إلى الإدارة بنجاح.', false);
    } catch (error) {
      console.error('Mizan procedures request failed:', error);
      setMessage('تعذر إرسال الطلب. تحقق من قواعد Firestore المنشورة ثم أعد المحاولة.', true);
    } finally {
      busy = false;
      const submit = root.querySelector('#procedures-submit-request');
      if (submit) submit.disabled = false;
    }
  }

  async function open(pushState = true) {
    ensureSection();
    if (!root.querySelector('.procedures-shell')) renderIntro();
    if (pushState) window.app?.navigateTo('procedures');
    else window.app?.navigateTo('procedures', {}, false);
    await refreshAccess();
  }

  function init() {
    ensureSection();
    if (!root.querySelector('.procedures-shell')) renderIntro();
    window.addEventListener('public-auth-state-changed', () => {
      if (root?.classList.contains('active')) refreshAccess();
    });
    window.addEventListener('firebase-admin-state-changed', () => {
      if (root?.classList.contains('active')) refreshAccess();
    });
    window.procedures = { open, refreshAccess };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
