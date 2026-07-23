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
    
    // توحيد بنية الأسئلة عند التحميل لضمان المرونة
    this.questions = qs.map(q => ({
      id: q.id || Math.random().toString(36).substr(2, 9),
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
    return data;
  }

  // يغذي المحرك بمجموعة أسئلة جاهزة من مصادر متعددة (اختبار عشوائي شامل من عدة كتب/فصول)
  // كل سؤال قد يحمل sourceBook/sourceChapter لعرضهما أثناء الاختبار.
  loadCustomQuestions(questions) {
    this.currentBook = 'custom-exam';
    this.currentChapter = null;

    this.questions = (questions || []).map(q => ({
      id: q.id || Math.random().toString(36).substr(2, 9),
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
  }

  getCurrentQuestion() {
    return this.questions[this.currentQuestionIndex] || null;
  }

  submitAnswer(optionIndex) {
    const q = this.getCurrentQuestion();
    if (!q) return false;
    const isCorrect = optionIndex === q.answer;
    this.userAnswers.push({
      questionText: q.question,
      userAnswer: q.options[optionIndex],
      correctAnswer: q.options[q.answer],
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
    const grade = this.getGrade(percentage);
    const duration = Math.round((new Date() - this.startTime) / 1000);
    return {
      score: this.score,
      totalQuestions: this.totalQuestions,
      percentage: percentage,
      grade: grade,
      duration: duration,
      answers: this.userAnswers
    };
  }

  getGrade(percentage) {
    if (percentage >= 90) return { grade: 'ممتاز', emoji: '🏆' };
    if (percentage >= 80) return { grade: 'جيد جداً', emoji: '🥇' };
    if (percentage >= 70) return { grade: 'جيد', emoji: '🥈' };
    if (percentage >= 60) return { grade: 'مقبول', emoji: '🥉' };
    return { grade: 'راسب', emoji: '❌' };
  }

  getWrongAnswers() {
    return this.userAnswers.filter(a => !a.isCorrect);
  }

  reset() {
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.totalQuestions = 0;
    this.userAnswers = [];
    this.questions = [];
    this.startTime = null;
    this.currentBook = null;
    this.currentChapter = null;
  }
}

const examEngine = new ExamEngine();
