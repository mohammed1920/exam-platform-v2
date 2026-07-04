/**
 * Exam Platform V2 - Main Application
 * تطبيق منصة الاختبارات الرئيسي المطور
 * تم التوحيد: استخدام المفاتيح الموحدة لضمان الأمان واستقرار الواجهة.
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
      // التحقق الآمن من تحميل محرك الاختبارات لتفادي خطأ توقف جلب الكتب
      if (typeof ExamEngine !== 'undefined') {
        window.examEngine = new ExamEngine();
      } else {
        console.warn('ExamEngine is not defined yet. Retrying in 300ms...');
        setTimeout(() => this.init(), 300);
        return;
      }

      await this.loadBooks();
      await this.loadContactInfo(); // تحميل أزرار ومعلومات التواصل في الفوتر
      this.setupEventListeners();
      this.setupHistoryListener();
      
      // فحص الرابط عند التحميل لأول مرة لتحديد الواجهة المناسبة
      this.handleInitialState();
    } catch (error) {
      console.error('Initialization error:', error);
    }
  }

  // ===== دالة تجهيز أسئلة الفصل بنسخة عميقة وخلط الخيارات =====
  prepareChapterQuestions(originalQuestions) {
    if (!originalQuestions || !Array.isArray(originalQuestions)) return [];
    
    // أخذ نسخة عميقة ونظيفة (Deep Copy) لمنع التداخل مع أي بيانات ثابتة أثناء التنقل
    const questionsCopy = JSON.parse(JSON.stringify(originalQuestions));

    return questionsCopy.map(q => {
      if (!q.options || q.options.length === 0) return q;

      // 1. حفظ النص الفعلي للإجابة الصحيحة الأصلية قبل البعثرة
      const correctText = q.options[q.answer];

      // 2. خلط الخيارات عشوائياً باستخدام خوارزمية Fisher-Yates
      const shuffledOptions = [...q.options];
      for (let i = shuffledOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
      }

      // 3. العثور على الفهرس الجديد للنص الصحيح داخل المصفوفة المبعثرة
      const newAnswerIndex = shuffledOptions.indexOf(correctText);

      // 4. إرجاع كائن السؤال المحدث بالخيارات الجديدة وفهرس الإجابة الصحيح
      return {
        ...q,
        options: shuffledOptions,
        answer: newAnswerIndex !== -1 ? newAnswerIndex : q.answer
      };
    });
  }

  async loadBooks() {
    if (window.examEngine) {
      // جلب البيانات من المحرك الرئيسي مباشرة
      this.books = await window.examEngine.loadBooks();
      this.renderBooks(this.books);
    } else {
      console.error('ExamEngine instance not available.');
    }
  }

  async loadContactInfo() {
    // دالة افتراضية مخصصة لتحديث روابط التواصل الاجتماعي أو الدعم بالفوتر عند الحاجة
    console.log('Contact info loaded.');
  }

  renderBooks(booksList) {
    const container = document.getElementById('books-grid');
    if (!container) return;

    container.innerHTML = '';
    
    if (!booksList || booksList.length === 0) {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px;">جاري تحميل الكتب أو لا توجد كتب متاحة حالياً...</div>';
      return;
    }

    booksList.forEach(book => {
      const card = document.createElement('div');
      card.className = 'book-card';
      // تطبيق اللون المخصص للكتاب إن وجد في ملف التعريف
      if (book.color) {
        card.style.borderTop = `4px solid ${book.color}`;
      }
      
      card.innerHTML = `
        <div class="book-icon"><i class="fas fa-book-scale"></i></div>
        <div>
          <div class="book-title">${book.title}</div>
          <div class="book-author">${book.author || 'مستشار قانوني'}</div>
          <div class="book-desc">${book.description || 'لا يوجد وصف متوفر حالياً لهذا الكتاب القانوني.'}</div>
        </div>
        <div class="book-meta">
          <span class="chapters-badge">${book.chapters || 0} فصول</span>
          <button style="margin-top: 10px;" onclick="window.examApp.selectBook('${book.id}')">عرض الفصول</button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  filterBooks() {
    const query = document.getElementById('search-input')?.value.trim().toLowerCase() || '';
    if (!query) {
      this.renderBooks(this.books);
      return;
    }
    const filtered = this.books.filter(b => 
      b.title.toLowerCase().includes(query) || 
      (b.description && b.description.toLowerCase().includes(query))
    );
    this.renderBooks(filtered);
  }

  async selectBook(bookId) {
    this.currentBook = this.books.find(b => b.id === bookId);
    if (!this.currentBook) return;

    this.navigateTo('chapters', { bookId });
    this.renderChaptersView();
  }

  renderChaptersView() {
    const titleElem = document.getElementById('book-view-title');
    const descElem = document.getElementById('book-view-desc');
    const listContainer = document.getElementById('chapters-list');

    if (titleElem) titleElem.textContent = this.currentBook.title;
    if (descElem) descElem.textContent = this.currentBook.description || '';
    if (listContainer) {
      listContainer.innerHTML = '';
      
      const totalChapters = this.currentBook.chapters || 0;
      if (totalChapters === 0) {
        listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary);">لا توجد فصول متوفرة لهذا الكتاب حالياً.</div>';
        return;
      }

      for (let i = 1; i <= totalChapters; i++) {
        const item = document.createElement('div');
        item.className = 'chapter-item';
        item.innerHTML = `
          <div class="chapter-info">
            <h3>الفصل ${i}</h3>
            <p>مجموعة اختبارات مخصصة لأسئلة المادة</p>
          </div>
          <button class="footer-link-btn" onclick="window.examApp.startChapterExam('${this.currentBook.id}', ${i})">ابدأ الاختبار</button>
        `;
        listContainer.appendChild(item);
      }
    }
  }

  async startChapterExam(bookId, chapterNum) {
    if (!window.examEngine) return;
    
    // إظهار واجهة التحميل المؤقتة
    document.body.classList.add('exam-mode');
    
    const chapterData = await window.examEngine.loadChapter(bookId, chapterNum);
    if (!chapterData || !chapterData.questions || chapterData.questions.length === 0) {
      alert('نعتذر، لم يتم العثور على أسئلة لهذا الفصل أو الملف غير متوفر حالياً.');
      document.body.classList.remove('exam-mode');
      return;
    }

    this.currentBook = this.books.find(b => b.id === bookId);
    this.currentChapter = chapterNum;
    
    // بعثرة الأسئلة والخيارات محلياً بالدالة النظيفة مع الحفاظ على سلامة محرك التصحيح
    this.currentQuestions = this.prepareChapterQuestions(chapterData.questions);
    
    // إعادة تعيين بيانات المحرك للبدء الفعلي بأسئلة الامتحان الجديدة المخلّطة
    window.examEngine.questions = this.currentQuestions;
    window.examEngine.totalQuestions = this.currentQuestions.length;
    window.examEngine.currentQuestionIndex = 0;
    window.examEngine.score = 0;
    window.examEngine.userAnswers = [];
    window.examEngine.startTime = new Date();

    this.examActive = true;
    this.navigateTo('exam', { bookId, chapter: chapterNum });
    this.renderQuestion();
  }

  renderQuestion() {
    if (!window.examEngine) return;
    const engine = window.examEngine;
    const q = engine.questions[engine.currentQuestionIndex];
    if (!q) return;

    // تحديث البار العلوي والمؤشرات الرقمية للامتحان
    const currentQElem = document.getElementById('current-question-num');
    const totalQElem = document.getElementById('total-questions-num');
    const progressBar = document.getElementById('exam-progress-bar');
    const qTextElem = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');

    if (currentQElem) currentQElem.textContent = engine.currentQuestionIndex + 1;
    if (totalQElem) totalQElem.textContent = engine.totalQuestions;
    
    if (progressBar) {
      const pct = ((engine.currentQuestionIndex) / engine.totalQuestions) * 100;
      progressBar.style.width = `${pct}%`;
    }

    if (qTextElem) qTextElem.textContent = q.question;
    
    if (optionsContainer) {
      optionsContainer.innerHTML = '';
      q.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = option;
        
        // التحقق مما إذا كان المستخدم قد أجاب مسبقاً على هذا السؤال (في حالة التنقل للخلف)
        const existingAns = engine.userAnswers.find(a => a.questionIndex === engine.currentQuestionIndex);
        if (existingAns) {
          btn.classList.add('disabled');
          btn.disabled = true;
          if (index === q.answer) {
            btn.classList.add('correct');
          } else if (index === q.options.indexOf(existingAns.userAnswer)) {
            btn.classList.add('incorrect');
          }
        } else {
          btn.onclick = () => this.handleAnswerSelect(index);
        }
        optionsContainer.appendChild(btn);
      });
    }

    // إدارة ظهور زر السابق
    const prevBtn = document.getElementById('prev-question-btn');
    if (prevBtn) {
      prevBtn.style.display = engine.currentQuestionIndex > 0 ? 'block' : 'none';
    }
  }

  handleAnswerSelect(optionIndex) {
    if (!window.examEngine) return;
    const engine = window.examEngine;
    
    // تسجيل الإجابة داخل المحرك الأصلي والتصحيح الفوري
    engine.answerQuestion(optionIndex);
    
    // إعادة تلوين واجهة الخيارات فوراً لإظهار الإجابة الصحيحة والخاطئة للمستخدم
    const optionsContainer = document.getElementById('options-container');
    if (optionsContainer) {
      const buttons = optionsContainer.getElementsByClassName('option-btn');
      const currentQ = engine.questions[engine.currentQuestionIndex];
      
      for (let i = 0; i < buttons.length; i++) {
        buttons[i].classList.add('disabled');
        buttons[i].disabled = true;
        if (i === currentQ.answer) {
          buttons[i].classList.add('correct');
        } else if (i === optionIndex) {
          buttons[i].classList.add('incorrect');
        }
      }
    }

    // الانتقال التلقائي للسؤال التالي بعد ثانية واحدة لإعطاء المستخدم فرصة لرؤية الجواب
    setTimeout(() => {
      if (engine.currentQuestionIndex < engine.questions.length - 1) {
        engine.nextQuestion();
        this.renderQuestion();
      } else {
        this.showResults();
      }
    }, 1100);
  }

  prevQuestion() {
    if (window.examEngine && window.examEngine.currentQuestionIndex > 0) {
      window.examEngine.currentQuestionIndex--;
      this.renderQuestion();
    }
  }

  exitExam() {
    if (confirm('هل أنت متأكد من رغبتك في إنهاء الاختبار والعودة للقائمة الرئيسية؟ لن يتم حفظ تقدمك.')) {
      this.backToBooks();
    }
  }

  showResults() {
    this.examActive = false;
    document.body.classList.remove('exam-mode');
    
    if (!window.examEngine) return;
    const summary = window.examEngine.finishExam();

    this.navigateTo('results', { bookId: this.currentBook.id, chapter: this.currentChapter });

    const gradeElem = document.getElementById('res-grade');
    const percentElem = document.getElementById('res-percent');
    const scoreElem = document.getElementById('res-score');
    const reviewBtn = document.getElementById('review-errors-btn');

    if (gradeElem) gradeElem.innerHTML = `${summary.grade.emoji} ${summary.grade.grade}`;
    if (percentElem) percentElem.textContent = `${summary.percentage}%`;
    if (scoreElem) scoreElem.textContent = `لقد أجبت بشكل صحيح على ${summary.score} من أصل ${summary.totalQuestions} سؤال.`;
    
    // التحكم بظهور زر مراجعة الأخطاء بناء على وجود أخطاء فعليّة أم علامة كاملة
    if (reviewBtn) {
      const wrongCount = window.examEngine.getWrongAnswers().length;
      reviewBtn.style.display = wrongCount > 0 ? 'block' : 'none';
    }
  }

  showReview() {
    if (!window.examEngine) return;
    const wrongAnswers = window.examEngine.getWrongAnswers();
    if (wrongAnswers.length === 0) return;

    this.navigateTo('review', { bookId: this.currentBook.id, chapter: this.currentChapter });
    
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
        ${ans.explanation ? `<div class="review-explanation"><strong>📚 الشرح القانوني:</strong> ${ans.explanation}</div>` : ''}
      `;
      reviewContent.appendChild(item);
    });
  }

  restartExam() {
    if (this.currentBook && this.currentChapter) {
      this.startChapterExam(this.currentBook.id, this.currentChapter);
    }
  }

  backToBooks() {
    this.examActive = false;
    this.currentBook = null;
    this.currentChapter = null;
    this.currentQuestions = [];
    document.body.classList.remove('exam-mode');
    
    const searchInp = document.getElementById('search-input');
    if (searchInp) searchInp.value = '';
    
    this.loadBooks();
    this.navigateTo('books');
  }

  // ===== إدارة التنقل البرمجي الآمن وحالة المتصفح التاريخية (History URL Setup) =====
  navigateTo(viewId, params = {}, pushState = true) {
    const views = ['books-view', 'chapters-view', 'exam-view', 'results-container', 'review-container'];
    views.forEach(v => {
      const elem = document.getElementById(v);
      if (elem) elem.classList.remove('active');
    });

    let targetView = 'books-view';
    if (viewId === 'chapters') targetView = 'chapters-view';
    if (viewId === 'exam') targetView = 'exam-view';
    if (viewId === 'results') targetView = 'results-container';
    if (viewId === 'review') targetView = 'review-container';

    const targetElem = document.getElementById(targetView);
    if (targetElem) targetElem.classList.add('active');

    // إظهار أو إخفاء محرك البحث العلوي حسب الصفحة
    const searchBar = document.getElementById('main-search-bar');
    if (searchBar) {
      searchBar.style.display = viewId === 'books' ? 'block' : 'none';
    }

    if (pushState) {
      history.pushState({ view: viewId, ...params }, '');
    }
  }

  setupHistoryListener() {
    window.onpopstate = (event) => {
      if (!event.state) {
        this.backToBooks();
        return;
      }
      const state = event.state;
      if (state.view === 'books') {
        this.backToBooks();
      } else if (state.view === 'chapters' && state.bookId) {
        this.selectBook(state.bookId);
      } else if (state.view === 'exam') {
        // حماية الامتحان من الإغلاق غير المتوقع عند الضغط على زر الرجوع في الهاتف
        if (this.examActive) {
          history.pushState(state, ''); 
          if (confirm('هل تود الخروج من قاعة الامتحان والعودة للرئيسية؟')) {
            this.backToBooks();
          }
        }
      }
    };
  }

  handleInitialState() {
    // العودة للرئيسية كحالة أمان عند بدء تشغيل وتحديث المتصفح
    this.navigateTo('books', {}, false);
  }

  setupEventListeners() {
    const prevBtn = document.getElementById('prev-question-btn');
    const exitBtn = document.getElementById('exit-exam-btn');
    const restartBtn = document.getElementById('restart-exam-btn');
    const backToBooksBtn = document.getElementById('back-to-books-btn');
    const reviewBtn = document.getElementById('review-errors-btn');
    const backReviewBtn = document.getElementById('back-from-review-btn');
    const searchInput = document.getElementById('search-input');

    if (prevBtn) prevBtn.onclick = () => this.prevQuestion();
    if (exitBtn) exitBtn.onclick = () => this.exitExam();
    if (restartBtn) restartBtn.onclick = () => this.restartExam();
    if (backToBooksBtn) backToBooksBtn.onclick = () => this.backToBooks();
    if (reviewBtn) reviewBtn.onclick = () => this.showReview();
    if (backReviewBtn) backReviewBtn.onclick = () => this.backToBooks();
    if (searchInput) searchInput.oninput = () => this.filterBooks();
  }
}

// تشغيل وربط التطبيق بالنافذة العامة فور تحميل المستند لضمان استجابة أزرار الـ HTML
document.addEventListener('DOMContentLoaded', () => {
  window.examApp = new ExamApp();
});
