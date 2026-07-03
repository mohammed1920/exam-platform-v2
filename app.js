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
    this.examActive = false;
    this.timerInterval = null;
    this.init();
  }

  async init() {
    console.log('Initializing Exam App...');
    await this.loadBooks();
    this.setupEventListeners();
    this.setupHistoryListener();
    
    // فحص الرابط عند التحميل لأول مرة
    this.handleInitialState();
  }

  handleInitialState() {
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get('book');
    const chapterNum = params.get('chapter');

    if (bookId) {
      const book = this.books.find(b => b.id === bookId);
      if (book) {
        if (chapterNum) {
          this.startExam(bookId, parseInt(chapterNum), false);
        } else {
          this.selectBook(book, false);
        }
      }
    } else {
      history.replaceState({ page: 'books' }, '', window.location.pathname);
    }
  }

  setupHistoryListener() {
    window.addEventListener('popstate', (event) => {
      if (event.state) {
        this.handleNavigation(event.state);
      } else {
        this.backToBooks(false);
      }
    });
  }

  handleNavigation(state) {
    if (!state || state.page === 'books') {
      this.backToBooks(false);
    } else if (state.page === 'chapters' && state.book) {
      this.showChapters(state.book, false);
    } else if (state.page === 'exam') {
      // إذا رجع المستخدم من النتيجة أو الامتحان
      this.backToBooks(false);
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

  renderBooks(booksToRender = null) {
    const booksContainer = document.getElementById('books-container');
    const noResults = document.getElementById('no-results');
    const booksArray = booksToRender || this.books;
    
    if (!booksContainer) return;
    booksContainer.innerHTML = '';

    if (booksArray.length === 0) {
      if (noResults) noResults.style.display = 'block';
      return;
    }
    
    if (noResults) noResults.style.display = 'none';

    booksArray.forEach(book => {
      const bookCard = document.createElement('div');
      bookCard.className = 'book-card';
      bookCard.innerHTML = `
        <div class="book-icon">📚</div>
        <h3>${book.title}</h3>
        <span class="author">${book.author}</span>
        <p class="description">${book.description}</p>
        <span class="chapters-count">📖 ${book.chapters} فصول</span>
      `;
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
      book.description.toLowerCase().includes(query)
    );
    this.renderBooks(filtered);
  }

  selectBook(book, pushHistory = true) {
    this.currentBook = book;
    if (pushHistory) {
      const newUrl = this.updateURL('chapters', { bookId: book.id });
      history.pushState({ page: 'chapters', book }, '', newUrl);
    }
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
      btn.addEventListener('click', () => this.selectAnswer(index));
      optionsContainer.appendChild(btn);
    });

    this.updateProgress();
    document.getElementById('next-btn').style.display = 'none';
  }

  selectAnswer(optionIndex) {
    const isCorrect = examEngine.submitAnswer(optionIndex);
    const question = examEngine.getCurrentQuestion();
    const buttons = document.querySelectorAll('.option-btn');

    buttons.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === optionIndex) btn.classList.add(isCorrect ? 'correct' : 'wrong');
      if (idx === question.answer && !isCorrect) btn.classList.add('correct');
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

    ['chapters-container', 'exam-container', 'results-container', 'review-container'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    document.getElementById('books-section').style.display = 'block';
    examEngine.reset();
  }

  setupEventListeners() {
    document.getElementById('next-btn').addEventListener('click', () => this.nextQuestion());
    document.getElementById('back-btn').addEventListener('click', () => this.backToBooks());
    document.getElementById('restart-btn').addEventListener('click', () => this.backToBooks());
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
        <div class="review-q"><strong>س${index + 1}:</strong> ${ans.questionText}</div>
        <div class="review-ans wrong">إجابتك: ${ans.userAnswer}</div>
        <div class="review-ans correct">الإجابة الصحيحة: ${ans.correctAnswer}</div>
        <div class="review-explanation"><strong>الشرح:</strong> ${ans.explanation || "لا يوجد شرح متوفر."}</div>
      `;
      reviewContent.appendChild(item);
    });
  }
}

const app = new ExamApp();
