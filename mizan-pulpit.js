/* منبر ميزان — مقالات وأبحاث ومساهمات أهل الاختصاص. */
(function () {
  'use strict';

  const COLLECTION = 'mizanArticles';
  let initialized = false;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const ARTICLE_TAGS = new Set(['DIV','P','BR','STRONG','B','EM','I','U','H2','H3','H4','UL','OL','LI','BLOCKQUOTE']);
  const ARTICLE_COLORS = new Set(['#0f172a','#1d4ed8','#047857','#b45309','#b91c1c','#6d28d9']);
  function normalizeArticleColor(raw) {
    const value = String(raw || '').trim().toLowerCase();
    if (ARTICLE_COLORS.has(value)) return value;
    const rgb = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);
    if (!rgb) return '';
    const hex = '#'+rgb.slice(1).map(part => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2,'0')).join('');
    return ARTICLE_COLORS.has(hex) ? hex : '';
  }
  function sanitizeArticleHtml(value) {
    const input = String(value ?? '');
    if (!input.includes('<')) return esc(input).replace(/\r?\n/g, '<br>');
    const parsed = new DOMParser().parseFromString(input, 'text/html');
    const cleanNode = node => {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue || '');
      if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
      const tag = node.tagName.toUpperCase();
      if (['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH','FORM','INPUT','BUTTON','IMG','VIDEO','AUDIO'].includes(tag)) return document.createDocumentFragment();
      const children = document.createDocumentFragment();
      Array.from(node.childNodes).forEach(child => children.append(cleanNode(child)));
      if (!ARTICLE_TAGS.has(tag)) return children;
      const el = document.createElement(tag.toLowerCase());
      if (node.hasAttribute('style')) {
        const colorMatch = node.getAttribute('style').match(/(?:^|;)\s*color\s*:\s*(#[0-9a-f]{6}|rgb\([^)]*\))\s*(?:;|$)/i);
        const color = normalizeArticleColor(colorMatch?.[1]);
        if (color) el.style.color = color;
        const bgMatch = node.getAttribute('style').match(/(?:^|;)\s*background-color\s*:\s*(#[0-9a-f]{6}|rgb\([^)]*\))\s*(?:;|$)/i);
        const bg = normalizeArticleColor(bgMatch?.[1]);
        if (bg) el.style.backgroundColor = bg;
        const align = node.getAttribute('style').match(/(?:^|;)\s*text-align\s*:\s*(left|right|center|justify)\s*(?:;|$)/i)?.[1]?.toLowerCase();
        if (align) el.style.textAlign = align;
      }
      el.append(children);
      return el;
    };
    const out = document.createElement('div');
    Array.from(parsed.body.childNodes).forEach(node => out.append(cleanNode(node)));
    return out.innerHTML;
  }
  function editorFor(form) { return form?.querySelector('[data-mizan-editor]'); }
  function setEditorContent(form, value) {
    const editor = editorFor(form);
    if (editor) editor.innerHTML = sanitizeArticleHtml(value);
    if (form?.elements?.content) form.elements.content.value = String(value ?? '');
  }
  function readEditorContent(form) {
    const editor = editorFor(form);
    const value = editor ? sanitizeArticleHtml(editor.innerHTML) : String(form?.elements?.content?.value || '');
    if (form?.elements?.content) form.elements.content.value = value;
    return value;
  }
  function initArticleEditor(form) {
    const editor = editorFor(form);
    if (!editor || editor.dataset.initialized) return;
    editor.dataset.initialized = 'true';
    form.querySelectorAll('[data-editor-command]').forEach(button => {
      button.addEventListener('click', () => {
        editor.focus();
        const command = button.dataset.editorCommand;
        if (command === 'formatBlock') document.execCommand(command, false, button.dataset.editorValue || 'p');
        else document.execCommand(command, false, null);
        form.elements.content.value = readEditorContent(form);
      });
    });
    form.querySelectorAll('[data-editor-color]').forEach(button => {
      button.addEventListener('click', () => {
        editor.focus();
        document.execCommand(button.dataset.editorBackground === 'true' ? 'hiliteColor' : 'foreColor', false, button.dataset.editorColor);
        form.elements.content.value = readEditorContent(form);
      });
    });
    editor.addEventListener('input', () => { form.elements.content.value = readEditorContent(form); });
    editor.addEventListener('paste', event => {
      event.preventDefault();
      const text = (event.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });
    setEditorContent(form, form.elements.content?.value || '');
  }


  function formatDate(value) {
    if (!value) return '';
    const date = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ar-IQ', {year:'numeric', month:'long', day:'numeric'});
  }

  function openMizanModal(modal) {
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const focusTarget = modal.querySelector('.mizan-modal-close, .mizan-profile-close, input, select, textarea, button');
    focusTarget?.focus();
  }

  function closeMizanModal(modal) {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  let publishedArticlesCache = null;
  const articleHtmlCache = new Map();
  const articleRequests = new Map();

  function getArticleUrl(id) {
    const currentUrl = new URL(window.location.href);
    if (id) return new URL('/pulpit/' + encodeURIComponent(id), currentUrl.origin).href;
    currentUrl.searchParams.delete('article');
    if (/^\/pulpit\/[^/]+\/?$/.test(currentUrl.pathname)) currentUrl.pathname = '/';
    return currentUrl.href;
  }

  async function shareArticle(id, title) {
    const url = getArticleUrl(id);
    const shareData = {
      title: title || 'مقال من منبر ميزان',
      text: (title || 'مقال من منبر ميزان') + ' — منبر ميزان',
      url
    };

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      window.app?.showHomeNotice?.('رابط المقال', 'تم نسخ رابط المقال لمشاركته.');
    } catch (_) {
      window.prompt('انسخ رابط المقال لمشاركته:', url);
    }
  }

  function renderPublishedArticles(list, docs) {
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
        '<div class="mizan-article-card-footer"><button type="button" class="mizan-read-btn" data-article-id="' + esc(doc.id) + '"><i class="fas fa-book-open"></i> قراءة المقال</button>' +
        '<button type="button" class="mizan-article-author" data-contributor-id="' + esc(a.authorUid || '') + '" ' + (a.authorUid ? '' : 'disabled') + '><i class="fas fa-user-tie"></i><span><strong>' + esc(a.authorName || 'كاتب مساهم') + '</strong><small>' + esc(a.authorTitle || 'مساهم في منبر ميزان') + '</small></span></button></div>' +
        '</article>';
    }).join('');
  }

  async function loadPublished() {
    const db = window.publicAuth?.firestore;
    const list = document.getElementById('mizan-pulpit-list');
    if (!list) return;

    if (publishedArticlesCache !== null) {
      renderPublishedArticles(list, publishedArticlesCache);
      return;
    }

    if (!db) {
      list.innerHTML = '<div class="mizan-pulpit-empty">يتعذر تحميل المنبر حالياً.</div>';
      return;
    }

    list.innerHTML = '<div class="mizan-pulpit-loading"><i class="fas fa-spinner fa-spin"></i> جارٍ تحميل المشاركات...</div>';

    try {
      const snap = await db.collection(COLLECTION).where('status','==','published').limit(50).get();
      publishedArticlesCache = snap.docs
        .sort((a,b) => {
          const av = a.data()?.publishedAt?.toDate?.()?.getTime?.() || 0;
          const bv = b.data()?.publishedAt?.toDate?.()?.getTime?.() || 0;
          return bv - av;
        })
        .slice(0,30);

      renderPublishedArticles(list, publishedArticlesCache);
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
      modal.querySelector('.mizan-profile-close').setAttribute('data-mizan-profile-close', '');
      modal.setAttribute('aria-labelledby', 'mizan-profile-title');
      modal.querySelector('h2').id = 'mizan-profile-title';
      modal.querySelector('.mizan-profile-close').onclick = () => closeMizanModal(modal);
      openMizanModal(modal);
    } catch (error) {
      console.error('Mizan contributor profile error:', error);
    }
  }

  async function openArticle(id, options = {}) {
    const page = document.getElementById('mizan-article-section');
    if (!page) return;
    const cachedHtml = articleHtmlCache.get(id);
    page.innerHTML = cachedHtml || '<div class="mizan-article-page-loading"><i class="fas fa-spinner fa-spin"></i><span>جارٍ فتح المقال...</span></div>';
    if (window.app?.navigateTo) {
      window.app.navigateTo('mizan-article', { articleId: id }, !options.fromUrl);
    }
    const articleLocation = options.fromUrl
      ? new URL('/?article=' + encodeURIComponent(id), window.location.origin).href
      : getArticleUrl(id);
    history.replaceState(
      { ...(history.state || {}), view: 'mizan-article', articleId: id },
      '',
      articleLocation
    );
    if (cachedHtml) {
      page.querySelectorAll('[data-mizan-article-back]').forEach(btn => {
        btn.onclick = () => window.mizanPulpit?.open();
      });
      window.scrollTo({top:0, behavior:'smooth'});
      return;
    }
    if (articleRequests.has(id)) {
      try { await articleRequests.get(id); } catch (_) {}
      return;
    }
    try {
      const request = fetch('/api/article?id=' + encodeURIComponent(id) + '&format=json', {
        headers: { Accept: 'application/json' },
        cache: 'default'
      });
      articleRequests.set(id, request);
      const response = await request;
      if (!response.ok) {
        if (articleRequests.get(id) === request) articleRequests.delete(id);
        page.innerHTML = '<div class="mizan-article-page-error"><i class="fas fa-circle-exclamation"></i><strong>تعذر فتح المقال؛ قد يكون غير منشور أو الاتصال بطيئاً.</strong><button type="button" data-mizan-article-back>العودة إلى المشاركات</button></div>';
        page.querySelector('[data-mizan-article-back]')?.addEventListener('click', () => window.mizanPulpit?.open());
        return;
      }
      const a = await response.json();
      if (articleRequests.get(id) === request) articleRequests.delete(id);
      const doc = { id, data: () => a, exists: true };
      page.innerHTML =
        '<div class="mizan-article-page">' +
          '<div class="mizan-article-page-topbar">' +
            '<button type="button" class="mizan-article-back" data-mizan-article-back><i class="fas fa-arrow-right"></i><span>العودة إلى المشاركات</span></button>' +
            '<span class="mizan-article-page-label"><i class="fas fa-feather-pointed"></i> منبر ميزان</span>' +
            '<button type="button" class="mizan-article-share" data-mizan-share-article="' + esc(doc.id) + '" data-article-title="' + esc(a.title || 'مقال من منبر ميزان') + '"><i class="fas fa-share-nodes"></i><span>مشاركة المقال</span></button>' +
          '</div>' +
          '<article class="mizan-article-reading">' +
            '<div class="mizan-article-reading-meta"><span>' + esc(a.type || 'مقالة قانونية') + '</span><time>' + esc(formatDate(a.publishedAt || a.createdAt)) + '</time></div>' +
            '<h1>' + esc(a.title || 'مشاركة قانونية') + '</h1>' +
            '<button type="button" class="mizan-article-reading-author" data-contributor-id="' + esc(a.authorUid || '') + '"' + (a.authorUid ? '' : ' disabled') + ' aria-label="عرض بروفايل المساهم"><div class="mizan-article-reading-avatar"><i class="fas fa-user-tie"></i></div><div><strong>' + esc(a.authorName || 'كاتب مساهم') + '</strong><span>' + esc(a.authorTitle || 'مساهم في منبر ميزان') + '</span></div><i class="fas fa-chevron-left mizan-author-profile-arrow"></i></button>' +
            (a.excerpt ? '<div class="mizan-article-reading-excerpt">' + esc(a.excerpt) + '</div>' : '') +
            '<div class="mizan-article-reading-content">' + sanitizeArticleHtml(a.content || '') + '</div>' +
            '<div class="mizan-article-reading-footer"><span>نُشر في منبر ميزان</span><button type="button" class="mizan-article-back" data-mizan-article-back><i class="fas fa-arrow-right"></i> العودة إلى المشاركات</button></div>' +
          '</article>' +
        '</div>';
      page.querySelectorAll('[data-mizan-article-back]').forEach(btn => {
        btn.onclick = () => window.mizanPulpit?.open();
      });
      articleHtmlCache.set(id, page.innerHTML);
      window.scrollTo({top:0, behavior:'smooth'});
    } catch (error) {
      articleRequests.delete(id);
      console.error('Mizan article open error:', error);
      page.innerHTML = '<div class="mizan-article-page-error"><i class="fas fa-circle-exclamation"></i><strong>تعذر تحميل المقال حالياً.</strong><button type="button" data-mizan-article-back>العودة إلى المشاركات</button></div>';
      page.querySelector('[data-mizan-article-back]')?.addEventListener('click', () => window.mizanPulpit?.open());
    }
  }

  function articleStatusLabel(status) {
    return ({published:'منشور', pending:'قيد المراجعة', rejected:'مرفوض', hidden:'مخفي'})[status] || 'غير محدد';
  }

  async function loadMyArticles() {
    const db = window.publicAuth?.firestore, user = window.publicAuth?.user;
    const list = document.getElementById('mizan-my-articles-list');
    if (!list) return;
    if (!user) { window.publicAuth?.openLogin(); return; }
    if (!db) { list.innerHTML = '<div class="mizan-pulpit-empty">يتعذر تحميل مقالاتك حالياً.</div>'; return; }
    list.innerHTML = '<div class="mizan-pulpit-loading"><i class="fas fa-spinner fa-spin"></i> جارٍ تحميل مقالاتك...</div>';
    try {
      const snap = await db.collection(COLLECTION).where('authorUid', '==', user.uid).limit(50).get();
      const docs = snap.docs.sort((a,b) => {
        const av = a.data()?.updatedAt?.toDate?.()?.getTime?.() || a.data()?.createdAt?.toDate?.()?.getTime?.() || 0;
        const bv = b.data()?.updatedAt?.toDate?.()?.getTime?.() || b.data()?.createdAt?.toDate?.()?.getTime?.() || 0;
        return bv - av;
      });
      if (!docs.length) {
        list.innerHTML = '<div class="mizan-pulpit-empty"><strong>لا توجد مقالات مرتبطة بحسابك</strong><span>عندما ترسل مشاركة ستظهر هنا لمتابعتها وتعديلها.</span></div>';
        return;
      }
      list.innerHTML = docs.map(doc => {
        const a = doc.data() || {};
        return '<article class="mizan-my-article-card"><div class="mizan-my-article-info"><span class="mizan-my-article-status" data-status="' + esc(a.status || '') + '">' + esc(articleStatusLabel(a.status)) + '</span><h4>' + esc(a.title || 'مشاركة بلا عنوان') + '</h4><small>آخر تحديث: ' + esc(formatDate(a.updatedAt || a.createdAt) || '—') + '</small></div><div class="mizan-my-article-actions"><button type="button" data-mizan-edit-article="' + esc(doc.id) + '"><i class="fas fa-pen"></i> تعديل</button><button type="button" class="mizan-my-article-delete" data-mizan-delete-article="' + esc(doc.id) + '"><i class="fas fa-trash"></i> حذف</button></div></article>';
      }).join('');
    } catch (error) {
      console.error('Mizan my articles load error:', error);
      list.innerHTML = '<div class="mizan-pulpit-empty">تعذر تحميل مقالاتك. تحقق من تسجيل الدخول ثم حاول مجدداً.</div>';
    }
  }

  async function openEditArticle(id) {
    const auth = window.publicAuth, db = auth?.firestore, user = auth?.user;
    if (!user || !db) { auth?.openLogin(); return; }
    const form = document.getElementById('mizan-submit-form'), modal = document.getElementById('mizan-submit-modal');
    if (!form || !modal) return;
    try {
      const snap = await db.collection(COLLECTION).doc(id).get();
      if (!snap.exists || snap.data()?.authorUid !== user.uid) { alert('لا يمكنك تعديل هذه المشاركة.'); return; }
      const article = snap.data() || {};
      form.dataset.editArticleId = id;
      form.type.value = article.type || 'مقالة قانونية';
      form.title.value = article.title || '';
      form.excerpt.value = article.excerpt || '';
      form.content.value = article.content || '';
      initArticleEditor(form);
      setEditorContent(form, article.content || '');
      form.authorName.value = article.authorName || '';
      form.authorTitle.value = article.authorTitle || '';
      form.authorSpecialization.value = article.authorSpecialization || '';
      const heading = modal.querySelector('.mizan-modal-head h3'), help = modal.querySelector('[data-mizan-submit-help]'), submit = form.querySelector('button[type="submit"]');
      if (heading) heading.textContent = 'تعديل المشاركة';
      if (help) help.textContent = article.status === 'published' ? 'سيظهر تعديلك مباشرة على المقال المنشور، دون تغيير رابط المقال أو حالة نشره.' : 'سيتم حفظ التعديلات مع الاحتفاظ بحالة المشاركة الحالية.';
      if (submit) submit.textContent = 'حفظ التعديلات';
      openMizanModal(modal);
    } catch (error) {
      console.error('Mizan article edit load error:', error);
      alert('تعذر فتح المقال للتعديل حالياً.');
    }
  }

  async function deleteMyArticle(id) {
    const db = window.publicAuth?.firestore, user = window.publicAuth?.user;
    if (!db || !user) return window.publicAuth?.openLogin();
    if (!window.confirm('هل أنت متأكد من حذف هذه المشاركة؟ لا يمكن التراجع عن الحذف.')) return;
    try {
      const ref = db.collection(COLLECTION).doc(id), snap = await ref.get();
      if (!snap.exists || snap.data()?.authorUid !== user.uid) { alert('لا يمكنك حذف هذه المشاركة.'); return; }
      await ref.delete();
      articleHtmlCache.delete(id);
      articleRequests.delete(id);
      publishedArticlesCache = null;
      await loadMyArticles();
      await loadPublished();
      window.app?.showHomeNotice?.('تم حذف المشاركة', 'حُذفت المشاركة من منبر ميزان.');
    } catch (error) {
      console.error('Mizan article delete error:', error);
      alert('تعذر حذف المشاركة. تحقق من الاتصال ثم حاول مرة أخرى.');
    }
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
    openMizanModal(modal);
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
    openMizanModal(modal);
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
        delete form.dataset.editArticleId;
        form.reset();
        const heading = modal.querySelector('.mizan-modal-head h3'), help = modal.querySelector('[data-mizan-submit-help]'), submit = form.querySelector('button[type="submit"]');
        if (heading) heading.textContent = 'إرسال مشاركة إلى منبر ميزان';
        if (help) help.textContent = 'أرسل مقالة أو بحثاً أو فكرة قانونية. تبقى المشاركة الجديدة قيد المراجعة ولا تُنشر إلا بعد اعتمادها من الإدارة.';
        if (submit) submit.textContent = 'إرسال للمراجعة';
        if(form.authorName) form.authorName.value=contributor.fullName||auth.user.displayName||'';
        if(form.authorTitle) form.authorTitle.value=contributor.role||'';
        if(form.authorSpecialization) form.authorSpecialization.value=contributor.specialization||'';
      }
      openMizanModal(modal);
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
      closeMizanModal(document.getElementById('mizan-contributor-modal'));
      const isUpdate=!!existing;
      window.app?.showHomeNotice?.(isUpdate?'تم تحديث بياناتك':'تم إرسال طلب الانضمام', isUpdate?'تم حفظ بيانات المساهم بنجاح.':'سيتم مراجعة بياناتك من إدارة منبر ميزان.');
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
      const editId = form.dataset.editArticleId;
      const articleContent = readEditorContent(form).trim();
      const editable = { title: form.title.value.trim(), type: form.type.value, excerpt: form.excerpt.value.trim(), content: articleContent };
      if (!editable.title || !editable.content) throw new Error('missing');
      if (editId) {
        const ref = db.collection(COLLECTION).doc(editId), current = await ref.get();
        if (!current.exists || current.data()?.authorUid !== user.uid) throw new Error('not-owner');
        await ref.update({...editable, updatedAt: firebase.firestore.FieldValue.serverTimestamp()});
        articleHtmlCache.delete(editId);
        articleRequests.delete(editId);
        publishedArticlesCache = null;
        delete form.dataset.editArticleId;
        closeMizanModal(document.getElementById('mizan-submit-modal'));
        window.app?.showHomeNotice?.('تم تحديث المشاركة', current.data()?.status === 'published' ? 'تم حفظ التعديلات وظهرت مباشرة على المقال المنشور.' : 'تم حفظ التعديلات مع الاحتفاظ بحالة المشاركة الحالية.');
        await loadMyArticles();
        await loadPublished();
      } else {
        const contributor = await getContributor();
        if (!contributor || contributor.status !== 'approved') { await openSubmit(); return; }
        const data = {
          ...editable,
          authorName: contributor.fullName || user.displayName || '',
          authorTitle: contributor.role || '',
          authorSpecialization: contributor.specialization || '',
          authorUid: user.uid,
          authorEmail: user.email || null,
          status: 'pending',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (!data.authorName) throw new Error('missing');
        await db.collection(COLLECTION).add(data);
        form.reset();
        setEditorContent(form, '');
        closeMizanModal(document.getElementById('mizan-submit-modal'));
        window.app?.showHomeNotice?.('تم استلام المشاركة', 'ستظهر بعد مراجعتها واعتمادها من إدارة المنصة.');
      }
    } catch (error) {
      console.error('Mizan Pulpit submit error:', error);
      alert('تعذر إرسال المشاركة حالياً. حاول مرة أخرى.');
    } finally { button.disabled = false; }
  }

  function open() {
    if (window.location.search.includes('article=') || /^\/pulpit\/[^/]+\/?$/.test(window.location.pathname)) {
      history.replaceState({ ...(history.state || {}), articleId: null, view: 'mizan-pulpit' }, '', getArticleUrl(null));
    }
    if (window.app?.navigateTo) window.app.navigateTo('mizan-pulpit');
    loadPublished();
  }

  function openArticleFromUrl(id) {
    if (id) return openArticle(id, { fromUrl: true });
  }

  function install() {
    if (initialized) return;
    initialized = true;
    document.addEventListener('click', event => {
      const editArticle = event.target.closest('[data-mizan-edit-article]');
      if (editArticle) { openEditArticle(editArticle.dataset.mizanEditArticle); return; }
      const deleteArticle = event.target.closest('[data-mizan-delete-article]');
      if (deleteArticle) { deleteMyArticle(deleteArticle.dataset.mizanDeleteArticle); return; }
      const myArticlesToggle = event.target.closest('[data-mizan-my-articles-toggle]');
      if (myArticlesToggle) {
        const panel = document.getElementById('mizan-my-articles-panel');
        const show = panel?.hidden !== false;
        if (panel) panel.hidden = !show;
        myArticlesToggle.setAttribute('aria-expanded', String(show));
        if (show) loadMyArticles();
        return;
      }
      const share = event.target.closest('[data-mizan-share-article]');
      if (share) {
        shareArticle(share.dataset.mizanShareArticle, share.dataset.articleTitle);
        return;
      }
      const read = event.target.closest('[data-article-id]');
      if (read) openArticle(read.dataset.articleId);
      const contributor = event.target.closest('[data-contributor-id]');
      if (contributor && contributor.dataset.contributorId) openContributorProfile(contributor.dataset.contributorId);
      if (event.target.closest('[data-mizan-submit]')) openSubmit();
      if (event.target.closest('[data-mizan-edit-contributor]')) openContributorEdit();
      const closeButton = event.target.closest('[data-mizan-close]');
      if (closeButton) closeMizanModal(closeButton.closest('.mizan-modal'));
      if (event.target.matches('.mizan-modal')) closeMizanModal(event.target);
      if (event.target.closest('[data-mizan-profile-close]')) closeMizanModal(document.getElementById('mizan-contributor-profile-modal'));
      if (event.target.id === 'mizan-contributor-profile-modal') closeMizanModal(event.target);
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('.mizan-modal.is-open, #mizan-contributor-profile-modal.is-open').forEach(closeMizanModal);
    });
    const articleForm = document.getElementById('mizan-submit-form');
    if (articleForm) { initArticleEditor(articleForm); articleForm.addEventListener('submit', submitArticle); }
    document.getElementById('mizan-contributor-form')?.addEventListener('submit', submitContributor);
    window.mizanPulpit = { open, loadPublished, loadMyArticles, openSubmit, openContributorEdit, openContributorProfile, openArticleFromUrl, getContributor };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();