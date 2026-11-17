/* البحث الشامل في المنصة القانونية
 * يبحث في الكتب + الفصول + الأسئلة + القوانين + المحامين + الإجراءات + العرائض.
 * أي مصدر غير موجود حالياً يتم تجاهله تلقائياً، وعند إضافة ملف البيانات لاحقاً يدخل في البحث.
 */
(function () {
  'use strict';

  const state = {
    timer: null,
    requestId: 0
  };

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

  async function buildIndex(query) {
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

    if (window.publicAuth?.user && typeof window.app?.searchQuestions === 'function') {
      try {
        const questions = await window.app.searchQuestions(query, 25);
        questions.forEach(q => results.push({
          type: 'question',
          title: q.question || 'سؤال',
          subtitle: '📘 ' + (q.sourceBook || '') + (q.sourceChapter ? ' — الفصل ' + q.sourceChapter : ''),
          icon: '⚖️', action: 'question', question: q,
          text: normalize((q.question || '') + ' ' + (q.sourceBook || '') + ' ' + (q.sourceChapter || ''))
        }));
      } catch (_) {}
    }

    // Load only the lightweight section modules when the user actually searches.
    // Their own search-index methods remain responsible for fetching public indexes,
    // never full detail documents or protected content.
    const [lawsApi, lawyersApi, petitionsApi] = await Promise.all([
      window.mizanLaws ? Promise.resolve(window.mizanLaws) : window.loadMizanLaws?.().catch(() => null),
      window.lawyerDirectory ? Promise.resolve(window.lawyerDirectory) : window.loadLawyerDirectory?.().catch(() => null),
      window.petitions ? Promise.resolve(window.petitions) : window.loadPetitions?.().catch(() => null)
    ]);
    const [lawRegistry, lawyerProfiles, procedureIndex, petitionIndex] = await Promise.all([
      lawsApi?.loadRegistry?.().catch(() => null),
      lawyersApi?.loadSearchProfiles?.().catch(() => []),
      window.procedures?.loadSearchIndex?.().catch(() => []),
      petitionsApi?.loadSearchIndex?.().catch(() => [])
    ]);

    (Array.isArray(lawRegistry?.laws) ? lawRegistry.laws : []).forEach(law => {
      results.push({
        type: 'laws', title: law.name || 'قانون',
        subtitle: law.category || 'تشريع عراقي',
        icon: '📖', action: 'laws', item: law,
        text: normalize([law.name, law.category, law.description].filter(Boolean).join(' '))
      });
    });

    (Array.isArray(lawyerProfiles) ? lawyerProfiles : []).forEach(profile => {
      results.push({
        type: 'lawyers', title: profile.name || 'محامٍ',
        subtitle: [profile.governorate, profile.district, (profile.specializations || []).join('، ')].filter(Boolean).join(' — '),
        icon: '👨‍⚖️', action: 'lawyer-profile', item: profile,
        text: normalize([profile.name, profile.governorate, profile.district, profile.office, profile.address, (profile.specializations || []).join(' ')].filter(Boolean).join(' '))
      });
    });

    (Array.isArray(procedureIndex) ? procedureIndex : []).forEach(item => {
      results.push({
        type: 'procedures', title: item.title || 'إجراء قانوني',
        subtitle: item.summary || item.categoryTitle || 'إجراءات الدعاوى',
        icon: '🏛️', action: 'procedures', item,
        text: normalize([item.title, item.categoryTitle, item.summary].filter(Boolean).join(' '))
      });
    });

    (Array.isArray(petitionIndex) ? petitionIndex : []).forEach(item => {
      results.push({
        type: 'petitions', title: item.name || 'نموذج عريضة',
        subtitle: item.description || item.category || 'عرائض وطلبات',
        icon: '📝', action: 'petitions', item,
        text: normalize([item.name, item.category, item.description].filter(Boolean).join(' '))
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

  async function perform(query, requestId) {
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

    const index = await buildIndex(normalized);
    if (requestId !== state.requestId) return;

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
    const requestId = ++state.requestId;
    state.timer = setTimeout(() => perform(query, requestId), 180);
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

    if (result.action === 'lawyer-profile' && result.item?.id && window.lawyerDirectory?.openProfile) {
      window.lawyerDirectory.openProfile(result.item.id);
      return;
    }
    if (result.action === 'procedures' && window.procedures?.open) {
      await window.procedures.open();
      return;
    }
    if (result.action === 'petitions' && window.petitions?.open) {
      await window.petitions.open();
      return;
    }
    if (result.action === 'laws' && window.mizanLaws?.open) {
      window.mizanLaws.open();
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
    clearTimeout(state.timer);
    state.requestId += 1;
  } };
})();
