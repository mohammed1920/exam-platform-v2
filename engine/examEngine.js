/**
 * Exam Engine V2 - يقرأ من ملفات chapter_X.json المنفصلة
 * تم التوحيد: استخدام المفاتيح الموحدة (question, answer, options, explanation).
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
    this.finishedResult = null;
    this.__firestoreResultSaved = false;
    this.basePath = window.location.pathname.includes('/exam-platform-v2') ? '/exam-platform-v2' : '';
    this.sessionTimestamp = Date.now();
  }
  async loadBooks() {
    try {
      const res = await fetch(`${this.basePath}/data/books.json?v=${this.sessionTimestamp}`);
      return await res.json();
    } catch (e) { console.error('Error loading books:', e); return []; }
  }
  async loadChapter(bookId, chapterNum) {
    try {
      const res = await fetch(`${this.basePath}/data/${bookId}/chapter_${chapterNum}.json?v=${this.sessionTimestamp}`);
      if (res.ok) return this.initChapter(bookId, chapterNum, await res.json());
    } catch (e) {}
    return null;
  }
  initChapter(bookId, chapterNum, data) {
    this.currentBook = bookId;
    this.currentChapter = chapterNum;
    const qs = data.questions || (Array.isArray(data) ? data : []);
    this.questions = qs.map(q => ({
      id: q.id || q.uid || null,
      uid: q.uid || q.id || null,
      question: q.question || q.q || "",
      options: q.options || q.opts || [],
      answer: q.answer !== undefined ? q.answer : (q.ans !== undefined ? q.ans : (q.correct !== undefined ? q.correct : 0)),
      explanation: q.explanation || "لا يوجد شرح متوفر حالياً."
    }));
    this.totalQuestions = this.questions.length;
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.userAnswers = [];
    this.startTime = new Date();
    this.finishedResult = null;
    this.__firestoreResultSaved = false;
    return data;
  }
  loadCustomQuestions(questions) {
    this.currentBook = 'custom-exam';
    this.currentChapter = null;
    this.questions = (questions || []).map(q => ({
      id: q.id || q.uid || null,
      uid: q.uid || q.id || null,
      question: q.question || q.q || "",
      options: q.options || q.opts || [],
      answer: q.answer !== undefined ? q.answer : (q.ans !== undefined ? q.ans : (q.correct !== undefined ? q.correct : 0)),
      explanation: q.explanation || "لا يوجد شرح متوفر حالياً.",
      sourceBook: q.sourceBook || null,
      sourceChapter: q.sourceChapter || null
    }));
    this.totalQuestions = this.questions.length;
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.userAnswers = [];
    this.startTime = new Date();
    this.finishedResult = null;
    this.__firestoreResultSaved = false;
  }
  getCurrentQuestion() { return this.questions[this.currentQuestionIndex] || null; }
  submitAnswer(optionIndex) {
    const q = this.getCurrentQuestion();
    if (!q) return false;
    const questionUid = q.uid || null;
    const questionId = q.id || null;
    const existingAnswer = this.userAnswers.find(a => {
      if (questionUid) return a.questionUid === questionUid;
      if (questionId) return a.questionId === questionId;
      return false;
    });
    if (existingAnswer) return existingAnswer.isCorrect;
    const isCorrect = optionIndex === q.answer;
    this.userAnswers.push({
      questionUid,
      questionId,
      questionText: q.question,
      userAnswer: q.options[optionIndex],
      correctAnswer: q.options[q.answer],
      isCorrect,
      explanation: q.explanation
    });
    if (isCorrect) this.score++;
    return isCorrect;
  }
  nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) { this.currentQuestionIndex++; return true; }
    return false;
  }
  finishExam() {
    if (this.finishedResult) return this.finishedResult;
    const percentage = this.totalQuestions > 0
      ? Math.round((this.score / this.totalQuestions) * 100)
      : 0;
    this.finishedResult = {
      score: this.score,
      totalQuestions: this.totalQuestions,
      percentage,
      grade: this.getGrade(percentage),
      duration: this.startTime ? Math.max(0, Math.round((new Date() - this.startTime) / 1000)) : 0,
      answers: this.userAnswers.slice()
    };

    // حفظ النتيجة مباشرة من نقطة إنهاء الاختبار، بدل الاعتماد على wrapper خارجي.
    try {
      const publicAuth = window.publicAuth;
      if (publicAuth && publicAuth.user && typeof publicAuth.saveExamResultToFirestore === 'function') {
        const app = window.app;
        const book = app && app.currentBook;
        const startedAtMs = this.startTime ? this.startTime.getTime() : Date.now();
        this.__firestoreResultSaved = true;
        Promise.resolve(publicAuth.saveExamResultToFirestore(this.finishedResult, {
          bookId: app && book ? book.id : (this.currentBook !== 'custom-exam' ? this.currentBook : null),
          bookTitle: app && book ? book.title : null,
          chapter: this.currentChapter,
          custom: Boolean(app && app.isCustomExam) || this.currentBook === 'custom-exam',
          startedAt: this.startTime ? this.startTime.toISOString() : null,
          resultId: `${publicAuth.user.uid}_${startedAtMs}`
        })).then(saved => {
          if (!saved) console.warn('لم يتم حفظ نتيجة الاختبار في Firestore.');
        }).catch(error => console.error('Firestore result save failed:', error));
      } else {
        console.warn('تعذر حفظ نتيجة الاختبار: لا يوجد مستخدم مسجل دخول أو خدمة Firestore غير جاهزة.');
      }
    } catch (error) {
      console.error('Firestore result save failed:', error);
    }

    return this.finishedResult;
  }
  getGrade(percentage) {
    if (percentage >= 90) return { grade: 'ممتاز', emoji: '🏆' };
    if (percentage >= 80) return { grade: 'جيد جداً', emoji: '🥇' };
    if (percentage >= 70) return { grade: 'جيد', emoji: '🥈' };
    if (percentage >= 60) return { grade: 'مقبول', emoji: '🥉' };
    return { grade: 'راسب', emoji: '❌' };
  }
  getWrongAnswers() { return this.userAnswers.filter(a => !a.isCorrect); }
  reset() {
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.totalQuestions = 0;
    this.userAnswers = [];
    this.questions = [];
    this.startTime = null;
    this.currentBook = null;
    this.currentChapter = null;
    this.finishedResult = null;
    this.__firestoreResultSaved = false;
  }
}

const examEngine = new ExamEngine();
window.examEngine = examEngine;

(function loadStudentDashboardModules() {
  const basePath = window.location.pathname.includes('/exam-platform-v2') ? '/exam-platform-v2' : '';
  ['dashboard-style-loader.js?v=1.2', 'user-dashboard.js?v=1.2', 'student-results.js?v=1.0'].forEach(src => {
    const script = document.createElement('script');
    script.src = `${basePath}/${src}`;
    script.async = true;
    script.onerror = () => console.warn(`تعذر تحميل الوحدة: ${src}`);
    document.head.appendChild(script);
  });
})();
