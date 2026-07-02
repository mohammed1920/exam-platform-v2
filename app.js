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
    this.randomizeQuestions = true;
    this.init();
  }

  async init() {
    await this.loadBooks();
    this.setupEventListeners();
  }

  /**
   * تحميل الكتب
   */
  async loadBooks() {
    this.books = await examEngine.loadBooks();
    this.renderBooks();
  }

  /**
   * عرض الكتب
   */
  renderBooks(booksToRender = null) {
    const booksContainer = document.getElementById('books-container');
    const noResults = document.getElementById('no-results');
    const booksArray = booksToRender || this.books;
    
    booksContainer.innerHTML = '';

    if (booksArray.length === 0) {
      noResults.style.display = 'block';
      return;
    }
    
    noResults.style.display = 'none';

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

  /**
   * البحث عن الكتب
   */
  filterBooks() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.toLowerCase().trim();
    
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

  /**
   * اختيار كتاب
   */
  selectBook(book) {
    this.currentBook = book;
    this.showChapters(book);
  }

  /**
   * عرض فصول الكتاب
   */
  showChapters(book) {
    document.getElementById('books-container').parentElement.style.display = 'none';
    const chaptersContainer = document.getElementById('chapters-container');
    chaptersContainer.classList.add('active');

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
        <button class="start-exam-btn" onclick="app.startExam('${book.id}', ${i})">ابدأ الاختبار</button>
      `;
      chaptersGrid.appendChild(chapterCard);
    }
  }

  /**
   * بدء الاختبار
   */
  async startExam(bookId, chapterNum) {
    const chapter = await examEngine.loadChapter(bookId, chapterNum);
    if (!chapter) {
      alert('خطأ في تحميل الفصل');
      return;
    }

    this.currentChapter = chapterNum;
    this.examActive = true;

    // إخفاء الواجهات الأخرى
    document.getElementById('chapters-container').classList.remove('active');
    document.getElementById('books-container').parentElement.style.display = 'none';

    // عرض شاشة الاختبار
    const examContainer = document.getElementById('exam-container');
    examContainer.classList.add('active');

    // تحديث رأس الاختبار
    document.getElementById('exam-book-title').textContent = this.currentBook.title;
    document.getElementById('exam-chapter-title').textContent = `الفصل ${chapterNum}`;
    document.getElementById('total-questions').textContent = examEngine.totalQuestions;

    // بدء المؤقت
    this.startTimer();

    // عرض السؤال الأول
    this.displayQuestion();
  }

  /**
   * عرض السؤال
   */
  displayQuestion() {
    const question = examEngine.getCurrentQuestion();
    if (!question) return;

    const questionCard = document.getElementById('question-card');
    const questionNum = examEngine.currentQuestionIndex + 1;

    questionCard.innerHTML = `
      <div class="question-number">السؤال ${questionNum} من ${examEngine.totalQuestions}</div>
      <div class="question-text">${question.q}</div>
      <div class="options-container" id="options-container"></div>
      <div class="feedback" id="feedback"></div>
    `;

    // عرض الخيارات
    const optionsContainer = document.getElementById('options-container');
    question.options.forEach((option, index) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = option;
      btn.addEventListener('click', () => this.selectAnswer(index));
      optionsContainer.appendChild(btn);
    });

    // تحديث شريط التقدم
    this.updateProgress();

    // إخفاء الأزرار
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('prev-btn').style.display = 'none';
  }

  /**
   * اختيار إجابة
   */
  selectAnswer(optionIndex) {
    const isCorrect = examEngine.submitAnswer(optionIndex);
    const question = examEngine.getCurrentQuestion();

    // تعطيل جميع الأزرار
    const buttons = document.querySelectorAll('.option-btn');
    buttons.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === optionIndex) {
        btn.classList.add(isCorrect ? 'correct' : 'wrong');
      }
      if (idx === question.correct && !isCorrect) {
        btn.classList.add('correct');
      }
    });

    // عرض الملاحظات
    const feedback = document.getElementById('feedback');
    feedback.classList.add('show');
    feedback.classList.add(isCorrect ? 'correct' : 'wrong');
    feedback.innerHTML = `
      ${isCorrect ? '✅ إجابة صحيحة!' : '❌ إجابة خاطئة'}
      <div class="explanation"><strong>الشرح:</strong> ${question.explanation}</div>
    `;

    // تحديث الدرجة
    document.getElementById('current-score').textContent = examEngine.score;

    // تأثير احتفالي عند الإجابة الصحيحة
    if (isCorrect) {
      this.celebrateCorrectAnswer();
    }

    // عرض الأزرار
    document.getElementById('prev-btn').style.display = 'block';
    if (examEngine.currentQuestionIndex < examEngine.totalQuestions - 1) {
      document.getElementById('next-btn').style.display = 'block';
      document.getElementById('next-btn').textContent = 'السؤال التالي ←';
    } else {
      document.getElementById('next-btn').style.display = 'block';
      document.getElementById('next-btn').textContent = '🏆 إنهاء الاختبار';
    }
  }

  /**
   * تأثير احتفالي عند الإجابة الصحيحة
   */
  celebrateCorrectAnswer() {
    // إضافة تأثير بصري
    const questionCard = document.getElementById('question-card');
    questionCard.style.animation = 'none';
    setTimeout(() => {
      questionCard.style.animation = 'pulse 0.5s ease';
    }, 10);
  }

  /**
   * السؤال التالي
   */
  nextQuestion() {
    if (examEngine.nextQuestion()) {
      this.displayQuestion();
    } else {
      this.finishExam();
    }
  }

  /**
   * السؤال السابق
   */
  previousQuestion() {
    if (examEngine.previousQuestion()) {
      this.displayQuestion();
    }
  }

  /**
   * إنهاء الاختبار
   */
  finishExam() {
    this.examActive = false;
    clearInterval(this.timerInterval);

    const results = examEngine.finishExam();
    examEngine.saveResults(results);

    // إخفاء شاشة الاختبار
    document.getElementById('exam-container').classList.remove('active');

    // عرض النتائج
    this.showResults(results);
  }

  /**
   * عرض النتائج
   */
  showResults(results) {
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.classList.add('active');

    const minutes = Math.floor(results.duration / 60);
    const seconds = results.duration % 60;

    document.getElementById('results-grade').textContent = results.grade.emoji;
    document.getElementById('results-percentage').textContent = `${results.percentage}%`;
    document.getElementById('results-score').textContent = `حصلت على ${results.score} من ${results.totalQuestions} أسئلة`;
    document.getElementById('results-grade-text').textContent = results.grade.grade;
    document.getElementById('results-time').textContent = `الوقت المستغرق: ${minutes} دقيقة و ${seconds} ثانية`;

    // عرض الأسئلة الخاطئة
    const wrongAnswers = examEngine.getWrongAnswers();
    const wrongCount = wrongAnswers.length;
    document.getElementById('wrong-count').textContent = wrongCount;

    // تأثير احتفالي عند النجاح
    if (results.percentage >= 70) {
      this.celebrateSuccess();
    }
  }

  /**
   * تأثير احتفالي عند النجاح
   */
  celebrateSuccess() {
    // إضافة تأثير بصري للاحتفال
    const resultsCard = document.querySelector('.results-card');
    resultsCard.style.animation = 'bounce 0.6s ease';
  }

  /**
   * مراجعة الأخطاء
   */
  reviewWrongAnswers() {
    const wrongAnswers = examEngine.getWrongAnswers();
    const reviewContainer = document.getElementById('review-container');
    reviewContainer.classList.add('active');

    const reviewContent = document.getElementById('review-content');
    reviewContent.innerHTML = '<h3 class="review-header">الأسئلة التي أخطأت فيها</h3>';

    wrongAnswers.forEach((answer, index) => {
      const reviewItem = document.createElement('div');
      reviewItem.className = 'review-item';
      reviewItem.innerHTML = `
        <div class="review-question">س${index + 1}: ${answer.questionText}</div>
        <div class="review-answer wrong">❌ إجابتك: ${answer.userAnswer}</div>
        <div class="review-answer correct">✅ الإجابة الصحيحة: ${answer.correctAnswer}</div>
        <div class="review-explanation">${answer.explanation}</div>
      `;
      reviewContent.appendChild(reviewItem);
    });

    // إخفاء النتائج
    document.getElementById('results-container').classList.remove('active');
  }

  /**
   * إعادة الاختبار
   */
  restartExam() {
    examEngine.reset();
    document.getElementById('results-container').classList.remove('active');
    document.getElementById('review-container').classList.remove('active');
    this.showChapters(this.currentBook);
  }

  /**
   * العودة للكتب
   */
  backToBooks() {
    document.getElementById('chapters-container').classList.remove('active');
    document.getElementById('books-container').parentElement.style.display = 'block';
    document.getElementById('searchInput').value = '';
    examEngine.reset();
  }

  /**
   * تحديث شريط التقدم
   */
  updateProgress() {
    const progress = ((examEngine.currentQuestionIndex) / examEngine.totalQuestions) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('progress-text').textContent = `السؤال ${examEngine.currentQuestionIndex + 1} من ${examEngine.totalQuestions}`;
  }

  /**
   * بدء المؤقت
   */
  startTimer() {
    let seconds = 0;
    const timerElement = document.getElementById('timer');
    
    this.timerInterval = setInterval(() => {
      seconds++;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      timerElement.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 1000);
  }

  /**
   * إعداد مستمعي الأحداث
   */
  setupEventListeners() {
    document.getElementById('next-btn').addEventListener('click', () => this.nextQuestion());
    document.getElementById('prev-btn').addEventListener('click', () => this.previousQuestion());
    document.getElementById('back-btn').addEventListener('click', () => this.backToBooks());
    document.getElementById('restart-btn').addEventListener('click', () => this.restartExam());
    document.getElementById('review-btn').addEventListener('click', () => this.reviewWrongAnswers());
    document.getElementById('back-to-books-btn').addEventListener('click', () => this.backToBooks());
  }
}

// تهيئة التطبيق عند تحميل الصفحة
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new ExamApp();
});
