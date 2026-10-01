/* منبر ميزان — مقالات وأبحاث ومساهمات أهل الاختصاص. */
(function () {
  'use strict';

  const COLLECTION = 'mizanArticles';
  let initialized = false;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function formatDate(value) {
    if (!value) return '';
    const date = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ar-IQ', {year:'numeric', month:'long', day:'numeric'});
  }

  async function loadPublished() {
    const db = window.publicAuth?.firestore;
    const list = document.getElementById('mizan-pulpit-list');
    if (!list) return;
    if (!db) {
      list.innerHTML = '<div class="mizan-pulpit-empty">يتعذر تحميل المنبر حالياً.</div>';
      return;
    }
    list.innerHTML = '<div class="mizan-pulpit-loading"><i class="fas fa-spinner fa-spin"></i> جارٍ تحميل المشاركات...</div>';
    try {
      const snap = await db.collection(COLLECTION).where('status','==','published').limit(50).get();
      const docs = snap.docs.sort((a,b) => { const av=a.data()?.publishedAt?.toDate?.()?.getTime?.() || 0; const bv=b.data()?.publishedAt?.toDate?.()?.getTime?.() || 0; return bv-av; }).slice(0,30);
      if (!docs.length) {
        list.innerHTML = '<div class="mizan-pulpit-empty"><i class="fas fa-feather-pointed"></i><strong>لم تُنشر مشاركات بعد</strong><span>كن من أوائل المساهمين في منبر ميزان.</span></div>';
        return;
      }
      list.innerHTML = docs.map(doc => {
        const a = doc.data() || {};
        return '<article class="mizan-article-card">' +
          '<div class="mizan-article-meta"><span>' + esc(a.type || 'مقالة قانونية') + '</span><time>' + esc(formatDate(a.publishedAt || a.createdAt)) + '</time></div>' +
          '<h3>' + esc(a.title || 'مشاركة قانونية') + '</h3>' +
          '<p>' + esc(a.excerpt || '') + '</p>' +
          '<button type="button" class="mizan-article-author" data-contributor-id="' + esc(a.authorUid || '') + '" ' + (a.authorUid ? '' : 'disabled') + '><i class="fas fa-user-tie"></i><span><strong>' + esc(a.authorName || 'كاتب مساهم') + '</strong><small>' + esc(a.authorTitle || 'مساهم في منبر ميزان') + '</small></button>' +
          '<div class="mizan-article-card-footer"><button type="button" class="mizan-read-btn" data-article-id="' + esc(doc.id) + '"><i class="fas fa-book-open"></i> قراءة المقال</button></div>' +
          '</article>';
      }).join('');
    } catch (error) {
      console.error('Mizan Pulpit load error:', error);
      list.innerHTML = '<div class="mizan-pulpit-empty">تعذر تحميل المشاركات حالياً. حاول مرة أخرى.</div>';
    }
  }

  async function openContributorProfile(uid) {
    if (!uid) return;
    const db = window.publicAuth?.firestore;
    if (!db) return;
    try {
      const snap = await db.collection('mizanContributorPublic').doc(uid).get();
      if (!snap.exists) return;
      const p = snap.data() || {};
      const countSnap = await db.collection(COLLECTION)
        .where('status','==','published')
        .limit(200).get();
      const count = countSnap.docs.filter(d => d.data()?.authorUid === uid).length;
      const modal = document.getElementById('mizan-contributor-profile-modal');
      if (!modal) return;
      modal.innerHTML =
        '<div class="mizan-profile-modal-box">' +
          '<button type="button" class="mizan-profile-close" aria-label="إغلاق">×</button>' +
          '<div class="mizan-profile-avatar"><i class="fas fa-user-tie"></i></div>' +
          '<div class="mizan-profile-kicker">مساهم في منبر ميزان</div>' +
          '<h2>' + esc(p.fullName || 'مساهم قانوني') + '</h2>' +
          '<div class="mizan-profile-role">' + esc(p.role || 'مساهم') + '</div>' +
          '<div class="mizan-profile-stats"><div><strong>' + count + '</strong><span>مساهمة منشورة</span></div><div><strong>' + esc(p.specialization || '—') + '</strong><span>التخصص</span></div></div>' +
          '<div class="mizan-profile-section"><h3>النبذة المهنية</h3><p>' + esc(p.bio || 'لم تتم إضافة نبذة مهنية.') + '</p></div>' +
        '</div>';
      modal.classList.add('is-open');
      modal.querySelector('.mizan-profile-close').onclick = () => modal.classList.remove('is-open');
    } catch (error) {
      console.error('Mizan contributor profile error:', error);
    }
  }

  function openArticle(id) {
    const db = window.publicAuth?.firestore;
    if (!db) return;
    db.collection(COLLECTION).doc(id).get().then(doc => {
      if (!doc.exists || doc.data().status !== 'published') return;
      const a = doc.data();
      const modal = document.getElementById('mizan-article-modal');
      if (!modal) return;
      modal.innerHTML =
        '<div class="mizan-article-modal-box">' +
        '<button type="button" class="mizan-article-close" aria-label="إغلاق">×</button>' +
        '<div class="mizan-article-modal-meta">' + esc(a.type || 'مقالة قانونية') + ' · ' + esc(formatDate(a.publishedAt || a.createdAt)) + '</div>' +
        '<h2>' + esc(a.title || '') + '</h2>' +
        '<div class="mizan-article-modal-author"><strong>' + esc(a.authorName || '') + '</strong><span>' + esc(a.authorTitle || '') + '</span></div>' +
        '<div class="mizan-article-body">' + esc(a.content || '').replace(/\n/g, '<br>') + '</div>' +
        '</div>';
      modal.classList.add('is-open');
      modal.querySelector('.mizan-article-close').onclick = () => modal.classList.remove('is-open');
    }).catch(() => {});
  }

  const CONTRIBUTORS = 'mizanContributors';

  async function getContributor() {
    const db = window.publicAuth?.firestore;
    const user = window.publicAuth?.user;
    if (!db || !user) return null;
    try {
      const snap = await db.collection(CONTRIBUTORS).doc(user.uid).get();
      return snap.exists ? (snap.data() || null) : null;
    } catch (e) {
      console.error('Mizan contributor read error:', e);
      return null;
    }
  }

  function populateContributorForm(contributor) {
    const form=document.getElementById('mizan-contributor-form');
    if(!form||!contributor)return;
    if(form.fullName) form.fullName.value=contributor.fullName||'';
    if(form.role) form.role.value=contributor.role||'أخرى';
    if(form.specialization) form.specialization.value=contributor.specialization||'';
    if(form.affiliation) form.affiliation.value=contributor.affiliation||'';
    if(form.bio) form.bio.value=contributor.bio||'';
  }

  async function openContributorEdit() {
    const auth=window.publicAuth;
    if(!auth?.user){ auth?.openLogin(); return; }
    const contributor=await getContributor();
    if(!contributor){ showContributorModal('لا توجد بيانات مساهم محفوظة. يمكنك تعبئة الطلب للانضمام إلى منبر ميزان.'); return; }
    populateContributorForm(contributor);
    const modal=document.getElementById('mizan-contributor-modal');
    const title=modal?.querySelector('.mizan-modal-head h3');
    const submit=modal?.querySelector('button[type="submit"]');
    if(title) title.textContent='تحديث بيانات المساهم';
    if(submit) submit.textContent='حفظ التعديلات';
    const msg=modal?.querySelector('[data-contributor-message]');
    if(msg) msg.textContent=contributor.status==='approved'?'يمكنك تحديث بياناتك الشخصية والمهنية. حالة اعتمادك ستبقى كما هي.':contributor.status==='blocked'?'يمكنك تحديث بياناتك، لكن حالة حظر النشر ستبقى كما هي.':'حدّث بياناتك ثم احفظ التعديلات.';
    modal?.classList.add('is-open');
  }

  function resetContributorModalForNew() {
    const form=document.getElementById('mizan-contributor-form');
    const modal=document.getElementById('mizan-contributor-modal');
    if(form) form.reset();
    const title=modal?.querySelector('.mizan-modal-head h3');
    const submit=modal?.querySelector('button[type="submit"]');
    if(title) title.textContent='الانضمام إلى منبر ميزان';
    if(submit) submit.textContent='إرسال طلب الاعتماد';
  }

  function showContributorModal(message) {
    const modal = document.getElementById('mizan-contributor-modal');
    if (!modal) return;
    const msg = modal.querySelector('[data-contributor-message]');
    if (msg) msg.textContent = message || 'قدّم طلب الانضمام إلى منبر ميزان ليتم مراجعته من الإدارة.';
    modal.classList.add('is-open');
  }

  async function openSubmit() {
    const auth = window.publicAuth;
    if (!auth?.user) { auth?.openLogin(); return; }
    const contributor = await getContributor();
    if (!contributor || contributor.status !== 'approved') {
      if (contributor?.status === 'pending') showContributorModal('طلبك قيد المراجعة. بعد اعتمادك ستتمكن من نشر مشاركاتك.');
      else if (contributor?.status === 'rejected') showContributorModal('تم رفض طلب الانضمام سابقاً. يمكنك تقديم طلب جديد من خلال الإدارة.');
      else showContributorModal('للنشر في منبر ميزان، يجب أولاً التسجيل كمساهم واعتماد حسابك من إدارة المنصة.');
      return;
    }
    const modal = document.getElementById('mizan-submit-modal');
    if (modal) {
      const form=document.getElementById('mizan-submit-form');
      if(form){
        if(form.authorName) form.authorName.value=contributor.fullName||auth.user.displayName||'';
        if(form.authorTitle) form.authorTitle.value=contributor.role||'';
        if(form.authorSpecialization) form.authorSpecialization.value=contributor.specialization||'';
      }
      modal.classList.add('is-open');
    }
  }

  async function submitContributor(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const db = window.publicAuth?.firestore;
    const user = window.publicAuth?.user;
    if (!db || !user) return window.publicAuth?.openLogin();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const existing = await getContributor();
      const nextStatus = existing?.status === 'approved' || existing?.status === 'blocked' ? existing.status : 'pending';
      const data = {
        fullName: form.fullName.value.trim(),
        role: form.role.value,
        specialization: form.specialization.value.trim(),
        affiliation: form.affiliation.value.trim(),
        bio: form.bio.value.trim(),
        status: nextStatus,
        userUid: user.uid,
        email: user.email || null,
        createdAt: existing?.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (!data.fullName || !data.specialization || !data.bio) throw new Error('missing');
      await db.collection(CONTRIBUTORS).doc(user.uid).set(data, {merge:true});
      if (nextStatus === 'approved') {
        await db.collection('mizanContributorPublic').doc(user.uid).set({
          fullName:data.fullName,
          role:data.role,
          specialization:data.specialization,
          bio:data.bio,
          status:'approved',
          updatedAt:firebase.firestore.FieldValue.serverTimestamp()
        }, {merge:true});
      }
      document.getElementById('mizan-contributor-modal')?.classList.remove('is-open');
      const isUpdate=!!existing;
      window.app?.showHomeNotice?.(isUpdate?'تم تحديث بياناتك':'تم إرسال طلب الانضمام', isUpdate?'تم حفظ بيانات المساهم بنجاح.':'سيتم مراجعة بياناتك من إدارة منبر ميزان.');
      form.reset();
      resetContributorModalForNew();
    } catch (error) {
      console.error('Mizan contributor submit error:', error);
      alert('تعذر إرسال طلب الانضمام حالياً. حاول مرة أخرى.');
    } finally { button.disabled = false; }
  }

  async function submitArticle(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const db = window.publicAuth?.firestore;
    const user = window.publicAuth?.user;
    if (!db || !user) return window.publicAuth?.openLogin();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const contributor = await getContributor();
      if (!contributor || contributor.status !== 'approved') {
        await openSubmit();
        return;
      }
      const data = {
        title: form.title.value.trim(),
        type: form.type.value,
        authorName: contributor.fullName || user.displayName || '',
        authorTitle: contributor.role || '',
        authorSpecialization: contributor.specialization || '',
        excerpt: form.excerpt.value.trim(),
        content: form.content.value.trim(),
        authorUid: user.uid,
        authorEmail: user.email || null,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (!data.title || !data.authorName || !data.content) throw new Error('missing');
      await db.collection(COLLECTION).add(data);
      form.reset();
      document.getElementById('mizan-submit-modal')?.classList.remove('is-open');
      window.app?.showHomeNotice?.('تم استلام المشاركة', 'ستظهر بعد مراجعتها واعتمادها من إدارة المنصة.');
    } catch (error) {
      console.error('Mizan Pulpit submit error:', error);
      alert('تعذر إرسال المشاركة حالياً. حاول مرة أخرى.');
    } finally { button.disabled = false; }
  }

  function open() {
    if (window.app?.navigateTo) window.app.navigateTo('mizan-pulpit');
    loadPublished();
  }

  function install() {
    if (initialized) return;
    initialized = true;
    document.addEventListener('click', event => {
      const read = event.target.closest('[data-article-id]');
      if (read) openArticle(read.dataset.articleId);
      const contributor = event.target.closest('[data-contributor-id]');
      if (contributor && contributor.dataset.contributorId) openContributorProfile(contributor.dataset.contributorId);
      if (event.target.closest('[data-mizan-submit]')) openSubmit();
      if (event.target.closest('[data-mizan-edit-contributor]')) openContributorEdit();
      if (event.target.closest('[data-mizan-close]')) document.querySelectorAll('.mizan-modal').forEach(m => m.classList.remove('is-open'));
    });
    document.getElementById('mizan-submit-form')?.addEventListener('submit', submitArticle);
    document.getElementById('mizan-contributor-form')?.addEventListener('submit', submitContributor);
    window.mizanPulpit = { open, loadPublished, openSubmit, openContributorEdit, openContributorProfile, getContributor };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();