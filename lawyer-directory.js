/* دليل المحامين: طلبات الإضافة + عرض الملفات المعتمدة. */
(function () {
  'use strict';

  // هوية نقابة المحامي لا تُرفع أو تُخزّن داخل Firebase Storage.
  // يرسلها المتقدم يدويًا للأدمن عبر واتساب أو تلغرام.
  const WHATSAPP_NUMBER = '9647738511899';
  const TELEGRAM_USERNAME = 'Mo7m7med';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[m]));

  function notify(title, message) {
    if (window.app?.showHomeNotice) window.app.showHomeNotice(title, message);
    else alert(title + '\n' + message);
  }

  function buildSection() {
    if (document.getElementById('lawyers-section')) return;
    const main = document.querySelector('main.container');
    if (!main) return;
    const section = document.createElement('section');
    section.id = 'lawyers-section';
    section.className = 'view-section lawyers-section';
    section.innerHTML = `
      <button class="back-btn" type="button" id="lawyers-back-btn"><i class="fas fa-arrow-right"></i> العودة للقائمة الرئيسية</button>
      <div class="lawyers-hero">
        <span>👨‍⚖️ دليل المحامين</span>
        <h2>دليل المحامين العراقيين</h2>
        <p>اعثر على المحامين الذين وافقوا على نشر بياناتهم في الدليل، أو قدّم طلبك لإضافة ملفك بعد التحقق من بياناتك.</p>
      </div>

      <div class="lawyers-toolbar">
        <div class="lawyers-search"><i class="fas fa-search"></i><input id="lawyers-search-input" type="search" placeholder="ابحث باسم المحامي أو الاختصاص أو المحافظة..."></div>
        <button id="lawyer-apply-btn" class="lawyers-primary-btn" type="button"><i class="fas fa-user-plus"></i> طلب إضافة محامٍ</button>
      </div>

      <div id="lawyers-apply-panel" class="lawyer-apply-panel" hidden>
        <div class="lawyer-form-head"><div><span>طلب جديد</span><h3>أرسل بياناتك للمراجعة</h3><p>لن تُنشر البيانات أو بطاقة النقابة قبل مراجعة الأدمن والموافقة عليها.</p></div><button id="lawyer-form-close" type="button" aria-label="إغلاق">×</button></div>
        <div class="lawyer-identity-notice">
          <strong><i class="fas fa-id-card"></i> التحقق من هوية النقابة</strong>
          <span>لا نرفع أو نخزن صورة الهوية داخل المنصة. بعد إرسال الطلب، أرسل صورة بطاقة/هوية نقابة المحامين يدويًا للأدمن عبر واتساب أو تلغرام.</span>
          <div class="lawyer-identity-actions">
            <a class="lawyer-identity-btn whatsapp" href="https://wa.me/\${WHATSAPP_NUMBER}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> إرسال الهوية عبر واتساب</a>
            <a class="lawyer-identity-btn telegram" href="https://t.me/\${TELEGRAM_USERNAME}" target="_blank" rel="noopener noreferrer"><i class="fab fa-telegram-plane"></i> إرسال الهوية عبر تلغرام</a>
          </div>
        </div>

        <form id="lawyer-application-form" class="lawyer-form">
          <div class="lawyer-form-grid">
            <label>الاسم الكامل<input name="name" required maxlength="120" autocomplete="name"></label>
            <label>المحافظة<input name="governorate" required maxlength="60"></label>
            <label>القضاء / المنطقة<input name="district" maxlength="100"></label>
            <label>رقم الهاتف<input name="phone" required maxlength="30" inputmode="tel"></label>
            <label>اسم المكتب<input name="office" maxlength="140"></label>
            <label>عنوان المكتب<input name="address" maxlength="220"></label>
            <label class="full">الاختصاصات <input name="specializations" required maxlength="180" placeholder="مثال: مدني، أحوال شخصية، تجاري"></label>
            <label class="full">أوقات الدوام <input name="workingHours" maxlength="180" placeholder="مثال: السبت–الخميس 4م–9م"></label>
            <label class="full">نبذة مختصرة<textarea name="description" rows="4" maxlength="600"></textarea></label>
          </div>
          <label class="lawyer-consent"><input name="consent" type="checkbox" required> أقر بأن البيانات تخصني، وأوافق على نشر البيانات العامة فقط في الدليل عند الموافقة على الطلب.</label>
          <button class="lawyers-primary-btn" id="lawyer-submit-btn" type="submit"><i class="fas fa-paper-plane"></i> إرسال الطلب للمراجعة</button>
          <div id="lawyer-form-status" class="lawyer-form-status" aria-live="polite"></div>
        </form>
      </div>

      <div id="lawyers-list" class="lawyers-list"><div class="lawyers-empty">جاري تحميل دليل المحامين...</div></div>
    `;
    main.appendChild(section);

    document.getElementById('lawyers-back-btn').onclick = () => window.app?.navigateTo('home');
    document.getElementById('lawyer-apply-btn').onclick = () => openApplication();
    document.getElementById('lawyer-form-close').onclick = () => closeApplication();
    document.getElementById('lawyer-application-form').addEventListener('submit', submitApplication);
    document.getElementById('lawyers-search-input').addEventListener('input', renderProfiles);
  }

  function openApplication() {
    if (!window.publicAuth?.user) {
      window.publicAuth?.requireAuth(() => openApplication());
      return;
    }
    document.getElementById('lawyers-apply-panel').hidden = false;
    document.getElementById('lawyer-apply-btn').hidden = true;
    document.getElementById('lawyers-apply-panel').scrollIntoView({behavior:'smooth', block:'start'});
  }

  function closeApplication() {
    const panel = document.getElementById('lawyers-apply-panel');
    if (panel) panel.hidden = true;
    const btn = document.getElementById('lawyer-apply-btn');
    if (btn) btn.hidden = false;
  }

  function setFormStatus(text, error) {
    const el = document.getElementById('lawyer-form-status');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'lawyer-form-status' + (error ? ' error' : '');
  }

  async function submitApplication(event) {
    event.preventDefault();
    const user = window.publicAuth?.user;
    const db = window.publicAuth?.firestore;
    if (!user || !db) {
      notify('طلب إضافة محامٍ', 'يجب تسجيل الدخول أولاً.');
      return;
    }

    const form = event.currentTarget;
    const fd = new FormData(form);
    const submit = document.getElementById('lawyer-submit-btn');
    submit.disabled = true;
    setFormStatus('جارٍ حفظ الطلب...');

    try {
      const ref = db.collection('lawyerApplications').doc();
      const applicationId = ref.id;

      const specializations = String(fd.get('specializations') || '')
        .split(/[،,]/).map(v => v.trim()).filter(Boolean).slice(0, 10);

      await ref.set({
        id: applicationId,
        applicantUid: user.uid,
        applicantEmail: user.email || null,
        name: String(fd.get('name') || '').trim(),
        governorate: String(fd.get('governorate') || '').trim(),
        district: String(fd.get('district') || '').trim(),
        phone: String(fd.get('phone') || '').trim(),
        office: String(fd.get('office') || '').trim(),
        address: String(fd.get('address') || '').trim(),
        specializations,
        workingHours: String(fd.get('workingHours') || '').trim(),
        description: String(fd.get('description') || '').trim(),
        identityVerification: 'external_whatsapp_or_telegram',
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      form.reset();
      closeApplication();
      notify('تم إرسال الطلب', 'تم استلام بياناتك. أرسل الآن صورة هوية نقابة المحامين للأدمن عبر واتساب أو تلغرام حتى يكتمل التحقق، ثم تتم مراجعة الطلب.');
    } catch (error) {
      console.error('Lawyer application failed:', error);
      setFormStatus('تعذر إرسال الطلب. حاول مرة أخرى.', true);
    } finally {
      submit.disabled = false;
    }
  }

  let profiles = [];

  async function loadProfiles() {
    buildSection();
    const list = document.getElementById('lawyers-list');
    if (!list) return;
    const db = window.publicAuth?.firestore;
    if (!db) {
      list.innerHTML = '<div class="lawyers-empty">تعذر الاتصال بقاعدة البيانات.</div>';
      return;
    }
    try {
      const snap = await db.collection('lawyerProfiles').where('published','==',true).get();
      profiles = snap.docs.map(d => ({id:d.id, ...d.data()}));
      renderProfiles();
    } catch (error) {
      console.error('Lawyer profiles load failed:', error);
      list.innerHTML = '<div class="lawyers-empty">تعذر تحميل الدليل حالياً.</div>';
    }
  }

  function renderProfiles() {
    const list = document.getElementById('lawyers-list');
    if (!list) return;
    const q = String(document.getElementById('lawyers-search-input')?.value || '').trim().toLowerCase();
    const rows = profiles.filter(p => {
      const text = [p.name,p.governorate,p.district,p.office,p.address,(p.specializations||[]).join(' ')].join(' ').toLowerCase();
      return !q || text.includes(q);
    });
    if (!rows.length) {
      list.innerHTML = '<div class="lawyers-empty"><i class="fas fa-user-tie"></i><strong>لا توجد نتائج حالياً</strong><span>سيظهر المحامون بعد اعتماد ملفاتهم من الإدارة.</span></div>';
      return;
    }
    list.innerHTML = rows.map(p => `
      <article class="lawyer-card">
        <div class="lawyer-card-icon"><i class="fas fa-user-tie"></i></div>
        <div class="lawyer-card-main">
          <h3>${esc(p.name)}</h3>
          <div class="lawyer-verified">✓ بيانات معتمدة من الإدارة</div>
          <p><i class="fas fa-location-dot"></i> ${esc([p.governorate,p.district].filter(Boolean).join(' — ') || 'العنوان غير متوفر')}</p>
          <div class="lawyer-tags">${(p.specializations||[]).slice(0,4).map(s => '<span>'+esc(s)+'</span>').join('')}</div>
          <div class="lawyer-card-actions">
            ${p.phone ? '<a href="tel:'+esc(p.phone)+'"><i class="fas fa-phone"></i> اتصال</a>' : ''}
            ${p.mapUrl ? '<a href="'+esc(p.mapUrl)+'" target="_blank" rel="noopener"><i class="fas fa-map-location-dot"></i> الخريطة</a>' : ''}
          </div>
        </div>
      </article>`).join('');
  }

  function install() {
    buildSection();
    window.addEventListener('public-auth-state-changed', () => {});
    if (window.publicAuth?.whenReady) window.publicAuth.whenReady().then(loadProfiles);
    else loadProfiles();
  }

  window.lawyerDirectory = { load: loadProfiles, openApplication };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();