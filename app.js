/**
 * Exam Platform V2 - Main Application
 * تطبيق منصة الاختبارات الرئيسي
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
    try {
      this.books = await examEngine.loadBooks();
      this.renderBooks();
    } catch (error) {
      console.error('Error loading books:', error);
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

  showChapters(book) {
    document.getElementById('books-section').style.display = 'none';
    document.getElementById('chapters-container').classList.add('active');
    document.getElementById('exam-container').classList.remove('active');
    document.getElementById('results-container').classList.remove('active');
    
    document.getElementById('chapters-title').textContent = book.title;
    document.getElementById('chapters-author').textContent = `بقلم: ${book.author}`;

    const chaptersGrid = document.getElementById('chapters-grid');
    chaptersGrid.innerHTML = '';

    for (let i = 1; i <= book.chapters; i++) {
      const chapterCard = document.createElement('div');
      chapterCard.className = 'chapter-card';
      chapterCard.innerHTML = `
        <h4>الفصل ${i}</h4>
        <p>اختبر معلوماتك في الفصل ${i}</p>
        <button class="start-exam-btn">ابدأ الاختبار</button>
      `;
      chapterCard.querySelector('.start-exam-btn').addEventListener('click', () => this.startExam(book.id, i));
      chaptersGrid.appendChild(chapterCard);
    }
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

    questionText.textContent = question.q;
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
      if (idx === question.correct && !isCorrect) btn.classList.add('correct');
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

    ['chapters-container', 'exam-container', 'results-container'].forEach(id => {
      document.getElementById(id).classList.remove('active');
    });
    document.getElementById('books-section').style.display = 'block';
    examEngine.reset();
  }

  setupEventListeners() {
    document.getElementById('next-btn').addEventListener('click', () => this.nextQuestion());
    document.getElementById('back-btn').addEventListener('click', () => this.backToBooks());
    document.getElementById('restart-btn').addEventListener('click', () => this.backToBooks());
    document.getElementById('back-to-books-btn').addEventListener('click', () => this.backToBooks());
    
    // مستمع للبحث
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterBooks());
    }
  }
}

let app;
document.addEventListener('DOMContentLoaded', () => { app = new ExamApp(); });
