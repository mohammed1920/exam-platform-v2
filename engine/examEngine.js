/**
 * Exam Engine V2 - يقرأ من ملفات chapter_X.json المنفصلة
 */
class ExamEngine {
  constructor() {
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.totalQuestions = 0;
    this.userAnswers = [];
    this.questions = [];
    this.startTime = null;
    this.currentBook = null;
    this.currentChapter = null;
    this.basePath = window.location.pathname.includes('/exam-platform-v2') ? '/exam-platform-v2' : '';
    // بصمة زمنية واحدة عند تحميل الصفحة لمنع الكاش
    this.sessionTimestamp = Date.now();
  }

  async loadBooks() {
    try {
      const res = await fetch(`${this.basePath}/data/books.json?v=${this.sessionTimestamp}`);
      return await res.json();
    } catch (e) {
      console.error('Error loading books:', e);
      return [];
    }
  }

  async loadChapter(bookId, chapterNum) {
    // القراءة من الملف المنفصل chapter_X.json مباشرة
    try {
      const res = await fetch(`${this.basePath}/data/${bookId}/chapter_${chapterNum}.json?v=${this.sessionTimestamp}`);
      if (res.ok) {
        const chapter = await res.json();
        return this.initChapter(bookId, chapterNum, chapter);
      }
    } catch (e) {}
    return null;
  }

  initChapter(bookId, chapterNum, data) {
    this.currentBook = bookId;
    this.currentChapter = chapterNum;
    const qs = data.questions || (Array.isArray(data) ? data : []);
    this.questions = qs.map(q => ({
      id: q.id || Math.random(),
      q: q.q || q.question,
      options: q.opts || q.options,
      correct: q.ans !== undefined ? q.ans : (q.correct !== undefined ? q.correct : q.answer),
      explanation: q.explanation || "لا يوجد شرح متوفر حالياً."
    }));
    this.totalQuestions = this.questions.length;
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.userAnswers = [];
    this.startTime = new Date();
    return data;
  }

  getCurrentQuestion() {
    return this.questions[this.currentQuestionIndex] || null;
  }

  submitAnswer(optionIndex) {
    const q = this.getCurrentQuestion();
    if (!q) return false;
    const isCorrect = optionIndex === q.correct;
    this.userAnswers.push({
      questionText: q.q,
      userAnswer: q.options[optionIndex],
      correctAnswer: q.options[q.correct],
      isCorrect: isCorrect,
      explanation: q.explanation
    });
    if (isCorrect) this.score++;
    return isCorrect;
  }

  nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      return true;
    }
    return false;
  }

  finishExam() {
    const percentage = Math.round((this.score / this.totalQuestions) * 100);
    return {
      score: this.score,
      totalQuestions: this.totalQuestions,
      percentage: percentage,
      answers: this.userAnswers
    };
  }
}

const examEngine = new ExamEngine();
