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
    this.navigationStack = ['books'];
    this.timerInterval = null;
    this.init();
  }

  async init() {
    console.log('Initializing Exam App...');
    await this.loadBooks();
    this.setupEventListeners();
    this.setupHistoryListener();
    history.replaceState({ page: 'books' }, '', window.location.href);
  }

  setupHistoryListener() {
    window.addEventListener('popstate', (event) => {
      if (event.state) {
        this.handleNavigation(event.state);
      }
    });
  }

  handleNavigation(state) {
    if (!state) {
      this.backToBooks();
      return;
    }
    
    if (state.page === 'books') {
      this.backToBooks();
    } else if (state.page === 'chapters' && state.book) {
      this.currentBook = state.book;
      this.showChapters(state.book);
    } else if (state.page === 'exam') {
      this.finishExam();
    }
  }

  pushState(page, data = {}) {
    const state = { page, timestamp: Date.now(), ...data };
    history.pushState(state, '', window.location.href);
    this.navigationStack.push(page);
  }

  async loadBooks() {
    try {
      this.books = await examEngine.loadBooks();
      console.log('Books loaded:', this.books.length);
      this.renderBooks();
    } catch (error) {
      console.error('Error loading books:', error);
    }
  }

  renderBooks(booksToRender = null) {
    const booksContainer = document.getElementById('books-container');
    const noResults = document.getElementById('no-results');
    const booksArray = booksToRender || this.books;
    
    if (!booksContainer) {
      console.error('books-container not found');
      return;
    }
    
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

  selectBook(book) {
    this.currentBook = book;
    this.pushState('chapters', { book });
    this.showChapters(book);
  }

  showChapters(book) {
    const booksSection = document.getElementById('books-section');
    const chaptersContainer = document.getElementById('chapters-container');
    
    if (booksSection) booksSection.style.display = 'none';
    if (chaptersContainer) chaptersContainer.classList.add('active');

    const chaptersTitle = document.getElementById('chapters-title');
    const chaptersAuthor = document.getElementById('chapters-author');
    
    if (chaptersTitle) chaptersTitle.textContent = book.title;
    if (chaptersAuthor) chaptersAuthor.textContent = `بقلم: ${book.author}`;

    const chaptersGrid = document.getElementById('chapters-grid');
    if (!chaptersGrid) {
      console.error('chapters-grid not found');
      return;
    }
    
    chaptersGrid.innerHTML = '';

    for (let i = 1; i <= book.chapters; i++) {
      const chapterCard = document.createElement('div');
      chapterCard.className = 'chapter-card';
      chapterCard.innerHTML = `
        <h4>الفصل ${i}</h4>
        <p>اختبر معلوماتك في الفصل ${i}</p>
        <button class="start-exam-btn">ابدأ الاختبار</button>
      `;
      
      const btn = chapterCard.querySelector('.start-exam-btn');
      btn.addEventListener('click', () => this.startExam(book.id, i));
      
      chaptersGrid.appendChild(chapterCard);
    }
  }

  async startExam(bookId, chapterNum) {
    console.log(`Starting exam for book: ${bookId}, chapter: ${chapterNum}`);
    
    const chapter = await examEngine.loadChapter(bookId, chapterNum);
    if (!chapter) {
      alert('خطأ في تحميل الفصل');
      return;
    }

    console.log('Chapter loaded with questions:', chapter.questions.length);

    this.currentChapter = chapterNum;
    this.examActive = true;

    this.pushState('exam', { bookId, chapterNum });

    const booksSection = document.getElementById('books-section');
    const chaptersContainer = document.getElementById('chapters-container');
    const examContainer = document.getElementById('exam-container');
    
    if (booksSection) booksSection.style.display = 'none';
    if (chaptersContainer) chaptersContainer.classList.remove('active');
    if (examContainer) examContainer.classList.add('active');

    this.startTimer();
    this.displayQuestion();
  }

  displayQuestion() {
    const question = examEngine.getCurrentQuestion();
    if (!question) {
      console.error('No question found');
      return;
    }

    console.log('Displaying question:', question.q.substring(0, 50));

    const questionCard = document.getElementById('question-card');
    if (!questionCard) {
      console.error('question-card not found');
      return;
    }
    
    // Clear previous content
    questionCard.innerHTML = '';
    
    // Create question text wrapper
    const questionWrapper = document.createElement('div');
    questionWrapper.className = 'question-text-wrapper';
    const questionText = document.createElement('div');
    questionText.className = 'question-text';
    questionText.textContent = question.q;
    questionWrapper.appendChild(questionText);
    questionCard.appendChild(questionWrapper);
    
    // Create options grid
    const optionsGrid = document.createElement('div');
    optionsGrid.className = 'options-grid';
    optionsGrid.id = 'options-container';
    
    const letters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
    
    question.options.forEach((option, index) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.setAttribute('data-letter', letters[index] || String.fromCharCode(65 + index));
      btn.textContent = option;
      btn.addEventListener('click', () => this.selectAnswer(index));
      optionsGrid.appendChild(btn);
    });
    
    questionCard.appendChild(optionsGrid);
    
    // Create feedback element
    const feedback = document.createElement('div');
    feedback.className = 'feedback';
    feedback.id = 'feedback';
    questionCard.appendChild(feedback);

    this.updateProgress();

    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    if (nextBtn) nextBtn.style.display = 'none';
    if (prevBtn) prevBtn.style.display = 'none';
  }

  selectAnswer(optionIndex) {
    const isCorrect = examEngine.submitAnswer(optionIndex);
    const question = examEngine.getCurrentQuestion();

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

    const feedback = document.getElementById('feedback');
    if (feedback) {
      feedback.classList.add('show');
      feedback.classList.add(isCorrect ? 'correct' : 'wrong');
      feedback.innerHTML = `
        ${isCorrect ? '✅ إجابة صحيحة!' : '❌ إجابة خاطئة'}
        <div class="explanation"><strong>الشرح:</strong> ${question.explanation}</div>
      `;
    }

    const currentScore = document.getElementById('current-score');
    if (currentScore) currentScore.textContent = examEngine.score;

    if (isCorrect) {
      this.celebrateCorrectAnswer();
    }

    const prevBtn = document.getElementById('prev-btn');
    if (prevBtn) prevBtn.style.display = 'block';
    
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
      nextBtn.style.display = 'block';
      if (examEngine.currentQuestionIndex < examEngine.totalQuestions - 1) {
        nextBtn.textContent = 'السؤال التالي ←';
      } else {
        nextBtn.textContent = '🏆 إنهاء الاختبار';
      }
    }
  }

  celebrateCorrectAnswer() {
    const questionCard = document.getElementById('question-card');
    if (questionCard) {
      questionCard.style.animation = 'none';
      setTimeout(() => {
        questionCard.style.animation = 'pulse 0.5s ease';
      }, 10);
    }
  }

  nextQuestion() {
    if (examEngine.nextQuestion()) {
      this.displayQuestion();
    } else {
      this.finishExam();
    }
  }

  previousQuestion() {
    if (examEngine.previousQuestion()) {
      this.displayQuestion();
    }
  }

  finishExam() {
    this.examActive = false;
    if (this.timerInterval) clearInterval(this.timerInterval);

    const results = examEngine.finishExam();
    examEngine.saveResults(results);

    const examContainer = document.getElementById('exam-container');
    if (examContainer) examContainer.classList.remove('active');

    this.showResults(results);
  }

  showResults(results) {
    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) resultsContainer.classList.add('active');

    const minutes = Math.floor(results.duration / 60);
    const seconds = results.duration % 60;

    const elements = {
      'results-grade': results.grade.emoji,
      'results-percentage': `${results.percentage}%`,
      'results-score': `حصلت على ${results.score} من ${results.totalQuestions} أسئلة`,
      'results-grade-text': results.grade.grade,
      'results-time': `الوقت المستغرق: ${minutes} دقيقة و ${seconds} ثانية`
    };

    Object.entries(elements).forEach(([id, content]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = content;
    });

    const wrongAnswers = examEngine.getWrongAnswers();
    const wrongCount = wrongAnswers.length;
    const wrongCountEl = document.getElementById('wrong-count');
    if (wrongCountEl) wrongCountEl.textContent = wrongCount;

    if (results.percentage >= 70) {
      this.celebrateSuccess();
    }
  }

  celebrateSuccess() {
    const resultsCard = document.querySelector('.results-card');
    if (resultsCard) {
      resultsCard.style.animation = 'bounce 0.6s ease';
    }
  }

  reviewWrongAnswers() {
    const wrongAnswers = examEngine.getWrongAnswers();
    const reviewContainer = document.getElementById('review-container');
    if (reviewContainer) reviewContainer.classList.add('active');

    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) resultsContainer.classList.remove('active');

    const reviewContent = document.getElementById('review-content');
    if (!reviewContent) return;
    
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
  }

  restartExam() {
    examEngine.reset();
    const resultsContainer = document.getElementById('results-container');
    const reviewContainer = document.getElementById('review-container');
    if (resultsContainer) resultsContainer.classList.remove('active');
    if (reviewContainer) reviewContainer.classList.remove('active');
    this.showChapters(this.currentBook);
  }

  backToBooks() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    
    const chaptersContainer = document.getElementById('chapters-container');
    const examContainer = document.getElementById('exam-container');
    const resultsContainer = document.getElementById('results-container');
    const reviewContainer = document.getElementById('review-container');
    const booksSection = document.getElementById('books-section');
    
    if (chaptersContainer) chaptersContainer.classList.remove('active');
    if (examContainer) examContainer.classList.remove('active');
    if (resultsContainer) resultsContainer.classList.remove('active');
    if (reviewContainer) reviewContainer.classList.remove('active');
    if (booksSection) booksSection.style.display = 'block';
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    examEngine.reset();
    this.navigationStack = ['books'];
  }

  updateProgress() {
    const progress = ((examEngine.currentQuestionIndex) / examEngine.totalQuestions) * 100;
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) progressFill.style.width = `${progress}%`;
    
    const progressText = document.getElementById('progress-text');
    if (progressText) progressText.textContent = `${examEngine.currentQuestionIndex + 1}/${examEngine.totalQuestions}`;
    
    const wrongCount = examEngine.getWrongAnswers().length;
    const wrongScore = document.getElementById('wrong-score');
    if (wrongScore) wrongScore.textContent = wrongCount;
  }

  startTimer() {
    let seconds = 0;
    const timerElement = document.getElementById('timer');
    
    if (!timerElement) {
      console.error('Timer element not found');
      return;
    }
    
    this.timerInterval = setInterval(() => {
      seconds++;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      timerElement.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 1000);
  }

  setupEventListeners() {
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const backBtn = document.getElementById('back-btn');
    const restartBtn = document.getElementById('restart-btn');
    const reviewBtn = document.getElementById('review-btn');
    const backToBooksBtn = document.getElementById('back-to-books-btn');
    
    if (nextBtn) nextBtn.addEventListener('click', () => this.nextQuestion());
    if (prevBtn) prevBtn.addEventListener('click', () => this.previousQuestion());
    if (backBtn) backBtn.addEventListener('click', () => this.backToBooks());
    if (restartBtn) restartBtn.addEventListener('click', () => this.restartExam());
    if (reviewBtn) reviewBtn.addEventListener('click', () => this.reviewWrongAnswers());
    if (backToBooksBtn) backToBooksBtn.addEventListener('click', () => this.backToBooks());
  }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded');
  app = new ExamApp();
});
