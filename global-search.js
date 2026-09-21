/* البحث الشامل في المنصة القانونية
 * يبحث في الكتب + الفصول + الأسئلة + القوانين + المحامين + الإجراءات + العرائض.
 * أي مصدر غير موجود حالياً يتم تجاهله تلقائياً، وعند إضافة ملف البيانات لاحقاً يدخل في البحث.
 */
(function () {
  'use strict';

  const DATASETS = [
    { key: 'laws', label: 'القوانين العراقية', icon: '📖', path: 'data/laws/laws.json', action: 'laws' },
    { key: 'lawyers', label: 'دليل المحامين', icon: '👨‍⚖️', path: 'data/lawyers/lawyers.json', action: 'lawyers' },
    { key: 'procedures', label: 'إجراءات الدعاوى', icon: '🏛️', path: 'data/procedures/procedures.json', action: 'procedures' },
    { key: 'petitions', label: 'عرائض وطلبات', icon: '📝', path: 'data/petitions/petitions.json', action: 'petitions' }
  ];

  const state = { timer: null, cache: {}, questionIndex: null };

  function normalize(value) {
    return String(value ?? '')
      .toLocaleLowerCase('ar')
      .replace(/[إأآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ـ/g, '')
      .replace(/[\u064B-\u065F]/g, '')
      .trim();
  }

  function basePath() {
    return window.location.pathname.includes('/exam-platform-v2') ? '/exam-platform-v2' : '';
  }

  function fieldText(obj) {
    if (obj == null) return '';
    if (typeof obj === 'string' || typeof obj === 'number') return String(obj);
    if (Array.isArray(obj)) return obj.map(fieldText).join(' ');
    if (typeof obj === 'object') return Object.entries(obj).map(([k,v]) => {
      if (['url','image','icon','id','uid'].includes(k)) return '';
      return fieldText(v);
    }).join(' ');
    return '';
  }

  function titleOf(obj) {
    if (!obj || typeof obj !== 'object') return String(obj ?? '');
    return obj.title || obj.name || obj.label || obj.full_name || obj.fullName ||
      obj.subject || obj.topic || obj.question || obj.text || obj.description || '';
  }

  async function loadDataset(ds) {
    if (state.cache[ds.key]) return state.cache[ds.key];
    try {
      const res = await fetch(basePath() + '/' + ds.path + '?v=' + Date.now());
      if (!res.ok) return [];
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : Object.values(data).find(Array.isArray) || []);
      state.cache[ds.key] = raw.map((item, i) => ({
        ...item,
        _searchTitle: titleOf(item),
        _searchText: fieldText(item),
        _index: i,
        _dataset: ds.key,
        _label: ds.label,
        _icon: ds.icon,
        _action: ds.action
      }));
      return state.cache[ds.key];
    } catch (_) {
      state.cache[ds.key] = [];
      return [];
    }
  }

  async function buildIndex() {
    const books = Array.isArray(window.app?.books) ? window.app.books : [];
    const results = [];

    books.forEach(book => {
      results.push({
        type: 'book', title: book.title || book.name || 'كتاب',
        subtitle: book.author ? 'المؤلف: ' + book.author : 'اختبارات كتب القانون',
        icon: '📚', action: 'book', bookId: book.id,
        text: normalize(fieldText(book) + ' ' + (book.title || ''))
      });
    });

    if (window.publicAuth?.user) {
      try {
        const questions = state.questionIndex || await window.app.buildQuestionIndex();
        state.questionIndex = questions;
        questions.forEach(q => {
          results.push({
            type: 'question',
            title: q.question || 'سؤال',
            subtitle: '📘 ' + (q.sourceBook || '') + (q.sourceChapter ? ' — الفصل ' + q.sourceChapter : ''),
            icon: '⚖️', action: 'question', question: q,
            text: normalize((q.question || '') + ' ' + (q.sourceBook || '') + ' ' + (q.sourceChapter || ''))
          });
        });
      } catch (_) {}
    }
    const datasets = await Promise.all(DATASETS.map(loadDataset));
    datasets.flat().forEach(item => {
      results.push({
        type: item._dataset,
        title: item._searchTitle || item._label,
        subtitle: item.description || item.author || item.specialization || item.address || item.category || item._label,
        icon: item._icon, action: item._action, item,
        text: normalize(item._searchText)
      });
    });

    return results;
  }

  function score(item, q) {
    const title = normalize(item.title);
    if (title === q) return 100;
    if (title.startsWith(q)) return 80;
    if (title.includes(q)) return 60;
    if (item.text.includes(q)) return 30;
    return 0;
  }

  function groupLabel(type) {
    return {
      book: '📚 الكتب',
      question: '⚖️ الأسئلة',
      laws: '📖 القوانين العراقية',
      lawyers: '👨‍⚖️ دليل المحامين',
      procedures: '🏛️ إجراءات الدعاوى',
      petitions: '📝 العرائض والطلبات'
    }[type] || 'نتائج أخرى';
  }

  function render(results, query) {
    const el = document.getElementById('question-search-results');
    if (!el) return;

    if (!query) {
      el.style.display = 'none';
      el.innerHTML = '';
      if (window.app?.renderBooks) window.app.renderBooks(window.app.books || []);
      return;
    }

    el.style.display = 'block';

    if (query.length < 2) {
      el.innerHTML = '<p class="question-search-loading">اكتب كلمتين على الأقل للبحث في المنصة.</p>';
      return;
    }

    if (!results.length) {
      el.innerHTML = '<div class="global-search-empty">🔎 لا توجد نتائج مطابقة في محتوى المنصة.</div>';
      return;
    }

    const grouped = {};
    results.slice(0, 40).forEach(item => {
      (grouped[item.type] ||= []).push(item);
    });

    let html = '<div class="global-search-header"><span>🔎 نتائج البحث</span><small>' + results.length + ' نتيجة مطابقة</small></div>';
    Object.entries(grouped).forEach(([type, items]) => {
      html += '<div class="global-search-group"><div class="global-search-group-title">' + groupLabel(type) + '</div>';
      html += items.slice(0, 8).map((item, i) => {
        const idx = results.indexOf(item);
        return '<button type="button" class="global-search-item" data-search-index="' + idx + '">' +
          '<span class="global-search-icon">' + item.icon + '</span>' +
          '<span class="global-search-copy"><strong>' + escapeHtml(item.title) + '</strong><small>' + escapeHtml(item.subtitle || '') + '</small></span>' +
          '<span class="global-search-arrow">←</span></button>';
      }).join('');
      html += '</div>';
    });
    el.innerHTML = html;

    el.querySelectorAll('[data-search-index]').forEach(btn => {
      btn.onclick = () => openResult(results[Number(btn.dataset.searchIndex)]);
    });
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  async function perform(query) {
    const normalized = normalize(query);
    if (!normalized) {
      render([], '');
      return;
    }
    if (normalized.length < 2) {
      render([], normalized);
      return;
    }

    const el = document.getElementById('question-search-results');
    if (el) {
      el.style.display = 'block';
      el.innerHTML = '<p class="question-search-loading">🔍 جاري البحث في أقسام المنصة...</p>';
    }

    const index = await buildIndex();
    const matches = index
      .map(item => ({ item, score: score(item, normalized) }))
      .filter(x => x.score > 0)
      .sort((a,b) => b.score - a.score)
      .map(x => x.item);

    render(matches, normalized);
  }

  function search(value) {
    clearTimeout(state.timer);
    const query = String(value ?? '');
    state.timer = setTimeout(() => perform(query), 180);
  }

  async function openResult(result) {
    if (!result) return;

    const input = document.getElementById('search-input');
    if (input) input.value = result.title || '';

    const el = document.getElementById('question-search-results');
    if (el) el.style.display = 'none';

    if (result.action === 'book' && window.app) {
      window.app.navigateTo('books');
      if (typeof window.app.selectBook === 'function') window.app.selectBook(result.bookId);
      return;
    }

    if (result.action === 'question' && window.app) {
      await window.app.openSearchedQuestion(result.question);
      return;
    }

    if (window.app) {
      const section = document.getElementById(result.action + '-section');
      if (section) {
        window.app.navigateTo(result.action);
      } else if (typeof window.app.showHomeNotice === 'function') {
        window.app.showHomeNotice(groupLabel(result.type), 'هذا القسم سيُفتح هنا عند ربط صفحة المحتوى الخاصة به.');
      }
    }
  }

  window.globalSearch = { search, buildIndex, clear: () => {
    state.questionIndex = null;
    state.cache = {};
  } };
})();
