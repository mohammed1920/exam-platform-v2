/**
 * Exam Platform V2 - Main Application
 * تطبيق منصة الاختبارات الرئيسي المحدث بالكامل
 * تم إيقاف الانتقال التلقائي وإصلاح زر الرجوع للهاتف بنجاح
 */

class ExamApp {
  constructor() {
    this.books = [];
    this.currentBook = null;
    this.currentChapter = null;
    this.currentQuestions = [];
    this.examActive = false;
    this.timerInterval = null;
    this.isCustomExam = false;
    this.lastCustomExamParams = null;
    this.init();
  }

  async init() {
    console.log('Initializing Exam App...');
    try {
      await window.publicAuth.whenReady();
      await this.loadBooks();
      this.loadContactInfo();
      this.setupEventListeners();
      this.setupHistoryListener();

      // فحص رابط مباشر (Deep Link) لسؤال محدد — مثلاً رابط ناتج من زر "مشاركة"
      // شكله: ?book=BOOK_ID&chapter=N&qid=QUESTION_ID (أو &q=N كبديل احتياطي بدون id)
      const urlParams = new URLSearchParams(window.location.search);
      const deepBook = urlParams.get('book');
      const deepChapter = urlParams.get('chapter');
      if (deepBook && deepChapter) {
        const qid = urlParams.get('qid');
        const qNumRaw = urlParams.get('q');
        if (!window.publicAuth.user) {
          window.publicAuth.requireAuth(() => this.openDeepLink(
            deepBook,
            parseInt(deepChapter, 10),
            qid,
            qNumRaw ? parseInt(qNumRaw, 10) : null
          ));
          return;
        }
        const opened = await this.openDeepLink(
          deepBook,
          parseInt(deepChapter, 10),
          qid,
          qNumRaw ? parseInt(qNumRaw, 10) : null
        );
        if (opened) return;
        // فشل فتح الرابط (كتاب/فصل غير موجود): ننظف الرابط ونكمل بالمسار العادي بالأسفل
        history.replaceState({ view: 'books' }, '', window.location.pathname);
      }

      // نتحقق هل فيه حالة محفوظة بمتصفح قبل الريفرش (كان الطالب بمنتصف اختبار مثلاً)
      // بدل ما نرجعه دايمًا لقائمة الكتب تلقائيًا
      const savedState = history.state;
      let restored = false;
      if (savedState && savedState.view === 'student-dashboard' && window.publicAuth.user) {
        if (window.studentDashboard && typeof window.studentDashboard.restore === 'function') {
          window.studentDashboard.restore(savedState.dashboardTarget || 'profile', false);
          restored = true;
        }
      }
      if (savedState && savedState.view === 'exam' && !window.publicAuth.user) {
        window.publicAuth.requireAuth(() => this.restoreState(savedState));
        return;
      }
      if (!restored && savedState && savedState.view && savedState.view !== 'books' && savedState.bookId) {
        restored = await this.restoreState(savedState);
      }

      if (!restored) {
        // ما فيه حالة محفوظة صالحة: نبدأ من قائمة الكتب كالمعتاد
        history.replaceState({ view: 'home' }, '');
        this.navigateTo('home', {}, false);
      }
    } catch (error) {
      console.error('Initialization error:', error);
    }
  }

  readExamDrafts() { return window.MizanExamDrafts.read(); }
  saveExamDraft() { return window.MizanExamDrafts.save(this); }
  clearExamDraft() { return window.MizanExamDrafts.clear(this); }
  getExamDraftSummaries() { return window.MizanExamDrafts.summaries(this); }
  deleteExamDraft(draftId) { return window.MizanExamDrafts.delete(this, draftId); }

  async resumeSavedExam(draftId) {
    if (!window.publicAuth || !window.publicAuth.user) return window.publicAuth && window.publicAuth.openLogin();
    const draft = this.readExamDrafts().find(item => item.id === draftId);
    const book = draft && this.books.find(item => item.id === draft.bookId);
    if (!draft || !book) return;
    const success = await examEngine.loadChapter(book.id, draft.chapter);
    if (!success) return alert('تعذر تحميل الاختبار المحفوظ حالياً.');
    this.currentBook = book;
    this.currentChapter = draft.chapter;
    this.currentQuestions = this.prepareChapterQuestions(examEngine.questions);
    examEngine.questions = this.currentQuestions;
    examEngine.userAnswers = Array.isArray(draft.userAnswers) ? draft.userAnswers : [];
    examEngine.score = Number(draft.score) || examEngine.userAnswers.filter(answer => answer.isCorrect).length;
    examEngine.currentQuestionIndex = Math.min(Number(draft.questionIndex) || 0, Math.max(0, examEngine.totalQuestions - 1));
    examEngine.startTime = draft.startedAt ? new Date(draft.startedAt) : new Date();
    this.isCustomExam = false;
    this.examActive = true;
    document.body.classList.add('exam-mode');
    this.navigateTo('exam', { book: book.id, chapter: draft.chapter, resumed: true });
    this.startTimer(Math.max(0, Math.round((Date.now() - examEngine.startTime.getTime()) / 1000)));
    this.renderQuestion();
  }

  async restoreState(state) {
    const book = this.books.find(b => b.id === state.bookId);
    if (!book) return false;
    this.currentBook = book;

    try {
      if (state.view === 'exam' && state.chapter) {
        this.currentChapter = state.chapter;
        const success = await examEngine.loadChapter(book.id, state.chapter);
        if (!success) return false;

        this.currentQuestions = this.prepareChapterQuestions(examEngine.questions);
        examEngine.questions = this.currentQuestions;

        this.examActive = true;
        document.body.classList.add('exam-mode');
        this.navigateTo('exam', {}, false); // false: لا ننشئ سجل تاريخ جديد، الحالة أصلاً موجودة
        this.startTimer();
        this.renderQuestion();
        return true;
      }

      if (state.view === 'chapters') {
        this.navigateTo('chapters', {}, false);
        this.renderChapters();
        return true;
      }

      // حالات ثانية (نتائج/مراجعة): أسلم رجعة لقائمة فصول نفس الكتاب بدل قائمة الكتب بالكامل
      this.navigateTo('chapters', {}, false);
      this.renderChapters();
      return true;
    } catch (err) {
      console.warn('فشل استرجاع الحالة بعد التحديث:', err);
      return false;
    }
  }

  // فتح رابط مباشر لسؤال معين (يستخدمه زر المشاركة). يرجع true لو نجح الفتح.
  async openDeepLink(bookId, chapterNum, qid, qNum) {
    if (!window.publicAuth.user) {
      window.publicAuth.requireAuth(() => this.openDeepLink(bookId, chapterNum, qid, qNum));
      return false;
    }
    const book = this.books.find(b => b.id === bookId);
    if (!book || !chapterNum) return false;

    try {
      const success = await examEngine.loadChapter(book.id, chapterNum);
      if (!success) return false;

      this.currentBook = book;
      this.currentChapter = chapterNum;
      this.currentQuestions = this.prepareChapterQuestions(examEngine.questions);
      examEngine.questions = this.currentQuestions;

      let targetIdx = 0;
      if (qid) {
        const found = this.currentQuestions.findIndex(q => String(q.uid || q.id) === String(qid));
        if (found !== -1) targetIdx = found;
      } else if (qNum && qNum >= 1 && qNum <= this.currentQuestions.length) {
        targetIdx = qNum - 1;
      }
      examEngine.currentQuestionIndex = targetIdx;

      this.isCustomExam = false;
      this.examActive = true;
      document.body.classList.add('exam-mode');

      // ننظف رابط الصفحة من الباراميترات ونثبت حالة تاريخ صحيحة (نفس شكل الحالات العادية)
      history.replaceState({ view: 'exam', bookId: book.id, chapter: chapterNum }, '', window.location.pathname);
      this.navigateTo('exam', {}, false);
      this.startTimer();
      this.renderQuestion();
      return true;
    } catch (err) {
      console.warn('فشل فتح الرابط المباشر:', err);
      return false;
    }
  }

  prepareChapterQuestions(originalQuestions) {
    if (!originalQuestions || !Array.isArray(originalQuestions)) return [];
    
    const questionsCopy = JSON.parse(JSON.stringify(originalQuestions));

    return questionsCopy.map(q => {
      if (!q.options || q.options.length === 0) return q;

      const correctText = q.options[q.answer];

      for (let i = q.options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
      }

      q.answer = q.options.indexOf(correctText);
      return q;
    });
  }

  async loadBooks() {
    this.books = await examEngine.loadBooks();
    this.renderBooks(this.books);
    this.renderHomeBookPreview();
  }

  async loadContactInfo() {
    if (!window.MizanContactInfo) {
      console.error('MizanContactInfo module is not available.');
      return;
    }
    return window.MizanContactInfo.load();
  }

  renderHomeBookPreview() {
    const preview = document.getElementById('home-book-preview-grid');
    const container = document.getElementById('books-container');
    if (!preview || !container) return;

    preview.replaceChildren();
    const cards = Array.from(container.querySelectorAll('.book-card')).slice(0, 3);
    if (!cards.length) {
      const empty = document.createElement('p');
      empty.className = 'home-book-preview-empty';
      empty.textContent = 'ستظهر الكتب المتاحة هنا عند تحميل المكتبة.';
      preview.appendChild(empty);
      return;
    }

    cards.forEach(card => {
      const clone = card.cloneNode(true);
      clone.classList.add('home-book-preview-card');
      clone.setAttribute('aria-label', 'فتح كتاب ' + (clone.querySelector('.card-title')?.textContent || ''));
      clone.addEventListener('click', event => {
        event.preventDefault();
        const button = clone.querySelector('.test-btn');
        const bookId = button?.dataset.bookId;
        if (bookId) this.selectBook(bookId);
      });
      preview.appendChild(clone);
    });
  }

  renderBooks(booksList) {
    const container = document.getElementById('books-container');
    if (!container) return;

    container.innerHTML = '';

    if (!Array.isArray(booksList) || booksList.length === 0) {
      container.innerHTML = `
        <p style="grid-column:1/-1;text-align:center;color:var(--text-secondary);">
          لا توجد كتب مطابقة للبحث
        </p>
      `;
      return;
    }

    // تعريف تدرج الذهب المشترك مرة واحدة فقط لكل الصفحة (تستخدمه كل الأيقونات)
    if (!document.getElementById('bk-gold-grad-defs')) {
      const svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgDefs.id = 'bk-gold-grad-defs';
      svgDefs.setAttribute('style', 'width:0;height:0;position:absolute;');
      svgDefs.setAttribute('aria-hidden', 'true');
      svgDefs.innerHTML = `
        <defs>
          <linearGradient id="bkGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fff0aa" />
            <stop offset="50%" stop-color="#d4af37" />
            <stop offset="100%" stop-color="#aa820a" />
          </linearGradient>
        </defs>
      `;
      document.body.appendChild(svgDefs);
    }

    booksList.forEach(book => {
      const card = document.createElement('div');
      card.className = 'book-card';

      // اللون: تلقائي وثابت حسب معرّف الكتاب (نفس المعرف = نفس اللون دائماً)
      const theme = (typeof getBookTheme === 'function') ? getBookTheme(book.id) : 'blue';
      // الأيقونة: من books.json إن وُجدت (book.icon)، وإلا افتراضية
      const iconSvg = (typeof getBookIconSvg === 'function')
        ? getBookIconSvg(book.icon)
        : '<path d="M12 3V7 M4 8H20 M6 8L3 15 M6 8L9 15 M18 8L15 15 M18 8L21 15 M3 15A3 3 0 0 0 9 15 M15 15A3 3 0 0 0 21 15 M12 7V20 M9 21H15"/>';

      const title = this.escapeHtml(book.title);
      const author = this.escapeHtml(book.author || 'مستشار قانوني');

      card.innerHTML = `
        <div class="stage">
          <div class="bg-watermark"><svg viewBox="0 0 24 24">${iconSvg}</svg></div>
          <div class="top-gold-glow"></div>
          <div class="side-gold-glow"></div>
          <div class="shadow-base"></div>

          <div class="book book-${theme}">
            <div class="front-cover-wrapper">
              <div class="top-ribbon-bookmark"></div>
              <div class="front">
                <div class="gold-frame"></div>
                <div class="gold-frame-inner"></div>
                <div class="corner-ornament c-tl"></div>
                <div class="corner-ornament c-tr"></div>
                <div class="corner-ornament c-bl"></div>
                <div class="corner-ornament c-br"></div>
                <div class="emblem-container">
                  <div class="emblem-ring"></div>
                  <svg class="emblem-icon" viewBox="0 0 24 24">${iconSvg}</svg>
                </div>
                <div class="book-title-front">${title}</div>
              </div>
              <div class="front-inside">
                <div class="front-inside-pattern">منصة الاختبارات القانونية<br>حقوق الطبع محفوظة</div>
              </div>
            </div>

            <div class="flipping-page"></div>

            <div class="inside-page-body">
              <div class="page-border-frame"></div>
              <div class="page-corner p-c-tl"></div>
              <div class="page-corner p-c-tr"></div>
              <div class="page-corner p-c-bl"></div>
              <div class="page-corner p-c-br"></div>
              <div class="inside-page-title">${title}</div>
              <div class="inside-page-text">جاهز للبدء بالاختبار والتحدي؟</div>
            </div>

            <div class="face back"></div>
            <div class="face spine">
              <div class="spine-rib"></div>
              <div class="spine-text">${title}</div>
              <div class="spine-rib"></div>
            </div>
            <div class="face fore-edge"></div>
            <div class="face pages-top"></div>
            <div class="face pages-bottom"></div>
          </div>
        </div>

        <div class="card-title">${title}</div>
        <div class="card-author">${author}</div>
        <div class="book-stats" aria-label="إحصائيات الكتاب">
          <div class="book-stat-badge">
            <span class="book-stat-icon" aria-hidden="true">📚</span>
            <span class="book-stat-value">${book.chapters || 0}</span>
            <span class="book-stat-label">فصل</span>
          </div>
          <div class="book-stat-badge questions-stat">
            <span class="book-stat-icon" aria-hidden="true">❓</span>
            <span class="book-stat-value question-count" data-question-count="${this.escapeHtml(book.id)}">${Number.isFinite(book._questionCount) ? book._questionCount : '…'}</span>
            <span class="book-stat-label">سؤال</span>
          </div>
        </div>
        <button type="button" class="test-btn" data-book-id="${this.escapeHtml(book.id)}">
          <span>دخول الاختبار</span>
          <span class="btn-arrow" aria-hidden="true">←</span>
        </button>
      `;

      // النقر على أي مكان في البطاقة (عدا الزر) يفتح/يغلق الغلاف
      // فتح/إغلاق الغلاف عند الضغط في أي مكان بالبطاقة (عدا زر الدخول للاختبار)
      card.addEventListener('click', (e) => {
        if (e.target.closest('.test-btn')) return;
        card.classList.toggle('is-open');
      });

      const enterButton = card.querySelector('.test-btn');
      if (enterButton) {
        enterButton.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectBook(book.id);
        });
      }

      container.appendChild(card);
    });
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.innerText = str || '';
    return div.innerHTML;
  }

  filterBooks() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const filtered = this.books.filter(b => 
      b.title.toLowerCase().includes(query) || 
      (b.description && b.description.toLowerCase().includes(query))
    );
    this.renderBooks(filtered);

    const resultsEl = document.getElementById('question-search-results');
    if (!resultsEl) return;

    if (query.length < 3) {
      resultsEl.style.display = 'none';
      resultsEl.innerHTML = '';
      return;
    }

    if (!window.publicAuth.user) {
      resultsEl.style.display = 'none';
      resultsEl.innerHTML = '';
      return;
    }

    clearTimeout(this._questionSearchDebounce);
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = '<p class="question-search-loading">🔍 جاري البحث بالأسئلة...</p>';

    this._questionSearchDebounce = setTimeout(async () => {
      try {
        const index = await this.buildQuestionIndex();
        const matches = index.filter(q => (q.question || '').toLowerCase().includes(query)).slice(0, 25);
        this.renderQuestionSearchResults(matches);
      } catch (e) {
        resultsEl.innerHTML = '<p class="question-search-loading">تعذّر تحميل فهرس الأسئلة.</p>';
      }
    }, 350);
  }

  async searchQuestions(query, limit = 25) {
    const normalized = String(query || '').trim();
    if (normalized.length < 2) return [];

    const response = await fetch(`/api/search-questions?q=${encodeURIComponent(normalized)}&limit=${Math.min(25, Math.max(1, Number(limit) || 25))}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) throw new Error('تعذر البحث في الأسئلة');
    const data = await response.json();

    return (Array.isArray(data.questions) ? data.questions : []).map(q => ({
      id: q.id || null,
      uid: q.uid || q.id || null,
      question: q.question || '',
      sourceBook: q.bookTitle || '',
      sourceBookId: q.bookId || null,
      sourceChapter: Number(q.chapter) || 0
    }));
  }

  async buildQuestionIndex() {
    // توافق مع الوحدات القديمة: البحث الفعلي أصبح عبر API ولا يحمل ملفات الفصول.
    return [];
  }

  renderQuestionSearchResults(matches) {
    const el = document.getElementById('question-search-results');
    if (!el) return;

    if (matches.length === 0) {
      el.innerHTML = '<p class="question-search-loading">لا توجد أسئلة مطابقة.</p>';
      return;
    }

    el.innerHTML = `<div class="question-search-header">🔍 أسئلة مطابقة (${matches.length})</div>` +
      matches.map((q, i) => `
        <div class="question-search-item" data-idx="${i}">
          <div class="question-search-text">${this.escapeHtml(q.question)}</div>
          <div class="question-search-source">📘 ${this.escapeHtml(q.sourceBook)} — الفصل ${q.sourceChapter}</div>
        </div>
      `).join('');

    el.querySelectorAll('.question-search-item').forEach(item => {
      item.onclick = () => {
        const idx = parseInt(item.dataset.idx, 10);
        this.openSearchedQuestion(matches[idx]);
      };
    });
  }

  async openSearchedQuestion(matchedQuestion) {
    if (!window.publicAuth.user) {
      window.publicAuth.requireAuth(() => this.openSearchedQuestion(matchedQuestion));
      return;
    }
    const book = matchedQuestion.sourceBookId
      ? this.books.find(b => b.id === matchedQuestion.sourceBookId)
      : this.books.find(b => b.title === matchedQuestion.sourceBook);
    if (!book) {
      alert('تعذر تحديد الكتاب المصدر لهذا السؤال.');
      return;
    }

    const success = await examEngine.loadChapter(book.id, matchedQuestion.sourceChapter);
    if (!success) {
      alert('تعذر فتح الفصل الخاص بهذا السؤال.');
      return;
    }

    this.currentBook = book;
    this.currentChapter = matchedQuestion.sourceChapter;
    this.currentQuestions = this.prepareChapterQuestions(examEngine.questions);
    examEngine.questions = this.currentQuestions;

    const targetKey = matchedQuestion.uid || matchedQuestion.id;
    const targetIdx = this.currentQuestions.findIndex(q => (q.uid || q.id) === targetKey);
    examEngine.currentQuestionIndex = targetIdx !== -1 ? targetIdx : 0;

    this.isCustomExam = false;
    this.examActive = true;
    document.body.classList.add('exam-mode');
    this.navigateTo('exam', { book: book.id, chapter: matchedQuestion.sourceChapter });
    this.startTimer();
    this.renderQuestion();
  }

  selectBook(bookId) {
    const book = this.books.find(b => b.id === bookId);
    if (!book) return;
    this.currentBook = book;
    this.navigateTo('chapters', { book: bookId });
    this.renderChapters();
  }

  renderChapters() {
    const header = document.getElementById('chapters-header');
    const container = document.getElementById('chapters-container');
    if (!header || !container) return;

    header.innerHTML = `<h2>${this.escapeHtml(this.currentBook.title)}</h2><p>اختر الفصل الذي تريد بدء امتحانه:</p>`;
    container.innerHTML = '';

    const chapterCount = Number(this.currentBook.chapters) || 0;
    const chapterMeta = Array.isArray(this.currentBook._chapterMeta)
      ? this.currentBook._chapterMeta
      : [];

    const chapters = Array.from({ length: chapterCount }, (_, index) => {
      const chapterNum = index + 1;
      const meta = chapterMeta.find(item => Number(item.number) === chapterNum) || {};
      return {
        chapterNum,
        topic: String(meta.title || meta.topic || `أسئلة مخصصة لـ الفصل ${chapterNum}`),
        questionCount: Number.isFinite(Number(meta.questionCount)) ? Number(meta.questionCount) : null
      };
    });

    chapters.forEach(({ chapterNum, topic, questionCount }) => {
      const item = document.createElement('div');
      item.className = 'chapter-item';

      const countText = questionCount === null ? '— سؤال' : `${questionCount} سؤال`;

      item.innerHTML = `
        <div class="chapter-info">
          <div class="chapter-number">الفصل ${chapterNum}</div>
          <p data-chapter-topic="${chapterNum}">${this.escapeHtml(topic)}</p>
          <span class="chapter-question-count" aria-label="عدد أسئلة الفصل">${countText}</span>
        </div>

        <button class="exam-btn next chapter-start-btn"
                onclick="app.startExam(${chapterNum})"
                type="button">
          <span>ابدأ</span>
          <span class="chapter-start-icon" aria-hidden="true">🚀</span>
        </button>
      `;

      container.appendChild(item);
    });
  }

  async startExam(chapterNum) {
    if (!window.publicAuth.user) {
      window.publicAuth.requireAuth(() => this.startExam(chapterNum));
      return;
    }
    this.currentChapter = chapterNum;
    const success = await examEngine.loadChapter(this.currentBook.id, chapterNum);
    if (!success) {
      alert('عذراً، لم يتم العثور على أسئلة لهذا الفصل بعد.');
      return;
    }

    this.currentQuestions = this.prepareChapterQuestions(examEngine.questions);
    examEngine.questions = this.currentQuestions;
    
    this.isCustomExam = false;
    this.examActive = true;
    document.body.classList.add('exam-mode');
    this.navigateTo('exam', { book: this.currentBook.id, chapter: chapterNum });
    this.startTimer();
    this.saveExamDraft();
    this.renderQuestion();
  }

  // ---------- الاختبار العشوائي الشامل (من عدة كتب) ----------

  showCustomExamSetup() {
    if (!window.publicAuth.user) {
      window.publicAuth.requireAuth(() => this.showCustomExamSetup());
      return;
    }
    this.navigateTo('custom-exam-setup');
    this.renderCustomExamSetup();
  }

  renderCustomExamSetup() {
    const container = document.getElementById('custom-exam-books-list');
    if (!container) return;

    if (this.books.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary);">لا توجد كتب متاحة حاليًا.</p>';
      return;
    }

    container.innerHTML = this.books.map(book => {
      const chapterCount = Number(book.chapters) || (Array.isArray(book._chapterMeta) ? book._chapterMeta.length : 0);
      const questionCount = Number(book._questionCount) || 0;
      return `
        <label class="custom-exam-book-option">
          <input type="checkbox" value="${this.escapeHtml(book.id)}" class="custom-exam-book-checkbox">
          <span>${this.escapeHtml(book.title)}
            <small>(${chapterCount} فصل • ${questionCount.toLocaleString('ar-IQ')} سؤال)</small>
          </span>
        </label>
      `;
    }).join('');
  }

  // يجلب أقل عدد ممكن من الفصول اللازمة للاختبار العشوائي.
  // الاختيار يتم من خلال فهرس خفيف، ثم تُحمّل الفصول المختارة فقط وبشكل متسلسل.
  async fetchRandomBookQuestions(selectedBooks, questionCount) {
    const candidates = [];

    selectedBooks.forEach(book => {
      const chapters = Array.isArray(book._chapterMeta) ? book._chapterMeta : [];
      chapters.forEach(meta => {
        const number = Number(meta.number);
        const count = Number(meta.questionCount) || 0;
        if (number > 0 && count > 0) {
          candidates.push({ book, chapter: number, questionCount: count });
        }
      });
    });

    // احتياط للبيانات القديمة: إذا لم يتوفر فهرس الفصل، نستخدم أرقام الفصول فقط.
    if (candidates.length === 0) {
      selectedBooks.forEach(book => {
        const totalChapters = Number(book.chapters) || 0;
        for (let chapter = 1; chapter <= totalChapters; chapter++) {
          candidates.push({ book, chapter, questionCount: 1 });
        }
      });
    }

    let remaining = candidates.slice();
    const plan = [];

    // اختيار موزون حسب عدد أسئلة الفصل: الفصل الأكبر لديه فرصة أكبر أن يغطي الطلب
    // وبالتالي نقلل عدد الملفات المطلوبة دون التضحية بالعشوائية.
    while (remaining.length && plan.reduce((sum, item) => sum + item.questionCount, 0) < questionCount) {
      const totalWeight = remaining.reduce((sum, item) => sum + Math.max(1, item.questionCount), 0);
      let cursor = Math.random() * totalWeight;
      let selectedIndex = remaining.length - 1;
      for (let i = 0; i < remaining.length; i++) {
        cursor -= Math.max(1, remaining[i].questionCount);
        if (cursor <= 0) {
          selectedIndex = i;
          break;
        }
      }
      plan.push(remaining[selectedIndex]);
      remaining.splice(selectedIndex, 1);
    }

    const pool = [];
    const seen = new Set();
    for (const item of plan) {
      const data = await examEngine.fetchChapterData(item.book.id, item.chapter);
      if (!data) continue;
      const questions = data.questions || (Array.isArray(data) ? data : []);
      questions.forEach(q => {
        const key = q.uid || q.id || `${item.book.id}::${item.chapter}::${q.question || q.q || ''}`;
        if (seen.has(key)) return;
        seen.add(key);
        pool.push({ ...q, sourceBook: item.book.title, sourceChapter: item.chapter });
      });
      if (pool.length >= questionCount) break;
    }

    return pool;
  }

  async handleCustomExamStart() {
    const checkedIds = Array.from(document.querySelectorAll('.custom-exam-book-checkbox:checked')).map(cb => cb.value);
    const countInput = document.getElementById('custom-exam-count');
    const count = parseInt(countInput ? countInput.value : '', 10);

    if (checkedIds.length === 0) {
      alert('اختر كتاب واحد على الأقل.');
      return;
    }
    if (!count || count < 1) {
      alert('أدخل عدد أسئلة صحيح (رقم أكبر من صفر).');
      return;
    }

    await this.startCustomExam(checkedIds, count);
  }

  async startCustomExam(selectedBookIds, questionCount) {
    if (!window.publicAuth.user) {
      window.publicAuth.requireAuth(() => this.startCustomExam(selectedBookIds, questionCount));
      return;
    }
    const selectedBooks = this.books.filter(b => selectedBookIds.includes(b.id));
    if (selectedBooks.length === 0) {
      alert('اختر كتاب واحد على الأقل.');
      return;
    }

    const startBtn = document.getElementById('custom-exam-start-btn');
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.innerText = '⏳ جاري التحضير...';
    }

    try {
      const availableCount = selectedBooks.reduce((sum, book) => sum + (Number(book._questionCount) || 0), 0);
      if (availableCount < 1) {
        alert('عذراً، لا تتوفر بيانات أسئلة للكتب المختارة حالياً.');
        return;
      }

      const requestedCount = Math.min(questionCount, availableCount);
      if (requestedCount < questionCount) {
        alert(`تنبيه: الكتب المختارة تحتوي ${availableCount.toLocaleString('ar-IQ')} سؤال فقط، سيتم استخدام ${requestedCount.toLocaleString('ar-IQ')} سؤال.`);
      }

      const pool = await this.fetchRandomBookQuestions(selectedBooks, requestedCount);
      if (pool.length === 0) {
        alert('عذراً، تعذر تحميل الأسئلة المطلوبة حالياً.');
        return;
      }

      // خلط عشوائي كامل للأسئلة التي تم تحميلها فقط، وليس لكل كتب المنصة.
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      const finalCount = Math.min(requestedCount, pool.length);
      if (finalCount < requestedCount) {
        alert(`تعذر تحميل العدد الكامل بسبب ملفات غير متاحة. سيتم استخدام ${finalCount} سؤال.`);
      }
      const selectedQuestions = pool.slice(0, finalCount);

      this.lastCustomExamParams = { bookIds: selectedBookIds, count: questionCount };
      this.isCustomExam = true;
      this.currentBook = { id: 'custom-exam', title: 'اختبار عشوائي مخصص', chapters: 0 };
      this.currentChapter = null;

      const prepared = this.prepareChapterQuestions(selectedQuestions);
      examEngine.loadCustomQuestions(prepared);
      this.currentQuestions = examEngine.questions;

      this.examActive = true;
      document.body.classList.add('exam-mode');
      this.navigateTo('exam', { custom: true });
      this.startTimer();
      this.renderQuestion();
    } finally {
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.innerText = '🚀 ابدأ الاختبار';
      }
    }
  }

  renderQuestion() {
    if (!window.publicAuth.user) {
      this.backToBooks();
      window.publicAuth.openLogin();
      return;
    }
    const container = document.getElementById('question-container');
    const title = document.getElementById('exam-book-chapter');
    const fill = document.getElementById('progress-fill');
    if (!container || !title || !fill) return;

    const qIdx = examEngine.currentQuestionIndex;
    const total = examEngine.questions.length;
    const q = examEngine.questions[qIdx];

    title.innerText = (this.isCustomExam && q.sourceBook)
      ? `${q.sourceBook} - الفصل ${q.sourceChapter}`
      : `${this.currentBook.title} - الفصل ${this.currentChapter}`;
    fill.style.width = `${((qIdx + 1) / total) * 100}%`;

    // تحديث شريط الإحصائيات (خطأ / صح / التقدم)
    const correctCount = examEngine.userAnswers.filter(a => a.isCorrect).length;
    const wrongCount = examEngine.userAnswers.filter(a => !a.isCorrect).length;
    const statWrong = document.getElementById('stat-wrong');
    const statCorrect = document.getElementById('stat-correct');
    const statProgress = document.getElementById('stat-progress');
    if (statWrong) statWrong.innerText = wrongCount;
    if (statCorrect) statCorrect.innerText = correctCount;
    if (statProgress) statProgress.innerText = `${qIdx + 1}/${total}`;

    // uid هو المعرف الأساسي للسؤال، وid هو البديل عند عدم وجود uid.
    // لا نستخدم نص السؤال لأنه قد يتكرر في أكثر من سؤال.
    const questionUid = q.uid || null;
    const questionId = q.id || null;
    const pastAns = examEngine.userAnswers.find(a => {
      if (questionUid) return a.questionUid === questionUid;
      if (questionId) return a.questionId === questionId;
      return false;
    });

    container.innerHTML = `
      <div class="question-card">
        <span class="question-label">⚖️ السؤال ${qIdx + 1} من ${total}</span>
        <div class="question-text">${this.escapeHtml(q.question)}</div>
      </div>
      <div class="options-list">
        ${q.options.map((opt, i) => {
          let extraClass = '';
          if (pastAns) {
            if (opt === pastAns.userAnswer && !pastAns.isCorrect) extraClass = 'incorrect';
            if (opt === pastAns.correctAnswer) extraClass = 'correct';
          }
          const classNames = ['option-btn'];
          if (extraClass) classNames.push(extraClass);
          if (pastAns) classNames.push('disabled');
          return `<button class="${classNames.join(' ')}"${pastAns ? ' disabled' : ''} onclick="app.handleAnswer(${i}, this)">${this.escapeHtml(opt)}</button>`;
        }).join('')}
      </div>
    `;

    document.getElementById('prev-btn').style.visibility = qIdx === 0 ? 'hidden' : 'visible';
    document.getElementById('next-btn').innerText = qIdx === total - 1 ? 'إنهاء الاختبار 🏁' : 'السؤال التالي';
  }

  // ---------- مشاركة السؤال (بطاقة صورة + رابط مباشر) ----------

  async shareQuestion() { return window.MizanQuestionSharing.shareQuestion(this); }

  handleAnswer(optIdx, btnEl) {
    if (!window.publicAuth.user) {
      this.backToBooks();
      window.publicAuth.openLogin();
      return;
    }
    const isCorrect = examEngine.submitAnswer(optIdx);
    const q = examEngine.questions[examEngine.currentQuestionIndex];
    
    const allButtons = btnEl.parentElement.querySelectorAll('.option-btn');
    allButtons.forEach(b => b.disabled = true);

    if (isCorrect) {
      btnEl.classList.add('correct');
    } else {
      btnEl.classList.add('incorrect');
      allButtons[q.answer].classList.add('correct');
    }

    // تحديث فوري لعدّاد الصح/الخطأ بشريط الإحصائيات فور الإجابة
    const correctCount = examEngine.userAnswers.filter(a => a.isCorrect).length;
    const wrongCount = examEngine.userAnswers.filter(a => !a.isCorrect).length;
    const statWrong = document.getElementById('stat-wrong');
    const statCorrect = document.getElementById('stat-correct');
    if (statWrong) statWrong.innerText = wrongCount;
    if (statCorrect) statCorrect.innerText = correctCount;
    this.saveExamDraft();
    // تم حذف الـ setTimeout نهائياً لمنع الانتقال التلقائي بناءً على طلبك
  }

  nextQuestion() {
    const hasNext = examEngine.nextQuestion();
    if (hasNext) {
      this.saveExamDraft();
      this.renderQuestion();
    } else {
      this.endExam();
    }
  }

  prevQuestion() {
    if (examEngine.currentQuestionIndex > 0) {
      examEngine.currentQuestionIndex--;
      this.saveExamDraft();
      this.renderQuestion();
    }
  }

  endExam() {
    clearInterval(this.timerInterval);
    this.examActive = false;
    document.body.classList.remove('exam-mode');
    const res = examEngine.finishExam();
    this.clearExamDraft();

    this.navigateTo('results', { book: this.currentBook.id, chapter: this.currentChapter, status: 'done' });
    
    document.getElementById('result-grade').innerText = `${res.grade.emoji} ${res.grade.grade}`;
    document.getElementById('result-score').innerText = `النتيجة: ${res.score} / ${res.totalQuestions}`;
    document.getElementById('result-percent').innerText = `${res.percentage}%`;
    
    const mins = Math.floor(res.duration / 60);
    const secs = res.duration % 60;
    document.getElementById('result-time').innerText = mins > 0 ? `${mins} دقيقة و ${secs} ثانية` : `${secs} ثانية`;
  }

  showReview() {
    if (!window.publicAuth.user) {
      window.publicAuth.requireAuth(() => this.showReview());
      return;
    }
    const wrong = examEngine.getWrongAnswers();
    if (wrong.length === 0) {
      alert('تهانينا! لا توجد لديك أي إجابات خاطئة لمراجعتها.');
      return;
    }
    this.navigateTo('review', { book: this.currentBook.id, chapter: this.currentChapter, view: 'review' });
    const content = document.getElementById('review-content');
    content.innerHTML = '';

    wrong.forEach((ans, idx) => {
      const item = document.createElement('div');
      item.className = 'review-item';
      item.innerHTML = `
        <div class="review-question"><strong>س${idx + 1}:</strong> ${this.escapeHtml(ans.questionText)}</div>
        <div class="review-answer incorrect">❌ إجابتك: ${this.escapeHtml(ans.userAnswer)}</div>
        <div class="review-answer correct">✔ الإجابة الصحيحة: ${this.escapeHtml(ans.correctAnswer)}</div>
        ${ans.explanation ? `<div class="review-explanation"><strong>📚 الشرح:</strong> ${this.escapeHtml(ans.explanation)}</div>` : ''}
      `;
      content.appendChild(item);
    });
  }

  restartExam() {
    if (this.isCustomExam && this.lastCustomExamParams) {
      this.startCustomExam(this.lastCustomExamParams.bookIds, this.lastCustomExamParams.count);
    } else {
      this.startExam(this.currentChapter);
    }
  }

  backToBooks() {
    this.saveExamDraft();
    clearInterval(this.timerInterval);
    this.examActive = false;
    document.body.classList.remove('exam-mode');
    this.isCustomExam = false;
    this.currentBook = null;
    this.currentChapter = null;
    this.navigateTo('books');
    this.renderBooks(this.books);
  }

  backToHome() {
    this.saveExamDraft();
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.examActive = false;
    document.body.classList.remove('exam-mode');
    this.isCustomExam = false;
    this.currentBook = null;
    this.currentChapter = null;
    this.navigateTo('home');
  }

  startTimer(initialSeconds = 0) {
    clearInterval(this.timerInterval);
    const el = document.getElementById('exam-timer');
    let sec = Math.max(0, Number(initialSeconds) || 0);
    el.innerText = `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
    this.timerInterval = setInterval(() => {
      sec++;
      const m = Math.floor(sec / 60).toString().padStart(2, '0');
      const s = (sec % 60).toString().padStart(2, '0');
      el.innerText = `${m}:${s}`;
    }, 1000);
  }

  // شجرة التنقل: الرئيسية هي الجذر، وكل قسم رئيسي يبدأ مساراً جديداً.
  // الأقسام الفرعية ترجع دائماً إلى الأب المباشر فقط.
  getNavigationParent(viewId) {
    const parents = {
      chapters: 'books',
      exam: 'chapters',
      results: 'home',
      review: 'home',
      'custom-exam-setup': 'home',
      'student-dashboard': 'home',
      lawyers: 'home',
      petitions: 'home',
      contact: 'home',
      about: 'home',
      terms: 'home',
      privacy: 'home',
      disclaimer: 'home',
      faq: 'home',
      'mizan-pulpit': 'home',
      'mizan-article': 'mizan-pulpit',
      'firebase-admin': 'home'
    };
    return parents[viewId] || null;
  }

  isTopLevelView(viewId) {
    return new Set([
      'home',
      'books',
      'custom-exam-setup',
      'student-dashboard',
      'lawyers',
      'petitions',
      'contact',
      'about',
      'terms',
      'privacy',
      'disclaimer',
      'faq',
      'mizan-pulpit',
      'firebase-admin'
    ]).has(viewId);
  }

  navigateTo(viewId, params = {}, pushState = true) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    const home = document.querySelector('.platform-home');
    if (home) home.style.display = viewId === 'home' ? '' : 'none';
    const section = document.getElementById(`${viewId}-section`);
    if (section) section.classList.add('active');

    if (pushState) {
      const state = {
        view: viewId,
        bookId: this.currentBook ? this.currentBook.id : null,
        chapter: this.currentChapter,
        ...params
      };

      const currentView = history.state?.view || 'home';
      const parentView = this.getNavigationParent(viewId);

      if (viewId === 'home') {
        // الرئيسية دائماً جذر: لا نسمح بتراكم صفحات خلفها.
        history.replaceState(state, '', window.location.href);
      } else if (parentView && !this.isTopLevelView(viewId)) {
        // قسم فرعي:
        // مثال الكتب -> الفصول، ثم الفصول -> الاختبار.
        // نضع الأب في مكان الصفحة الحالية ثم نضيف الفرعي.
        const parentState = {
          view: parentView,
          bookId: (parentView === 'books' || parentView === 'chapters') && this.currentBook ? this.currentBook.id : null,
          chapter: parentView === 'chapters' ? null : (parentView === 'books' ? this.currentChapter : null)
        };
        history.replaceState(parentState, '', window.location.href);
        history.pushState(state, '', window.location.href);
      } else if (this.isTopLevelView(viewId)) {
        if (currentView === 'home') {
          // الرئيسية -> قسم رئيسي: زر الرجوع يرجع للرئيسية.
          history.pushState(state, '', window.location.href);
        } else {
          // من أي قسم إلى قسم رئيسي آخر:
          // نبدأ مساراً جديداً، لذلك الرجوع يكون للرئيسية وليس للقسم السابق.
          history.replaceState(state, '', window.location.href);
        }
      } else {
        history.pushState(state, '', window.location.href);
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }


  setupEventListeners() {
    document.getElementById('back-to-books').onclick = () => this.backToBooks();
    document.getElementById('back-books-btn').onclick = () => this.backToBooks();
    document.getElementById('back-from-review').onclick = () => {
      if (this.isCustomExam) {
        this.backToBooks();
      } else if (this.currentBook) {
        this.navigateTo('chapters');
        this.renderChapters();
      } else {
        this.backToBooks();
      }
    };
    document.getElementById('prev-btn').onclick = () => this.prevQuestion();
    document.getElementById('next-btn').onclick = () => this.nextQuestion();

    const shareBtn = document.getElementById('share-question-btn');
    if (shareBtn) shareBtn.onclick = () => this.shareQuestion();

    const examHomeBtn = document.getElementById('exam-home-btn');
    if (examHomeBtn) examHomeBtn.onclick = () => this.backToBooks();
    document.getElementById('restart-exam-btn').onclick = () => this.restartExam();
    document.getElementById('review-exam-btn').onclick = () => this.showReview();
    document.getElementById('search-input').oninput = () => { if (window.globalSearch && typeof window.globalSearch.search === 'function') window.globalSearch.search(document.getElementById('search-input').value); else this.filterBooks(); };

    const customExamEntryBtn = document.getElementById('custom-exam-entry-btn');
    if (customExamEntryBtn) customExamEntryBtn.onclick = () => this.showCustomExamSetup();

    const customExamBackBtn = document.getElementById('custom-exam-back-btn');
    if (customExamBackBtn) customExamBackBtn.onclick = () => this.navigateTo('home');

    const customExamStartBtn = document.getElementById('custom-exam-start-btn');
    if (customExamStartBtn) customExamStartBtn.onclick = () => this.handleCustomExamStart();
  }

  // مستمع أحداث زر الرجوع الفيزيائي للهاتف
  setupHistoryListener() {
    window.onpopstate = (event) => {
      const state = event.state;
      const view = state && state.view;

      // إذا خرجنا من الاختبار، نوقف المؤقت ونحفظ المسودة.
      if (view !== 'exam' && this.timerInterval) {
        this.saveExamDraft();
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.examActive = false;
        document.body.classList.remove('exam-mode');
      }

      if (view === 'home') {
        this.currentBook = null;
        this.currentChapter = null;
        this.navigateTo('home', {}, false);
      } else if (view === 'books') {
        this.currentBook = null;
        this.currentChapter = null;
        this.navigateTo('books', {}, false);
        this.renderBooks(this.books);
      } else if (view === 'chapters') {
        if (state.bookId) {
          this.currentBook = this.books.find(b => b.id === state.bookId) || this.currentBook;
        }
        this.currentChapter = null;
        this.navigateTo('chapters', {}, false);
        this.renderChapters();
      } else if (view === 'exam') {
        if (!window.publicAuth.user) {
          window.publicAuth.requireAuth(() => this.restoreState(state));
          return;
        }
        this.navigateTo('exam', {}, false);
        this.renderQuestion();
      } else if (view === 'petitions') {
        this.navigateTo('petitions', {}, false);
        if (window.petitions && typeof window.petitions.renderHome === 'function') window.petitions.renderHome();
      } else if (view === 'custom-exam-setup') {
        this.isCustomExam = false;
        this.navigateTo('custom-exam-setup', {}, false);
        this.renderCustomExamSetup();
      } else if (view === 'student-dashboard') {
        if (window.studentDashboard && typeof window.studentDashboard.restore === 'function') {
          window.studentDashboard.restore(state.dashboardTarget || 'profile', false);
        } else {
          this.navigateTo('student-dashboard', {}, false);
        }
      } else if (view === 'firebase-admin') {
        if (window.firebaseAdminPanel?.isAdmin === true) {
          this.navigateTo('firebase-admin', {}, false);
          window.firebaseAdminPanel.open();
        } else {
          this.navigateTo('home', {}, false);
        }
      } else if (view === 'results' || view === 'review') {
        this.navigateTo(view, {}, false);
      } else if (
        view === 'lawyers' ||
        view === 'petitions' ||
        view === 'contact' ||
        view === 'about' ||
        view === 'terms' ||
        view === 'privacy' ||
        view === 'disclaimer' ||
        view === 'faq'
      ) {
        this.navigateTo(view, {}, false);
      } else {
        // أي حالة غير معروفة ترجع إلى الرئيسية.
        this.currentBook = null;
        this.currentChapter = null;
        this.navigateTo('home', {}, false);
      }
    };
  }
}

window.app = new ExamApp();
