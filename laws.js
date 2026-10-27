/* نظام عرض القوانين العراقية — تحميل عند الطلب دون Firestore. */
(function () {
  'use strict';

  const REGISTRY_URL = 'data/laws/laws.json';
  const sectionId = 'laws-section';
  let registryPromise = null;
  const lawCache = new Map();
  let currentLaw = null;
  let currentLawMeta = null;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function section() { return document.getElementById(sectionId); }

  function loadRegistry() {
    if (!registryPromise) {
      registryPromise = fetch(REGISTRY_URL, { cache: 'default' })
        .then(response => {
          if (!response.ok) throw new Error('تعذر تحميل فهرس القوانين');
          return response.json();
        })
        .then(data => {
          if (!data || !Array.isArray(data.laws)) throw new Error('تنسيق فهرس القوانين غير صحيح');
          return data;
        })
        .catch(error => { registryPromise = null; throw error; });
    }
    return registryPromise;
  }

  function loadLaw(meta) {
    if (lawCache.has(meta.id)) return Promise.resolve(lawCache.get(meta.id));
    return fetch(meta.file, { cache: 'default' })
      .then(response => {
        if (!response.ok) throw new Error('تعذر تحميل ملف القانون');
        return response.json();
      })
      .then(data => {
        if (!data || data.id !== meta.id || !Array.isArray(data.articles)) {
          throw new Error('ملف القانون غير مكتمل أو لا يطابق الفهرس');
        }
        lawCache.set(meta.id, data);
        return data;
      });
  }

  function renderLawList() {
    const target = section();
    if (!target) return;
    target.innerHTML = `
      <div class="laws-page">
        <header class="laws-page-header">
          <div class="laws-heading-icon" aria-hidden="true"><i class="fas fa-scale-balanced"></i></div>
          <h1>القوانين العراقية</h1>
        </header>
        <div class="laws-list-toolbar">
          <div><h2>التشريعات المتاحة</h2></div>
          <span class="laws-count" data-laws-count>—</span>
        </div>
        <div class="laws-list" data-laws-list><div class="laws-loading" role="status">جارٍ تحميل فهرس القوانين…</div></div>
      </div>`;
    loadRegistry().then(data => {
      const list = target.querySelector('[data-laws-list]');
      const count = target.querySelector('[data-laws-count]');
      if (!list || !count) return;
      count.textContent = String(data.laws.length) + ' قانون';
      if (!data.laws.length) {
        list.innerHTML = `
          <div class="laws-empty-state">
            <div class="laws-empty-icon"><i class="fas fa-book-open"></i></div>
            <h3>مكتبة القوانين قيد التجهيز</h3>
            <p>تم تجهيز القسم لاستقبال ملفات القوانين. سيظهر كل قانون هنا تلقائياً بعد إضافة بياناته إلى فهرس القوانين.</p>
            <span>الخطوة التالية: إضافة دستور جمهورية العراق لعام 2005</span>
          </div>`;
        return;
      }
      list.innerHTML = data.laws.map(law => `
        <button type="button" class="laws-card" data-law-id="${escapeHtml(law.id)}">
          <span class="laws-card-icon"><i class="fas fa-scale-balanced"></i></span>
          <span class="laws-card-copy"><strong>${escapeHtml(law.name)}</strong><small>${escapeHtml(law.category || 'تشريع عراقي')}${Number.isInteger(law.articlesCount) ? ' · ' + law.articlesCount + ' مادة' : ''}</small></span>
          <span class="laws-card-arrow" aria-hidden="true"><i class="fas fa-chevron-left"></i></span>
        </button>`).join('');
      list.querySelectorAll('[data-law-id]').forEach(button => {
        button.addEventListener('click', () => {
          const meta = data.laws.find(item => item.id === button.dataset.lawId);
          if (meta) openLaw(meta);
        });
      });
    }).catch(() => {
      const list = target.querySelector('[data-laws-list]');
      if (list) list.innerHTML = '<div class="laws-error" role="alert">تعذر تحميل فهرس القوانين. تحقق من الاتصال ثم أعد المحاولة.</div>';
    });
  }

  function openLaw(meta) {
    currentLawMeta = meta;
    const target = section();
    if (!target) return;
    target.innerHTML = `
      <div class="laws-page">
        <div class="laws-top-actions"><button type="button" class="laws-back-btn" data-laws-list-back><i class="fas fa-arrow-right"></i> قائمة القوانين</button></div>
        <header class="laws-detail-header">
          <div class="laws-detail-heading">
            <div class="laws-heading-icon" aria-hidden="true"><i class="fas fa-scale-balanced"></i></div>
            <h1>${escapeHtml(meta.name)}</h1>
          </div>
          <p class="laws-subtitle">${escapeHtml(meta.description || 'اختر طريقة الاطلاع على نص القانون')}</p>
        </header>
        <div class="laws-choice-grid">
          <button type="button" class="laws-choice-card" data-law-read><span><i class="fas fa-book-open"></i></span><strong>قراءة القانون كاملًا</strong><small>عرض الديباجة والمواد بالتسلسل</small></button>
          <form class="laws-choice-card laws-search-form" data-law-search-form>
            <label for="laws-article-number"><span><i class="fas fa-magnifying-glass"></i></span><strong>البحث برقم مادة</strong></label>
            <small>انتقل مباشرةً إلى المادة المطلوبة</small>
            <div class="laws-search-row"><input id="laws-article-number" name="article" type="number" min="1" step="1" inputmode="numeric" placeholder="رقم المادة" required><button type="submit">بحث</button></div>
          </form>
        </div>
        <div class="laws-content" data-law-content><div class="laws-loading" role="status">سيتم تحميل نص القانون عند اختيار القراءة أو البحث عن مادة.</div></div>
      </div>`;
    target.querySelector('[data-laws-list-back]').addEventListener('click', renderLawList);
    target.querySelector('[data-law-read]').addEventListener('click', () => loadAndRender(meta, null));
    target.querySelector('[data-law-search-form]').addEventListener('submit', event => {
      event.preventDefault();
      const number = Number(new FormData(event.currentTarget).get('article'));
      if (!Number.isInteger(number) || number < 1) return;
      loadAndRender(meta, number);
    });
  }

  function renderArticle(article) {
    const text = Array.isArray(article.paragraphs) ? article.paragraphs.join('\\n\\n') : (article.text || '');
    return `
      <article class="law-article" id="law-article-${Number(article.number)}">
        <div class="law-article-heading"><span>المادة (${Number(article.number)})</span><button type="button" data-copy-article="${Number(article.number)}" aria-label="نسخ نص المادة"><i class="fas fa-copy"></i><span>نسخ</span></button></div>
        ${article.title ? '<h3>' + escapeHtml(article.title) + '</h3>' : ''}
        <div class="law-article-text">${escapeHtml(text)}</div>
      </article>`;
  }

  function bindCopyButtons(target) {
    target.querySelectorAll('[data-copy-article]').forEach(button => {
      button.addEventListener('click', async () => {
        const article = currentLaw?.articles.find(item => Number(item.number) === Number(button.dataset.copyArticle));
        if (!article) return;
        const text = 'المادة (' + article.number + ')\\n' + (article.text || (article.paragraphs || []).join('\\n'));
        try {
          await navigator.clipboard.writeText(text);
          button.querySelector('span').textContent = 'تم النسخ';
          setTimeout(() => { const label = button.querySelector('span'); if (label) label.textContent = 'نسخ'; }, 1400);
        } catch {
          const field = document.createElement('textarea');
          field.value = text;
          field.setAttribute('readonly', '');
          field.style.position = 'fixed';
          field.style.opacity = '0';
          document.body.appendChild(field);
          field.select();
          const copied = document.execCommand('copy');
          field.remove();
          button.querySelector('span').textContent = copied ? 'تم النسخ' : 'تعذر النسخ';
        }
      });
    });
  }

  function loadAndRender(meta, articleNumber) {
    const target = section();
    const content = target?.querySelector('[data-law-content]');
    if (!content) return;
    content.innerHTML = '<div class="laws-loading" role="status">جارٍ تحميل نص القانون…</div>';
    loadLaw(meta).then(data => {
      currentLaw = data;
      const articles = [...data.articles].sort((a, b) => Number(a.number) - Number(b.number));
      if (articleNumber !== null) {
        const article = articles.find(item => Number(item.number) === articleNumber);
        if (!article) {
          content.innerHTML = '<div class="laws-error" role="status">لم يُعثر على المادة المطلوبة في هذا القانون.</div>';
          return;
        }
        content.innerHTML = '<div class="laws-results-heading">نتيجة البحث</div>' + renderArticle(article);
        bindCopyButtons(content);
        content.querySelector('.law-article')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const preamble = data.preamble ? '<section class="law-preamble"><h2>الديباجة</h2><div>' + escapeHtml(data.preamble) + '</div></section>' : '';
      const contentsIndex = articles.length
        ? '<form class="law-contents-index" aria-label="الانتقال إلى مادة"><label for="law-article-number">الانتقال إلى رقم المادة</label><div class="law-contents-search"><input id="law-article-number" name="articleNumber" type="number" min="1" max="' +
          Math.max(...articles.map(article => Number(article.number) || 0)) + '" step="1" inputmode="numeric" placeholder="اكتب رقم المادة" required><button type="submit">انتقال</button></div><p class="law-contents-status" role="status" aria-live="polite">عدد المواد: ' +
          articles.length + '</p></form>'
        : '';
      const closing = data.closing || data.conclusion || data.epilogue;
      const closingMarkup = typeof closing === 'string' && closing.trim()
        ? '<section class="law-closing"><h2>الخاتمة</h2><div>' + escapeHtml(closing) + '</div></section>'
        : '';
      content.innerHTML = '<div class="laws-reading-toolbar"><strong>نص القانون</strong><span>' + articles.length + ' مادة</span></div>' +
        preamble + contentsIndex + articles.map(renderArticle).join('') + closingMarkup;
      const contentsForm = content.querySelector('.law-contents-index');
      contentsForm?.addEventListener('submit', event => {
        event.preventDefault();
        const input = contentsForm.querySelector('input[name="articleNumber"]');
        const status = contentsForm.querySelector('.law-contents-status');
        const number = Number(input.value);
        const article = articles.find(item => Number(item.number) === number);
        if (!article) {
          status.textContent = 'لم يُعثر على المادة رقم ' + number + ' في هذا القانون.';
          input.setAttribute('aria-invalid', 'true');
          return;
        }
        input.removeAttribute('aria-invalid');
        status.textContent = 'تم العثور على المادة (' + number + ').';
        content.querySelector('#law-article-' + number)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      bindCopyButtons(content);
    }).catch(() => {
      content.innerHTML = '<div class="laws-error" role="alert">تعذر تحميل ملف هذا القانون. تحقق من مسار ملف JSON وصحة تنسيقه.</div>';
    });
  }

  function open() {
    if (window.app?.navigateTo) window.app.navigateTo('laws');
    renderLawList();
  }

  window.mizanLaws = { open, loadRegistry, loadLaw };
})();
