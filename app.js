class ExamApp {
  constructor() {
    this.books = [];
    this.currentBook = null;
    this.currentChapter = null;
    this.currentQuestions = [];
    this.examActive = false;
    this.timerInterval = null;
    this.init();
  }

  async init() {
    console.log('Initializing Exam App...');
    try {
      await this.loadBooks();
      await this.loadContactInfo();
      this.setupEventListeners();
      this.setupHistoryListener();
      
      history.replaceState({ view: 'books' }, '');
      this.navigateTo('books', {}, false);
    } catch (error) {
      console.error('Initialization error:', error);
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
      const basePath = window.location.pathname.includes('/exam-platform') ? '/exam-platform' : '';
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
          <div class="book-desc">${book.description || ''}</div>
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

  filterBooks() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const filtered = this.books.filter(b => 
      b.title.toLowerCase().includes(query) || 
      (b.description && b.description.toLowerCase().includes(query))
    );
    this.renderBooks(filtered);
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
    
    this.examActive = true;
    document.body.classList.add('exam-mode');
    this.navigateTo('exam', { book: this.currentBook.id, chapter: chapterNum });
    this.startTimer();
    this.renderQuestion();
  }

  renderQuestion() {
    const container = document.getElementById('question-container');
    const title = document.getElementById('exam-book-chapter');
    const fill = document.getElementById('progress-fill');
    if (!container || !title || !fill) return;

    const qIdx = examEngine.currentQuestionIndex;
    const total = examEngine.questions.length;
    const q = examEngine.questions[qIdx];

    title.innerText = `${this.currentBook.title} - الفصل ${this.currentChapter} (${qIdx + 1} من ${total})`;
    fill.style.width = `${((qIdx + 1) / total) * 100}%`;

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
    this.startExam(this.currentChapter);
  }

  backToBooks() {
    clearInterval(this.timerInterval);
    this.examActive = false;
    document.body.classList.remove('exam-mode');
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
      if (this.currentBook) {
        this.navigateTo('chapters');
        this.renderChapters();
      } else {
        this.backToBooks();
      }
    };
    document.getElementById('prev-btn').onclick = () => this.prevQuestion();
    document.getElementById('next-btn').onclick = () => this.nextQuestion();
    document.getElementById('restart-exam-btn').onclick = () => this.restartExam();
    document.getElementById('review-exam-btn').onclick = () => this.showReview();
    document.getElementById('search-input').oninput = () => this.filterBooks();
  }

  setupHistoryListener() {
    window.onpopstate = (event) => {
      if (event.state && event.state.view) {
        const view = event.state.view;
        
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

