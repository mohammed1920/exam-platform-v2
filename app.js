/**
 * Exam Platform V2 - Main Application
 * تطبيق منصة الاختبارات الرئيسي
 * تم التوحيد: استخدام المفاتيح الموحدة (question, answer, options, explanation).
 */

class ExamApp {
  constructor() {
    this.books = [];
    this.currentBook = null;
    this.currentChapter = null;
    this.currentQuestions = []; // مصفوفة الأسئلة المحضرة والمخلوطة
    this.examActive = false;
    this.timerInterval = null;
    this.init();
  }

  async init() {
    console.log('Initializing Exam App...');
    await this.loadBooks();
    await this.loadContactInfo(); // تحميل معلومات التواصل
    this.setupEventListeners();
    this.setupHistoryListener();
    
    // فحص الرابط عند التحميل لأول مرة
    this.handleInitialState();
  }

  // ===== دالة تجهيز أسئلة الفصل بنسخة عميقة وخلط الخيارات مع ضمان دقة التصحيح =====
  prepareChapterQuestions(originalQuestions) {
    // أخذ نسخة عميقة ونظيفة (Deep Copy) لمنع التداخل مع أي بيانات ثابتة
    const questionsCopy = JSON.parse(JSON.stringify(originalQuestions));

    return questionsCopy.map(q => {
      if (!q.options || q.options.length === 0) return q;

      // 1. حفظ النص الفعلي للإجابة الصحيحة الأصلية قبل البعثرة
      const correctText = q.options[q.answer];

      // 2. خلط الخيارات عشوائياً باستخدام Fisher-Yates
      for (let i = q.options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
      }

      // 3. تحديث الاندكس (رقم الإجابة) ليكون هو المكان الجديد للنص الصحيح بدقة
      q.answer = q.options.indexOf(correctText);

      return q;
    });
  }

  async loadContactInfo() {
    try {
      const res = await fetch(`${examEngine.basePath}/data/contact.json?t=${new Date().getTime()}`);
      if (res.ok) {
        const data = await res.json();
        this.renderContactInfo(data);
      }
    } catch (e) {
      console.log('Contact info not found or error loading.');
    }
  }

  renderContactInfo(data) {
    // حقن معلومات التواصل في Footer
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
        `<a href="${link.url}" target="_blank" class="footer-link-btn">${link.label}</a>`
      ).join('');
    }
  }

  handleInitialState() {
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get('book');
    const chapterNum = params.get('chapter');

    if (bookId && chapterNum) {
      const book = this.books.find(b => b.id === bookId);
      if (book) {
        this.selectBook(book);
        setTimeout(() => this.startExam(bookId, parseInt(chapterNum), false), 500);
      }
    }
  }

  updateURL(page, params = {}) {
    const url = new URL(window.location.href);
    url.search = ''; // مسح المعاملات القديمة
    
    if (page === 'chapters' && params.bookId) {
      url.searchParams.set('book', params.bookId);
    } else if (page === 'exam' && params.bookId && params.chapter) {
      url.searchParams.set('book', params.bookId);
      url.searchParams.set('chapter', params.chapter);
    }
    
    return url.toString();
  }

  async loadBooks() {
    // 1. محاولة التحميل من LocalStorage أولاً (سرعة فائقة)
    const cachedBooks = localStorage.getItem('exam_books_cache');
    if (cachedBooks) {
      this.books = JSON.parse(cachedBooks);
      this.renderBooks();
    } else if (typeof BOOKS !== 'undefined' && BOOKS.length > 0) {
      this.books = BOOKS;
      this.renderBooks();
    }

    // 2. تحديث البيانات في الخلفية (Background Fetch) لتجنب قيود GitHub
    this.syncBooksInBackground();
  }

  async syncBooksInBackground() {
    try {
      const timestamp = new Date().getTime();
      const res = await fetch(`${examEngine.basePath}/data/books.json?t=${timestamp}`);
      if (res.ok) {
        const freshBooks = await res.json();
        // تحديث الكاش فقط إذا كانت هناك تغييرات
        if (JSON.stringify(freshBooks) !== JSON.stringify(this.books)) {
          this.books = freshBooks;
          localStorage.setItem('exam_books_cache', JSON.stringify(freshBooks));
          this.renderBooks();
          console.log('Books cache updated in background.');
        }
      }
    } catch (e) {
      console.warn('Background sync failed, using cached data.');
    }
  }

  renderBooks(booksArray = this.books) {
    const booksContainer = document.getElementById('books-grid');
    const noResults = document.getElementById('no-results');
    
    booksContainer.innerHTML = '';
    
    if (!booksArray || booksArray.length === 0) {
      if (noResults) noResults.style.display = 'block';
      return;
    }
    
    if (noResults) noResults.style.display = 'none';

    booksArray.forEach(book => {
      const bookCard = document.createElement('div');
      bookCard.className = 'book-card';
      
      // إنشاء الزر بشكل منفصل لضمان التصميم الموحد
      const startBtn = document.createElement('button');
      startBtn.className = 'book-start-btn';
      startBtn.textContent = 'دخول الاختبار';
      startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectBook(book);
      });
      
      bookCard.innerHTML = `
        <div class="book-icon"><i class="fas fa-book-open"></i></div>
        <h3>${book.title}</h3>
        <span class="author">${book.author}</span>
        <div class="chapters-count">⏳ ${book.chapters} فصل</div>
      `;
      
      bookCard.appendChild(startBtn);
      bookCard.addEventListener('click', () => this.selectBook(book));
      booksContainer.appendChild(bookCard);
    });
  }

  filterBooks() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    if (query === '') {
      this.renderBooks();
      return;
    }

    const filtered = this.books.filter(book =>
      book.title.toLowerCase().includes(query) ||
      book.author.toLowerCase().includes(query) ||
      book.description.toLowerCase().includes(query)
    );

    this.renderBooks(filtered);
  }

  selectBook(book) {
    this.currentBook = book;
    const newUrl = this.updateURL('chapters', { bookId: book.id });
    history.pushState({ page: 'chapters', bookId: book.id }, '', newUrl);
    this.showChapters(book);
  }

  async showChapters(book) {
    document.getElementById('books-section').style.display = 'none';
    document.getElementById('chapters-container').classList.add('active');
    document.getElementById('exam-container').classList.remove('active');
    document.getElementById('results-container').classList.remove('active');
    document.getElementById('chapters-title').textContent = book.title;
    document.getElementById('chapters-author').textContent = `بقلم: ${book.author}`;
    const chaptersGrid = document.getElementById('chapters-grid');

    // 1. محاولة التحميل من الكاش المحلي للفصول
    const cacheKey = `chapters_cache_${book.id}`;
    const cachedChapters = localStorage.getItem(cacheKey);
    if (cachedChapters) {
      this.renderChaptersGrid(book, JSON.parse(cachedChapters));
    } else {
      chaptersGrid.innerHTML = '<p style="text-align:center;color:#94a3b8">جاري تحميل الفصول...</p>';
    }

    // 2. التحديث في الخلفية (Background Sync)
    this.syncChaptersInBackground(book, cacheKey);
  }

  async syncChaptersInBackground(book, cacheKey) {
    try {
      const timestamp = new Date().getTime();
      // جلب قائمة الملفات من GitHub API
      const res = await fetch(`https://api.github.com/repos/mohammed1920/exam-platform-v2/contents/data/${book.id}?t=${timestamp}`);
      if (res.ok) {
        const files = await res.json();
        let chapterFiles = [];
        for (const file of files) {
          const m = file.name.match(/^chapter_(\d+)\.json$/);
          if (m) chapterFiles.push({ num: parseInt(m[1]) });
        }
        chapterFiles.sort((a, b) => a.num - b.num);

        // جلب العناوين
        const chapterData = await Promise.all(chapterFiles.map(async (ch) => {
          try {
            const r = await fetch(`${examEngine.basePath}/data/${book.id}/chapter_${ch.num}.json?t=${timestamp}`);
            if (r.ok) {
              const data = await r.json();
              return { num: ch.num, title: data.title || `الفصل ${ch.num}` };
            }
          } catch(e) {}
          return { num: ch.num, title: `الفصل ${ch.num}` };
        }));

        // تحديث الكاش إذا تغيرت البيانات
        localStorage.setItem(cacheKey, JSON.stringify(chapterData));
        this.renderChaptersGrid(book, chapterData);
      }
    } catch (e) {
      console.warn('Chapters background sync failed.');
    }
  }

  renderChaptersGrid(book, chapterData) {
    const chaptersGrid = document.getElementById('chapters-grid');
    chaptersGrid.innerHTML = '';
    if (chapterData.length === 0) {
      chaptersGrid.innerHTML = '<p style="text-align:center;color:#94a3b8">لا توجد فصول متاحة.</p>';
      return;
    }
    chapterData.forEach(ch => {
      const chapterCard = document.createElement('div');
      chapterCard.className = 'chapter-card';
      chapterCard.innerHTML = `
        <h4>${ch.title}</h4>
        <button class="start-exam-btn">ابدأ الاختبار</button>
      `;
      chapterCard.querySelector('.start-exam-btn').addEventListener('click', () => this.startExam(book.id, ch.num));
      chaptersGrid.appendChild(chapterCard);
    });
  }

  async startExam(bookId, chapterNum, pushHistory = true) {
    const chapter = await examEngine.loadChapter(bookId, chapterNum);
    if (!chapter) return;

    // تجهيز أسئلة الفصل بنسخة عميقة وخلط الخيارات
    this.currentQuestions = this.prepareChapterQuestions(chapter.questions);
    
    // تحديث محرك الاختبارات بالأسئلة المحضرة
    examEngine.questions = this.currentQuestions;
    examEngine.totalQuestions = this.currentQuestions.length;
    examEngine.currentQuestionIndex = 0;

    this.currentChapter = chapterNum;
    this.examActive = true;
    document.body.classList.add('exam-mode');

    if (pushHistory) {
      const newUrl = this.updateURL('exam', { bookId, chapter: chapterNum });
      history.pushState({ page: 'exam', bookId, chapterNum }, '', newUrl);
    }

    document.getElementById('books-section').style.display = 'none';
    document.getElementById('chapters-container').classList.remove('active');
    document.getElementById('exam-container').classList.add('active');
    document.getElementById('results-container').classList.remove('active');

    this.startTimer();
    this.displayQuestion();
  }

  displayQuestion() {
    const question = examEngine.getCurrentQuestion();
    if (!question) return;

    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const feedback = document.getElementById('feedback');

    questionText.textContent = question.question;
    optionsContainer.innerHTML = '';
    feedback.classList.remove('show', 'correct', 'wrong');

    const letters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
    question.options.forEach((option, index) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.setAttribute('data-letter', letters[index] || '');
      btn.textContent = option;
      btn.addEventListener('click', () => this.checkAnswer(index));
      optionsContainer.appendChild(btn);
    });

    this.updateProgress();
  }

  checkAnswer(selectedIndex) {
    const question = examEngine.getCurrentQuestion();
    if (!question) return;

    const isCorrect = selectedIndex === question.answer;
    examEngine.recordAnswer(selectedIndex, isCorrect);

    const buttons = document.querySelectorAll('.option-btn');
    buttons.forEach((btn, idx) => {
      if (idx === question.answer) {
        btn.classList.add('correct');
      } else if (idx === selectedIndex && !isCorrect) {
        btn.classList.add('wrong');
      }
      btn.disabled = true;
    });

    const feedback = document.getElementById('feedback');
    feedback.classList.add('show', isCorrect ? 'correct' : 'wrong');
    feedback.innerHTML = `
      <strong>${isCorrect ? '✅ إجابة صحيحة!' : '❌ إجابة خاطئة'}</strong>
      <div class="explanation">${question.explanation || "لا يوجد شرح متوفر حالياً."}</div>
    `;

    document.getElementById('current-score').textContent = examEngine.score;
    document.getElementById('wrong-score').textContent = examEngine.getWrongAnswers().length;

    const nextBtn = document.getElementById('next-btn');
    nextBtn.style.display = 'block';
    nextBtn.textContent = examEngine.currentQuestionIndex < examEngine.totalQuestions - 1 ? 'السؤال التالي ←' : '🏆 إنهاء الاختبار';
  }

  nextQuestion() {
    if (examEngine.nextQuestion()) {
      this.displayQuestion();
    } else {
      this.finishExam();
    }
  }

  finishExam() {
    this.examActive = false;
    document.body.classList.remove('exam-mode');
    if (this.timerInterval) clearInterval(this.timerInterval);

    const results = examEngine.finishExam();
    document.getElementById('exam-container').classList.remove('active');
    document.getElementById('results-container').classList.add('active');

    document.getElementById('results-grade').textContent = results.grade.emoji;
    document.getElementById('results-percentage').textContent = `${results.percentage}%`;
    document.getElementById('results-score').textContent = `حصلت على ${results.score} من ${results.totalQuestions}`;
    document.getElementById('results-grade-text').textContent = results.grade.grade;
    
    const mins = Math.floor(results.duration / 60);
    const secs = results.duration % 60;
    document.getElementById('results-time').textContent = `الوقت: ${mins}:${secs.toString().padStart(2, '0')}`;
    document.getElementById('wrong-count').textContent = examEngine.getWrongAnswers().length;
  }

  updateProgress() {
    const current = examEngine.currentQuestionIndex + 1;
    const total = examEngine.totalQuestions;
    document.getElementById('progress-fill').style.width = `${(current / total) * 100}%`;
    document.getElementById('progress-text').textContent = `${current}/${total}`;
  }

  startTimer() {
    let seconds = 0;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      seconds++;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      document.getElementById('timer').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
  }

  backToBooks(pushHistory = true) {
    document.body.classList.remove('exam-mode');
    if (this.timerInterval) clearInterval(this.timerInterval);
    
    if (pushHistory) {
      history.pushState({ page: 'books' }, '', window.location.pathname);
    }

    // إخفاء وتفريغ جميع الحاويات
    ['chapters-container', 'exam-container', 'results-container', 'review-container'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('active');
        // تفريغ محتوى المراجعة تماماً
        if (id === 'review-container') {
          const reviewContent = document.getElementById('review-content');
          if (reviewContent) reviewContent.innerHTML = '';
        }
      }
    });
    
    document.getElementById('books-section').style.display = 'block';
    examEngine.reset();
  }

  restartExam() {
    // تصفير الإحصائيات مع الحفاظ على نفس الكتاب والفصل الحالي بالذاكرة
    examEngine.currentQuestionIndex = 0;
    examEngine.score = 0;
    examEngine.userAnswers = [];
    examEngine.startTime = new Date(); // إعادة ضبط وقت البدء

    // إعادة خلط الخيارات عند إعادة الاختبار لتجربة جديدة
    if (this.currentQuestions && this.currentQuestions.length > 0) {
      this.currentQuestions = this.prepareChapterQuestions(this.currentQuestions.map(q => {
        // استعادة الأسئلة الأصلية من examEngine قبل الخلط
        return examEngine.questions.find(eq => eq.id === q.id) || q;
      }));
      examEngine.questions = this.currentQuestions;
    }
    
    this.examActive = true;
    document.body.classList.add('exam-mode');

    // تحديث الواجهة: إخفاء واجهة النتائج وإظهار واجهة الأسئلة
    document.getElementById('results-container').classList.remove('active');
    document.getElementById('exam-container').classList.add('active');
    
    // تصفير واجهة الدرجات
    document.getElementById('current-score').textContent = '0';
    document.getElementById('wrong-score').textContent = '0';

    // إعادة تشغيل المؤقت
    this.startTimer();
    
    // إعادة عرض السؤال الأول فوراً
    this.displayQuestion();
  }

  setupEventListeners() {
    document.getElementById('next-btn').addEventListener('click', () => this.nextQuestion());
    document.getElementById('back-btn').addEventListener('click', () => this.backToBooks());
    document.getElementById('restart-btn').addEventListener('click', () => this.restartExam());
    document.getElementById('back-to-books-btn').addEventListener('click', () => this.backToBooks());
    
    const reviewBtn = document.getElementById('review-btn');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', () => this.showReview());
    }

    const backReviewBtn = document.getElementById('back-review-btn');
    if (backReviewBtn) {
      backReviewBtn.addEventListener('click', () => this.backToBooks());
    }

    // مستمع للبحث
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterBooks());
    }
  }

  showReview() {
    const wrongAnswers = examEngine.getWrongAnswers();
    if (wrongAnswers.length === 0) return;

    document.getElementById('results-container').classList.remove('active');
    document.getElementById('review-container').classList.add('active');
    
    const reviewContent = document.getElementById('review-content');
    reviewContent.innerHTML = '';

    wrongAnswers.forEach((ans, index) => {
      const item = document.createElement('div');
      item.className = 'review-item';
      item.innerHTML = `
        <div class="review-question"><strong>س${index + 1}:</strong> ${ans.questionText}</div>
        <div class="review-answer incorrect">❌ إجابتك: ${ans.userAnswer}</div>
        <div class="review-answer correct">✔ الإجابة الصحيحة: ${ans.correctAnswer}</div>
        ${ans.explanation ? `<div class="review-explanation"><strong>📚 الشرح:</strong> ${ans.explanation}</div>` : ''}
      `;
      reviewContent.appendChild(item);
    });
  }
}

const app = new ExamApp();
