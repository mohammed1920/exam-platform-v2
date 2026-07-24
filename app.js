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
      await this.loadBooks();
      await this.loadContactInfo();
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
      if (savedState && savedState.view && savedState.view !== 'books' && savedState.bookId) {
        restored = await this.restoreState(savedState);
      }

      if (!restored) {
        // ما فيه حالة محفوظة صالحة: نبدأ من قائمة الكتب كالمعتاد
        history.replaceState({ view: 'books' }, '');
        this.navigateTo('books', {}, false);
      }
    } catch (error) {
      console.error('Initialization error:', error);
    }
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
        const found = this.currentQuestions.findIndex(q => String(q.id) === String(qid));
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
    window.examEngine = new ExamEngine();
    this.books = await examEngine.loadBooks();
    this.renderBooks(this.books);
  }

  async loadContactInfo() {
    try {
      const basePath = window.location.pathname.includes('/exam-platform-v2') ? '/exam-platform-v2' : '';
      const res = await fetch(`${basePath}/data/contact.json?v=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        this.renderContactInfo(data);
      }
    } catch (e) {
      console.error('Contact loading failed:', e);
    }
  }

  renderContactInfo(data) {
    if (!data) return;
    const footerContact = document.getElementById('footerContactDetails');
    const footerLinks = document.getElementById('footerSocialButtons');
    
    if (footerContact) {
      let contactHtml = '';
      if (data.phone) {
        contactHtml += `<a href="tel:${data.phone}"><i class="fas fa-phone"></i> ${data.phone}</a>`;
      }
      if (data.email) {
        contactHtml += ` | <a href="mailto:${data.email}"><i class="fas fa-envelope"></i> ${data.email}</a>`;
      }
      footerContact.innerHTML = contactHtml;
    }
    
    if (footerLinks && data.social_links && data.social_links.length > 0) {
      footerLinks.innerHTML = data.social_links.map(link => 
        `<a href="${link.url}" target="_blank" class="footer-link-btn"><i class="fab fa-telegram-plane"></i> ${link.label}</a>`
      ).join('');
    }
  }

  renderBooks(booksList) {
    const container = document.getElementById('books-container');
    if (!container) return;
    container.innerHTML = '';

    if (booksList.length === 0) {
      container.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color: var(--text-secondary);">لا توجد كتب مطابقة للبحث</p>';
      return;
    }

    booksList.forEach(book => {
      const card = document.createElement('div');
      card.className = 'book-card';
      card.innerHTML = `
        <div>
          <div class="book-icon"><i class="fas fa-gavel"></i></div>
          <div class="book-title">${book.title}</div>
          <div class="book-author">${book.author || 'مستشار قانوني'}</div>
        </div>
        <div>
          <div class="book-meta">
            <span class="chapters-badge">⏳ ${book.chapters || 0} فصل</span>
          </div>
          <button onclick="app.selectBook('${book.id}')">دخول الاختبار</button>
        </div>
      `;
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

  async buildQuestionIndex() {
    if (this._questionIndex && this._questionIndex.length) return this._questionIndex;
    const poolsPerBook = await Promise.all(this.books.map(b => this.fetchAllBookQuestions(b)));
    this._questionIndex = poolsPerBook.flat();
    return this._questionIndex;
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
    const book = this.books.find(b => b.title === matchedQuestion.sourceBook);
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

    const targetIdx = this.currentQuestions.findIndex(q => q.id === matchedQuestion.id);
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

    header.innerHTML = `<h2>${this.currentBook.title}</h2><p>اختر الفصل الذي تريد بدء امتحانه:</p>`;
    container.innerHTML = '';

    for (let i = 1; i <= this.currentBook.chapters; i++) {
      const item = document.createElement('div');
      item.className = 'chapter-item';
      item.innerHTML = `
        <div class="chapter-info">
          <h3>الفصل ${i}</h3>
          <p>اسئلة مخصصة لـ الفصل ${i}</p>
        </div>
        <button class="exam-btn next" onclick="app.startExam(${i})" style="width:auto; border-radius:8px !important;">ابدأ 🚀</button>
      `;
      container.appendChild(item);
    }
  }

  async startExam(chapterNum) {
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
    this.renderQuestion();
  }

  // ---------- الاختبار العشوائي الشامل (من عدة كتب) ----------

  showCustomExamSetup() {
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

    container.innerHTML = this.books.map(book => `
      <label class="custom-exam-book-option">
        <input type="checkbox" value="${book.id}" class="custom-exam-book-checkbox">
        <span>${book.title} <small>(${book.chapters || 0} فصل)</small></span>
      </label>
    `).join('');
  }

  async fetchAllBookQuestions(book) {
    const basePath = examEngine.basePath;
    const total = book.chapters || 0;
    const requests = [];

    for (let i = 1; i <= total; i++) {
      requests.push(
        fetch(`${basePath}/data/${book.id}/chapter_${i}.json?v=${examEngine.sessionTimestamp}`)
          .then(res => (res.ok ? res.json() : null))
          .catch(() => null)
      );
    }

    const chaptersData = await Promise.all(requests);
    const pool = [];

    chaptersData.forEach((chapterData, idx) => {
      if (!chapterData) return;
      const chapterNum = idx + 1;
      const qs = chapterData.questions || (Array.isArray(chapterData) ? chapterData : []);
      qs.forEach(q => {
        pool.push({ ...q, sourceBook: book.title, sourceChapter: chapterNum });
      });
    });

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
      const poolsPerBook = await Promise.all(selectedBooks.map(b => this.fetchAllBookQuestions(b)));
      let pool = poolsPerBook.flat();

      if (pool.length === 0) {
        alert('عذراً، لم يتم العثور على أي أسئلة بالكتب المختارة.');
        return;
      }

      // خلط عشوائي كامل لترتيب الأسئلة (Fisher-Yates)
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      const finalCount = Math.min(questionCount, pool.length);
      if (finalCount < questionCount) {
        alert(`تنبيه: الكتب المختارة تحتوي ${pool.length} سؤال فقط، سيتم استخدام كل الأسئلة المتاحة.`);
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

    const pastAns = examEngine.userAnswers.find(a => a.questionText === q.question);

    container.innerHTML = `
      <div class="question-text">${q.question}</div>
      <div class="options-list">
        ${q.options.map((opt, i) => {
          let extraClass = '';
          if (pastAns) {
            if (opt === pastAns.userAnswer && !pastAns.isCorrect) extraClass = 'incorrect';
            if (opt === pastAns.correctAnswer) extraClass = 'correct';
          }
          return `<button class="option-btn ${extraClass}" ${pastAns ? 'disabled class="disabled"' : ''} onclick="app.handleAnswer(${i}, this)">${opt}</button>`;
        }).join('')}
      </div>
    `;

    document.getElementById('prev-btn').style.visibility = qIdx === 0 ? 'hidden' : 'visible';
    document.getElementById('next-btn').innerText = qIdx === total - 1 ? 'إنهاء الاختبار 🏁' : 'السؤال التالي';
  }

  // ---------- مشاركة السؤال (بطاقة صورة + رابط مباشر) ----------

  buildDeepLink(q) {
    const origin = window.location.origin;
    const basePath = examEngine.basePath || '';
    let bookId, chapterNum;

    if (this.isCustomExam && q.sourceBook) {
      const srcBook = this.books.find(b => b.title === q.sourceBook);
      bookId = srcBook ? srcBook.id : null;
      chapterNum = q.sourceChapter;
    } else {
      bookId = this.currentBook.id;
      chapterNum = this.currentChapter;
    }

    if (!bookId || !chapterNum) return `${origin}${basePath}/`;

    let url = `${origin}${basePath}/?book=${encodeURIComponent(bookId)}&chapter=${chapterNum}`;
    if (q.id) {
      url += `&qid=${encodeURIComponent(q.id)}`;
    } else if (!this.isCustomExam) {
      // بدون id: نستخدم رقم موقع السؤال داخل الفصل كبديل (غير متاح بدقة أثناء الاختبار العشوائي)
      const posIdx = this.currentQuestions.indexOf(q);
      if (posIdx !== -1) url += `&q=${posIdx + 1}`;
    }
    return url;
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  wrapText(ctx, text, maxWidth) {
    const words = (text || '').split(' ');
    const lines = [];
    let current = '';
    words.forEach(word => {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    });
    if (current) lines.push(current);
    return lines;
  }

  async generateShareCard(q) {
    const W = 1080;

    try {
      await Promise.all([
        document.fonts.load('700 46px "Aref Ruqaa"'),
        document.fonts.load('500 30px "Tajawal"'),
        document.fonts.load('700 26px "Tajawal"'),
        document.fonts.load('800 32px "Tajawal"')
      ]);
      await document.fonts.ready;
    } catch (e) { /* لو فشل تحميل الخط نكمل بالخط الاحتياطي */ }

    // كانفاس مؤقت فقط لقياس عدد أسطر السؤال قبل تحديد طول البطاقة النهائي
    const measureCanvas = document.createElement('canvas');
    const mctx = measureCanvas.getContext('2d');
    mctx.font = '700 46px "Aref Ruqaa", serif';
    const lines = this.wrapText(mctx, q.question, W - 220);

    // هوامش أمان أعلى وأسفل الصورة: فراغ فاضي (نفس لون الورقة) نتركه عمداً
    // حتى لو تيليجرام أو أي تطبيق قص/غطّى حواف الصورة عند عرضها مع رابط أو تعليق،
    // يبقى المحتوى المهم (الختم، الأسئلة، الخيارات) بعيد عن منطقة القص
    const TOP_SAFE = 90;
    const BOTTOM_SAFE = 110;
    const sealCenterY = TOP_SAFE + 70;
    const optHeight = 74;

    // نحسب الارتفاع الكلي المطلوب مسبقاً بنفس منطق الرسم بالأسفل بالضبط
    let estimatedY = sealCenterY + 105 + 48 + 34 + 70 + (lines.length * 62) + 55;
    estimatedY += q.options.length * (optHeight + 20);
    estimatedY += 20 + 70 + 58;
    const H = Math.round(estimatedY + BOTTOM_SAFE);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const C = {
      paper: '#f3ecdd', paperLine: '#c9bda0', navy: '#0f172a',
      gold: '#c29d5f', goldLight: '#d9bd8a', ink: '#241d12', inkSoft: '#6b5f45'
    };
    const cx = W / 2;

    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = C.paperLine;
    ctx.lineWidth = 3;
    ctx.strokeRect(32, 32, W - 64, H - 64);
    ctx.strokeStyle = 'rgba(194,157,95,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(44, 44, W - 88, H - 88);

    let y = sealCenterY;
    ctx.save();
    ctx.translate(cx, y);
    ctx.rotate(-8 * Math.PI / 180);
    ctx.beginPath();
    ctx.arc(0, 0, 62, 0, Math.PI * 2);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚖️', 0, 6);
    ctx.restore();

    y += 105;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = C.inkSoft;
    ctx.font = '700 26px Tajawal, sans-serif';
    ctx.fillText('منصة الاختبارات القانونية', cx, y);

    y += 48;
    const bookTitle = (this.isCustomExam && q.sourceBook) ? q.sourceBook : this.currentBook.title;
    const chapterNum = (this.isCustomExam && q.sourceChapter) ? q.sourceChapter : this.currentChapter;
    ctx.font = '500 28px Tajawal, sans-serif';
    ctx.fillStyle = C.navy;
    ctx.fillText(`${bookTitle} · الفصل ${chapterNum}`, cx, y);

    y += 34;
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 60, y);
    ctx.lineTo(cx + 60, y);
    ctx.stroke();

    y += 70;
    ctx.font = '700 46px "Aref Ruqaa", serif';
    ctx.fillStyle = C.ink;
    lines.forEach(line => {
      y += 62;
      ctx.fillText(line, cx, y);
    });
    y += 55;

    const optLetters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
    const optX = 80;
    const optWidth = W - 160;
    q.options.forEach((opt, i) => {
      this.roundRect(ctx, optX, y, optWidth, optHeight, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fill();
      ctx.strokeStyle = C.paperLine;
      ctx.lineWidth = 2;
      ctx.stroke();

      const circleR = 24;
      const circleCx = W - optX - 40;
      const circleCy = y + optHeight / 2;
      ctx.beginPath();
      ctx.arc(circleCx, circleCy, circleR, 0, Math.PI * 2);
      ctx.strokeStyle = C.navy;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = C.navy;
      ctx.font = '800 26px Tajawal, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(optLetters[i] || '', circleCx, circleCy + 2);

      ctx.textAlign = 'right';
      ctx.fillStyle = C.ink;
      ctx.font = '500 30px Tajawal, sans-serif';
      ctx.fillText(opt, circleCx - circleR - 20, circleCy);

      y += optHeight + 20;
    });

    y += 20;
    ctx.strokeStyle = C.paperLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, y);
    ctx.lineTo(W - 80, y);
    ctx.stroke();

    y += 70;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ctaText = '✋ جاوب بنفسك الآن';
    ctx.font = '800 32px Tajawal, sans-serif';
    const ctaWidth = ctx.measureText(ctaText).width + 80;
    const ctaHeight = 64;
    this.roundRect(ctx, cx - ctaWidth / 2, y - ctaHeight / 2, ctaWidth, ctaHeight, 32);
    ctx.fillStyle = C.navy;
    ctx.fill();
    ctx.fillStyle = C.goldLight;
    ctx.fillText(ctaText, cx, y + 2);

    y += 58;
    ctx.font = '500 22px Tajawal, sans-serif';
    ctx.fillStyle = C.inkSoft;
    ctx.direction = 'ltr';
    const domain = window.location.host + (examEngine.basePath || '');
    ctx.fillText(domain, cx, y);

    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  }

  async shareQuestion() {
    const q = examEngine.questions[examEngine.currentQuestionIndex];
    if (!q) return;
    const btn = document.getElementById('share-question-btn');
    const originalLabel = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = '⏳'; }

    try {
      const blob = await this.generateShareCard(q);
      const shareUrl = this.buildDeepLink(q);
      const file = new File([blob], 'question.jpg', { type: 'image/jpeg' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'سؤال من منصة الاختبارات القانونية',
          text: `جرب تجاوب على هذا السؤال 👇\n${shareUrl}`
        });
      } else if (navigator.share) {
        await navigator.share({ title: 'سؤال من منصة الاختبارات القانونية', text: shareUrl, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('تم نسخ رابط السؤال (المشاركة المباشرة غير مدعومة بهذا المتصفح).');
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('فشلت المشاركة:', err);
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = originalLabel || '📤'; }
    }
  }

  handleAnswer(optIdx, btnEl) {
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
    // تم حذف الـ setTimeout نهائياً لمنع الانتقال التلقائي بناءً على طلبك
  }

  nextQuestion() {
    const hasNext = examEngine.nextQuestion();
    if (hasNext) {
      this.renderQuestion();
    } else {
      this.endExam();
    }
  }

  prevQuestion() {
    if (examEngine.currentQuestionIndex > 0) {
      examEngine.currentQuestionIndex--;
      this.renderQuestion();
    }
  }

  endExam() {
    clearInterval(this.timerInterval);
    this.examActive = false;
    document.body.classList.remove('exam-mode');
    const res = examEngine.finishExam();

    this.navigateTo('results', { book: this.currentBook.id, chapter: this.currentChapter, status: 'done' });
    
    document.getElementById('result-grade').innerText = `${res.grade.emoji} ${res.grade.grade}`;
    document.getElementById('result-score').innerText = `النتيجة: ${res.score} / ${res.totalQuestions}`;
    document.getElementById('result-percent').innerText = `${res.percentage}%`;
    
    const mins = Math.floor(res.duration / 60);
    const secs = res.duration % 60;
    document.getElementById('result-time').innerText = mins > 0 ? `${mins} دقيقة و ${secs} ثانية` : `${secs} ثانية`;
  }

  showReview() {
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
        <div class="review-question"><strong>س${idx + 1}:</strong> ${ans.questionText}</div>
        <div class="review-answer incorrect">❌ إجابتك: ${ans.userAnswer}</div>
        <div class="review-answer correct">✔ الإجابة الصحيحة: ${ans.correctAnswer}</div>
        ${ans.explanation ? `<div class="review-explanation"><strong>📚 الشرح:</strong> ${ans.explanation}</div>` : ''}
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
    clearInterval(this.timerInterval);
    this.examActive = false;
    document.body.classList.remove('exam-mode');
    this.isCustomExam = false;
    this.currentBook = null;
    this.currentChapter = null;
    this.navigateTo('books');
    this.renderBooks(this.books);
  }

  startTimer() {
    clearInterval(this.timerInterval);
    const el = document.getElementById('exam-timer');
    let sec = 0;
    el.innerText = '00:00';
    this.timerInterval = setInterval(() => {
      sec++;
      const m = Math.floor(sec / 60).toString().padStart(2, '0');
      const s = (sec % 60).toString().padStart(2, '0');
      el.innerText = `${m}:${s}`;
    }, 1000);
  }

  // دالة الملاحة المحسنة لدعم أزرار الرجوع للهواتف بدون الخروج من الموقع
  navigateTo(viewId, params = {}, pushState = true) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(`${viewId}-section`);
    if (section) section.classList.add('active');
    
    if (pushState) {
      history.pushState({ view: viewId, bookId: this.currentBook ? this.currentBook.id : null, chapter: this.currentChapter }, '');
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
    document.getElementById('restart-exam-btn').onclick = () => this.restartExam();
    document.getElementById('review-exam-btn').onclick = () => this.showReview();
    document.getElementById('search-input').oninput = () => this.filterBooks();

    const customExamEntryBtn = document.getElementById('custom-exam-entry-btn');
    if (customExamEntryBtn) customExamEntryBtn.onclick = () => this.showCustomExamSetup();

    const customExamBackBtn = document.getElementById('custom-exam-back-btn');
    if (customExamBackBtn) customExamBackBtn.onclick = () => this.backToBooks();

    const customExamStartBtn = document.getElementById('custom-exam-start-btn');
    if (customExamStartBtn) customExamStartBtn.onclick = () => this.handleCustomExamStart();
  }

  // مستمع أحداث زر الرجوع الفيزيائي للهاتف
  setupHistoryListener() {
    window.onpopstate = (event) => {
      if (event.state && event.state.view) {
        const view = event.state.view;
        
        // إيقاف مؤقت الفحص إذا خرج من الاختبار النشط
        if (view !== 'exam' && this.timerInterval) {
          clearInterval(this.timerInterval);
          this.examActive = false;
          document.body.classList.remove('exam-mode');
        }

        if (view === 'books') {
          this.currentBook = null;
          this.currentChapter = null;
          this.navigateTo('books', {}, false);
          this.renderBooks(this.books);
        } else if (view === 'chapters') {
          this.currentChapter = null;
          this.navigateTo('chapters', {}, false);
          this.renderChapters();
        } else if (view === 'exam') {
          this.navigateTo('exam', {}, false);
          this.renderQuestion();
        } else if (view === 'custom-exam-setup') {
          this.isCustomExam = false;
          this.navigateTo('custom-exam-setup', {}, false);
          this.renderCustomExamSetup();
        } else {
          this.navigateTo(view, {}, false);
        }
      } else {
        this.navigateTo('books', {}, false);
      }
    };
  }
}

window.app = new ExamApp();

