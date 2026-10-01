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
      const snap = await db.collection(COLLECTION).where('status','==','published').orderBy('publishedAt','desc').limit(30).get();
      if (snap.empty) {
        list.innerHTML = '<div class="mizan-pulpit-empty"><i class="fas fa-feather-pointed"></i><strong>لم تُنشر مشاركات بعد</strong><span>كن من أوائل المساهمين في منبر ميزان.</span></div>';
        return;
      }
      list.innerHTML = snap.docs.map(doc => {
        const a = doc.data() || {};
        return '<article class="mizan-article-card">' +
          '<div class="mizan-article-meta"><span>' + esc(a.type || 'مقالة قانونية') + '</span><time>' + esc(formatDate(a.publishedAt || a.createdAt)) + '</time></div>' +
          '<h3>' + esc(a.title || 'مشاركة قانونية') + '</h3>' +
          '<p>' + esc(a.excerpt || '') + '</p>' +
          '<div class="mizan-article-author"><i class="fas fa-user-tie"></i><span><strong>' + esc(a.authorName || 'كاتب مساهم') + '</strong><small>' + esc(a.authorTitle || 'مساهم في منبر ميزان') + '</small></span></div>' +
          '<button type="button" class="mizan-read-btn" data-article-id="' + esc(doc.id) + '">قراءة المقال ←</button>' +
          '</article>';
      }).join('');
    } catch (error) {
      console.error('Mizan Pulpit load error:', error);
      list.innerHTML = '<div class="mizan-pulpit-empty">تعذر تحميل المشاركات حالياً. حاول مرة أخرى.</div>';
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

  function openSubmit() {
    const auth = window.publicAuth;
    if (!auth?.user) { auth?.openLogin(); return; }
    const modal = document.getElementById('mizan-submit-modal');
    if (modal) modal.classList.add('is-open');
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
      const data = {
        title: form.title.value.trim(),
        type: form.type.value,
        authorName: form.authorName.value.trim(),
        authorTitle: form.authorTitle.value.trim(),
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
      if (event.target.closest('[data-mizan-submit]')) openSubmit();
      if (event.target.closest('[data-mizan-close]')) document.querySelectorAll('.mizan-modal').forEach(m => m.classList.remove('is-open'));
    });
    document.getElementById('mizan-submit-form')?.addEventListener('submit', submitArticle);
    window.mizanPulpit = { open, loadPublished, openSubmit };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();