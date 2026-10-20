/* Mizan legal procedures: request-based access and protected section entry. */
(function () {
  'use strict';

  const collectionNames = { requests: 'procedureAccessRequests', access: 'procedureAccess' };
  const categories = [
    { id: 'civil', icon: 'fa-scale-balanced', title: 'الدعاوى المدنية', desc: 'المطالبات المالية والالتزامات والعقود والتعويض والملكية.', topics: ['المطالبة بالدين', 'التعويض والمسؤولية المدنية', 'المنازعات العقدية', 'الملكية والحيازة'] },
    { id: 'criminal', icon: 'fa-gavel', title: 'الإجراءات الجزائية', desc: 'الشكوى والتحقيق والمحاكمة وطرق الطعن وفق نوع القضية.', topics: ['تقديم الشكوى', 'إجراءات التحقيق', 'المحاكمة والأدلة', 'الطعن بالقرارات والأحكام'] },
    { id: 'personal', icon: 'fa-people-roof', title: 'الأحوال الشخصية', desc: 'إجراءات الدعاوى الأسرية مع مراعاة القانون المنطبق والاختصاص.', topics: ['النفقة', 'التفريق والطلاق', 'الحضانة والمشاهدة', 'تصديق الحجج والمعاملات'] },
    { id: 'administrative', icon: 'fa-landmark', title: 'الدعاوى الإدارية', desc: 'الطعن بالقرارات والمنازعات الإدارية بحسب جهة الاختصاص.', topics: ['تحديد القرار المطعون فيه', 'شروط ومدة الطعن', 'تقديم الدعوى', 'آثار الحكم الإداري'] },
    { id: 'execution', icon: 'fa-file-circle-check', title: 'التنفيذ', desc: 'متابعة تنفيذ السندات والأحكام والاعتراضات المتصلة بالتنفيذ.', topics: ['فتح الإضبارة التنفيذية', 'تبليغ المدين', 'إجراءات التنفيذ', 'الاعتراضات وطرق المراجعة'] },
    { id: 'appeals', icon: 'fa-arrow-rotate-left', title: 'الطعن والمراجعة', desc: 'التعرّف على طرق الطعن ومددها وشروط قبولها بحسب نوع القرار.', topics: ['التمييز بين طرق الطعن', 'احتساب المدد', 'متطلبات لائحة الطعن', 'آثار الطعن'] }
  ];

  let root = null;
  let currentUser = null;
  let currentRequest = null;
  let hasAccess = false;
  let busy = false;

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

  function renderCatalog() {
    const host = root.querySelector('#procedures-access-state');
    host.innerHTML = `
      <div class="procedures-approved-banner"><i class="fas fa-circle-check" aria-hidden="true"></i><div><strong>تم تفعيل وصولك</strong><span>يمكنك تصفح التصنيفات أدناه. ستُربط صفحات الإجراءات التفصيلية بنصوصها القانونية المعتمدة عند إدخال محتواها.</span></div></div>
      <div class="procedures-catalog-heading"><div><span>دليل الإجراءات</span><h3>اختر نوع الإجراء</h3></div><span class="procedures-count">${categories.length} تصنيفات</span></div>
      <div class="procedures-category-grid">${categories.map(category => `
        <article class="procedures-category-card">
          <div class="procedures-category-top"><span class="procedures-category-icon"><i class="fas ${category.icon}" aria-hidden="true"></i></span><span class="procedures-category-count">${category.topics.length} موضوعات</span></div>
          <h4>${category.title}</h4><p>${category.desc}</p>
          <ul>${category.topics.map(topic => `<li><i class="fas fa-angle-left" aria-hidden="true"></i><span>${topic}</span></li>`).join('')}</ul>
        </article>`).join('')}</div>
      <div class="procedures-workflow">
        <div class="procedures-workflow-heading"><i class="fas fa-route" aria-hidden="true"></i><div><h3>طريقة تنظيم كل إجراء</h3><p>سيُعرض كل إجراء تفصيلياً ضمن قالب موحّد.</p></div></div>
        <div class="procedures-workflow-steps"><span>الشروط والاختصاص</span><span>المستندات المطلوبة</span><span>خطوات الإجراء</span><span>المدد القانونية</span><span>السند القانوني</span><span>النماذج ذات الصلة</span></div>
      </div>`;
  }

  async function refreshAccess() {
    ensureSection();
    if (!window.publicAuth?.user) {
      currentUser = null; currentRequest = null; hasAccess = false;
      renderRequestState('login');
      return;
    }
    currentUser = window.publicAuth.user;
    const db = window.publicAuth.firestore;
    if (!db) { renderRequestState('error'); return; }
    try {
      const isAdmin = window.firebaseAdminPanel?.isAdmin === true;
      const [accessSnap, requestSnap] = await Promise.all([
        db.collection(collectionNames.access).doc(currentUser.uid).get(),
        db.collection(collectionNames.requests).doc(currentUser.uid).get()
      ]);
      currentRequest = requestSnap.exists ? { id: requestSnap.id, ...requestSnap.data() } : null;
      hasAccess = isAdmin || Boolean(accessSnap.exists && accessSnap.data()?.enabled === true);
      if (hasAccess) { renderCatalog(); return; }
      if (!currentRequest) { renderNewRequest(); return; }
      if (currentRequest.status === 'pending') { renderPending(); return; }
      if (currentRequest.status === 'rejected') { renderRequestState('rejected'); return; }
      if (currentRequest.status === 'revoked') { renderRequestState('revoked'); return; }
      renderNewRequest();
    } catch (error) {
      console.error('Mizan procedures access check failed:', error);
      hasAccess = false;
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
      const snapshot = await ref.get();
      const now = firebase.firestore.FieldValue.serverTimestamp();
      const payload = {
        uid: user.uid,
        displayName: String(user.displayName || user.email || 'مستخدم ميزان').slice(0, 120),
        email: String(user.email || '').slice(0, 254),
        reason: reason.slice(0, 1000),
        status: 'pending',
        updatedAt: now
      };
      if (snapshot.exists) {
        const old = snapshot.data() || {};
        if (!['rejected', 'revoked'].includes(old.status)) {
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
    if (pushState) window.app?.navigateTo('procedures');
    else window.app?.navigateTo('procedures', {}, false);
    await refreshAccess();
  }

  function init() {
    ensureSection();
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
