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
    try {
      await this.loadBooks();
      await this.loadContactInfo(); // تحميل معلومات التواصل
      this.setupEventListeners();
      this.setupHistoryListener();
      
      // فحص الرابط عند التحميل لأول مرة
      this.handleInitialState();
    } catch (error) {
      console.error('Initialization error:', error);
    }
  }

  // ===== دالة تجهيز أسئلة الفصل بنسخة عميقة وخلط الخيارات مع ضمان دقة التصحيح =====
  prepareChapterQuestions(originalQuestions) {
    if (!originalQuestions || !Array.isArray(originalQuestions)) return [];
    
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
        `<a href="${link.url}" target="_blank" class="footer-link-btn">${link.label}</a>`
      ).join('');
    }
  }

  handleInitialState() {
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get('book');
    const chapterNum = params.get('chapter');

    if (bookId && chapterNum && this.books.length > 0) {
      const book = this.books.find(b => b.id === bookId);
      if (book) {
        this.selectBook(book);
        setTimeout(() => this.startExam(bookId, parseInt(chapterNum), false), 500);
      }
    }
  }

  setupHistoryListener() {
    window.addEventListener('popstate', (event) => {
      if (event.state) {
        if (event.state.page === 'books') {
          this.backToBooks(false);
        } else if (event.state.page === 'chapters') {
          const book = this.books.find(b => b.id === event.state.bookId);
          if (book) this.showChapters(book);
        }
      } else {
        this.backToBooks(false);
      }
    });
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
      // 1. محاولة التحميل من LocalStorage أولاً (سرعة فائقة)
      const cachedBooks = localStorage.getItem('exam_books_cache');
      if (cachedBooks) {
        this.books = JSON.parse(cachedBooks);
        this.renderBooks();
      } else if (typeof BOOKS !== 'undefined' && BOOKS.length > 0) {
        this.books = BOOKS;
        this.renderBooks();
      }

      // 2. تحديث البيانات من السيرفر
      await this.syncBooksInBackground();
    } catch (error) {
      console.error('Error loading books:', error);
    }
  }

  async syncBooksInBackground() {
    try {
      const timestamp = new Date().getTime();
      const res = await fetch(`${examEngine.basePath}/data/books.json?t=${timestamp}`);
      if (res.ok) {
        const freshBooks = await res.json();
        if (JSON.stringify(freshBooks) !== JSON.stringify(this.books)) {
          this.books = freshBooks;
          localStorage.setItem('exam_books_cache', JSON.stringify(freshBooks));
          this.renderBooks();
        }
      }
    } catch (e) {
      console.warn('Background sync failed.');
    }
  }

  renderBooks(booksArray = this.books) {
    const booksContainer = document.getElementById('books-container');
    const noResults = document.getElementById('no-results');
    
    if (!booksContainer) return;
    booksContainer.innerHTML = '';
    
    if (!booksArray || booksArray.length === 0) {
      if (noResults) noResults.style.display = 'block';
      return;
    }
    
    if (noResults) noResults.style.display = 'none';

    booksArray.forEach(book => {
      const bookCard = document.createElement('div');
      bookCard.className = 'book-card';
      
      const startBtn = document.createElement('button');
      startBtn.className = 'book-start-btn';
      startBtn.textContent = 'دخول الاختبار';
      startBtn.onclick = (e) => {
        e.stopPropagation();
        this.selectBook(book);
      };
      
      bookCard.innerHTML = `
        <div class="book-icon"><i class="fas fa-book-open"></i></div>
        <h3>${book.title}</h3>
        <span class="author">${book.author || 'مستشار قانوني'}</span>
        <div class="chapters-count">⏳ ${book.chapters || 0} فصل</div>
      `;
      
      bookCard.appendChild(startBtn);
      bookCard.onclick = () => this.selectBook(book);
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
      (book.title && book.title.toLowerCase().includes(query)) ||
      (book.author && book.author.toLowerCase().includes(query)) ||
      (book.description && book.description.toLowerCase().includes(query))
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
    const booksSection = document.getElementById('books-section');
    const chaptersContainer = document.getElementById('chapters-container');
    const examContainer = document.getElementById('exam-container');
    const resultsContainer = document.getElementById('results-container');
    
    if (booksSection) booksSection.style.display = 'none';
    if (chaptersContainer) chaptersContainer.classList.add('active');
    if (examContainer) examContainer.classList.remove('active');
    if (resultsContainer) resultsContainer.classList.remove('active');
    
    const chaptersTitle = document.getElementById('chapters-title');
    const chaptersAuthor = document.getElementById('chapters-author');
    if (chaptersTitle) chaptersTitle.textContent = book.title;
    if (chaptersAuthor) chaptersAuthor.textContent = `بقلم: ${book.author || 'مستشار قانوني'}`;
    
    const chaptersGrid = document.getElementById('chapters-grid');
    if (!chaptersGrid) return;

    const cacheKey = `chapters_cache_${book.id}`;
    const cachedChapters = localStorage.getItem(cacheKey);
    if (cachedChapters) {
      this.renderChaptersGrid(book, JSON.parse(cachedChapters));
    } else {
      chaptersGrid.innerHTML = '<p style="text-align:center;color:#94a3b8">جاري تحميل الفصول...</p>';
    }

    await this.syncChaptersInBackground(book, cacheKey);
  }

  async syncChaptersInBackground(book, cacheKey) {
    try {
      const timestamp = new Date().getTime();
      const res = await fetch(`https://api.github.com/repos/mohammed1920/exam-platform-v2/contents/data/${book.id}?t=${timestamp}`);
      if (res.ok) {
        const files = await res.json();
        let chapterFiles = [];
        for (const file of files) {
          const m = file.name.match(/^chapter_(\d+)\.json$/);
          if (m) chapterFiles.push({ num: parseInt(m[1]) });
        }
        chapterFiles.sort((a, b) => a.num - b.num);

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

        localStorage.setItem(cacheKey, JSON.stringify(chapterData));
        this.renderChaptersGrid(book, chapterData);
      }
    } catch (e) {
      console.warn('Chapters background sync failed.');
    }
  }

  renderChaptersGrid(book, chapterData) {
    const chaptersGrid = document.getElementById('chapters-grid');
    if (!chaptersGrid) return;
    chaptersGrid.innerHTML = '';
    
    if (!chapterData || chapterData.length === 0) {
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
      chapterCard.querySelector('.start-exam-btn').onclick = () => this.startExam(book.id, ch.num);
      chaptersGrid.appendChild(chapterCard);
    });
  }

  async startExam(bookId, chapterNum, pushHistory = true) {
    try {
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

      const booksSection = document.getElementById('books-section');
      const chaptersContainer = document.getElementById('chapters-container');
      const examContainer = document.getElementById('exam-container');
      const resultsContainer = document.getElementById('results-container');

      if (booksSection) booksSection.style.display = 'none';
      if (chaptersContainer) chaptersContainer.classList.remove('active');
      if (examContainer) examContainer.classList.add('active');
      if (resultsContainer) resultsContainer.classList.remove('active');

      this.startTimer();
      this.displayQuestion();
    } catch (error) {
      console.error('Error starting exam:', error);
    }
  }

  displayQuestion() {
    const question = examEngine.getCurrentQuestion();
    if (!question) return;

    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const feedback = document.getElementById('feedback');
    const nextBtn = document.getElementById('next-btn');

    if (questionText) questionText.textContent = question.question;
    if (optionsContainer) optionsContainer.innerHTML = '';
    if (feedback) feedback.classList.remove('show', 'correct', 'wrong');
    if (nextBtn) nextBtn.style.display = 'none';

    const letters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
    if (optionsContainer && question.options) {
      question.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.setAttribute('data-letter', letters[index] || '');
        btn.textContent = option;
        btn.onclick = () => this.checkAnswer(index);
        optionsContainer.appendChild(btn);
      });
    }

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
    if (feedback) {
      feedback.classList.add('show', isCorrect ? 'correct' : 'wrong');
      feedback.innerHTML = `
        <strong>${isCorrect ? '✅ إجابة صحيحة!' : '❌ إجابة خاطئة'}</strong>
        <div class="explanation">${question.explanation || "لا يوجد شرح متوفر حالياً."}</div>
      `;
    }

    const currentScoreEl = document.getElementById('current-score');
    const wrongScoreEl = document.getElementById('wrong-score');
    if (currentScoreEl) currentScoreEl.textContent = examEngine.score;
    if (wrongScoreEl) wrongScoreEl.textContent = examEngine.getWrongAnswers().length;

    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
      nextBtn.style.display = 'block';
      nextBtn.textContent = examEngine.currentQuestionIndex < examEngine.totalQuestions - 1 ? 'السؤال التالي ←' : '🏆 إنهاء الاختبار';
    }
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
    const examContainer = document.getElementById('exam-container');
    const resultsContainer = document.getElementById('results-container');
    
    if (examContainer) examContainer.classList.remove('active');
    if (resultsContainer) resultsContainer.classList.add('active');

    const resGrade = document.getElementById('results-grade');
    const resPercent = document.getElementById('results-percentage');
    const resScore = document.getElementById('results-score');
    const resGradeText = document.getElementById('results-grade-text');
    const resTime = document.getElementById('results-time');
    const wrongCount = document.getElementById('wrong-count');

    if (resGrade) resGrade.textContent = results.grade.emoji;
    if (resPercent) resPercent.textContent = `${results.percentage}%`;
    if (resScore) resScore.textContent = `حصلت على ${results.score} من ${results.totalQuestions}`;
    if (resGradeText) resGradeText.textContent = results.grade.grade;
    
    const mins = Math.floor(results.duration / 60);
    const secs = results.duration % 60;
    if (resTime) resTime.textContent = `الوقت: ${mins}:${secs.toString().padStart(2, '0')}`;
    if (wrongCount) wrongCount.textContent = examEngine.getWrongAnswers().length;
  }

  updateProgress() {
    const current = examEngine.currentQuestionIndex + 1;
    const total = examEngine.totalQuestions;
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (progressFill) progressFill.style.width = `${(current / total) * 100}%`;
    if (progressText) progressText.textContent = `${current}/${total}`;
  }

  startTimer() {
    let seconds = 0;
    const timerEl = document.getElementById('timer');
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      seconds++;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (timerEl) timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
    
    const booksSection = document.getElementById('books-section');
    if (booksSection) booksSection.style.display = 'block';
    
    const reviewContent = document.getElementById('review-content');
    if (reviewContent) reviewContent.innerHTML = '';
    
    examEngine.reset();
  }

  restartExam() {
    examEngine.currentQuestionIndex = 0;
    examEngine.score = 0;
    examEngine.userAnswers = [];
    examEngine.startTime = new Date();

    if (this.currentQuestions && this.currentQuestions.length > 0) {
      this.currentQuestions = this.prepareChapterQuestions(this.currentQuestions);
      examEngine.questions = this.currentQuestions;
    }
    
    this.examActive = true;
    document.body.classList.add('exam-mode');

    const resContainer = document.getElementById('results-container');
    const examContainer = document.getElementById('exam-container');
    if (resContainer) resContainer.classList.remove('active');
    if (examContainer) examContainer.classList.add('active');
    
    const curScore = document.getElementById('current-score');
    const wrgScore = document.getElementById('wrong-score');
    if (curScore) curScore.textContent = '0';
    if (wrgScore) wrgScore.textContent = '0';

    this.startTimer();
    this.displayQuestion();
  }

  setupEventListeners() {
    const nextBtn = document.getElementById('next-btn');
    const backBtn = document.getElementById('back-btn');
    const restartBtn = document.getElementById('restart-btn');
    const backToBooksBtn = document.getElementById('back-to-books-btn');
    const reviewBtn = document.getElementById('review-btn');
    const backReviewBtn = document.getElementById('back-review-btn');
    const searchInput = document.getElementById('searchInput');

    if (nextBtn) nextBtn.onclick = () => this.nextQuestion();
    if (backBtn) backBtn.onclick = () => this.backToBooks();
    if (restartBtn) restartBtn.onclick = () => this.restartExam();
    if (backToBooksBtn) backToBooksBtn.onclick = () => this.backToBooks();
    if (reviewBtn) reviewBtn.onclick = () => this.showReview();
    if (backReviewBtn) backReviewBtn.onclick = () => this.backToBooks();
    if (searchInput) searchInput.oninput = () => this.filterBooks();
  }

  showReview() {
    const wrongAnswers = examEngine.getWrongAnswers();
    if (wrongAnswers.length === 0) return;

    const resContainer = document.getElementById('results-container');
    const revContainer = document.getElementById('review-container');
    if (resContainer) resContainer.classList.remove('active');
    if (revContainer) revContainer.classList.add('active');
    
    const reviewContent = document.getElementById('review-content');
    if (!reviewContent) return;
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
