/**
 * Exam Engine V2
 * محرك الاختبارات الرئيسي
 */

class ExamEngine {
  constructor() {
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.totalQuestions = 0;
    this.userAnswers = [];
    this.questions = [];
    this.startTime = null;
    this.endTime = null;
    this.currentBook = null;
    this.currentChapter = null;
    
    // تحديد المسار الأساسي للموقع (خاصة لـ GitHub Pages)
    this.basePath = window.location.pathname.includes('/exam-platform-v2') 
      ? '/exam-platform-v2' 
      : '';
  }

  /**
   * تحميل الكتب من ملف JSON
   */
  async loadBooks() {
    try {
      const timestamp = new Date().getTime();
      const url = `${this.basePath}/data/books.json?v=${timestamp}`;
      console.log('Loading books from:', url);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const books = await response.json();
      return books;
    } catch (error) {
      console.error('خطأ في تحميل الكتب:', error);
      // محاولة بديلة بالمسار النسبي البسيط
      try {
        const response = await fetch(`./data/books.json?v=${new Date().getTime()}`);
        return await response.json();
      } catch (e) {
        return [];
      }
    }
  }

  /**
   * تحميل فصل معين
   */
  async loadChapter(bookId, chapterNum) {
    const timestamp = new Date().getTime();
    
    // محاولة 1: الملف الموحد
    try {
      const res = await fetch(`${this.basePath}/data/${bookId}/chapters.json?v=${timestamp}`);
      if (res.ok) {
        const chapters = await res.json();
        const chapter = chapters[chapterNum - 1];
        if (chapter) {
          this.setChapterData(bookId, chapterNum, chapter);
          return chapter;
        }
      }
    } catch (e) {}

    // محاولة 2: الملف المنفصل
    try {
      const res = await fetch(`${this.basePath}/data/${bookId}/chapter_${chapterNum}.json?v=${timestamp}`);
      if (res.ok) {
        const chapter = await res.json();
        this.setChapterData(bookId, chapterNum, chapter);
        return chapter;
      }
    } catch (e) {}

    return null;
  }

  setChapterData(bookId, chapterNum, chapter) {
    this.currentBook = bookId;
    this.currentChapter = chapterNum;
    const qs = chapter.questions || chapter;
    this.questions = Array.isArray(qs) ? qs.map(q => ({
      id: q.id || Math.random(),
      q: q.q || q.question,
      options: q.opts || q.options,
      correct: q.ans !== undefined ? q.ans : q.correct,
      explanation: q.explanation || "لا يوجد شرح متوفر حالياً."
    })) : [];
    this.totalQuestions = this.questions.length;
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.userAnswers = [];
    this.startTime = new Date();
  }

  /**
   * الحصول على السؤال الحالي
   */
  getCurrentQuestion() {
    if (this.currentQuestionIndex < this.questions.length) {
      return this.questions[this.currentQuestionIndex];
    }
    return null;
  }

  /**
   * تسجيل إجابة المستخدم
   */
  submitAnswer(optionIndex) {
    const question = this.getCurrentQuestion();
    if (!question) return false;

    const isCorrect = optionIndex === question.correct;
    
    this.userAnswers.push({
      questionId: question.id,
      questionText: question.q,
      userAnswer: question.options[optionIndex],
      correctAnswer: question.options[question.correct],
      isCorrect: isCorrect,
      explanation: question.explanation || "لا يوجد شرح متوفر حالياً."
    });

    if (isCorrect) {
      this.score++;
    }

    return isCorrect;
  }

  /**
   * الانتقال للسؤال التالي
   */
  nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      return true;
    }
    return false;
  }

  /**
   * الانتقال للسؤال السابق
   */
  previousQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      return true;
    }
    return false;
  }

  /**
   * إنهاء الاختبار وحساب النتائج
   */
  finishExam() {
    this.endTime = new Date();
    const duration = Math.round((this.endTime - this.startTime) / 1000); // بالثواني
    const percentage = Math.round((this.score / this.totalQuestions) * 100);

    return {
      score: this.score,
      totalQuestions: this.totalQuestions,
      percentage: percentage,
      duration: duration,
      answers: this.userAnswers,
      grade: this.getGrade(percentage)
    };
  }

  /**
   * الحصول على التقدير بناءً على النسبة المئوية
   */
  getGrade(percentage) {
    if (percentage >= 90) return { grade: 'ممتاز', emoji: '🏆' };
    if (percentage >= 75) return { grade: 'جيد جداً', emoji: '⭐' };
    if (percentage >= 60) return { grade: 'جيد', emoji: '✅' };
    if (percentage >= 50) return { grade: 'مقبول', emoji: '📚' };
    return { grade: 'ضعيف', emoji: '❌' };
  }

  /**
   * الحصول على الأسئلة التي أخطأ فيها
   */
  getWrongAnswers() {
    return this.userAnswers.filter(answer => !answer.isCorrect);
  }

  /**
   * إعادة تعيين الاختبار
   */
  reset() {
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.userAnswers = [];
    this.questions = [];
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * حفظ النتائج في localStorage
   */
  saveResults(results) {
    const key = `exam_${this.currentBook}_ch${this.currentChapter}_${new Date().getTime()}`;
    const data = {
      book: this.currentBook,
      chapter: this.currentChapter,
      timestamp: new Date().toISOString(),
      ...results
    };
    localStorage.setItem(key, JSON.stringify(data));
    return key;
  }

  /**
   * الحصول على السجل السابق للاختبارات
   */
  getExamHistory() {
    const history = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('exam_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          history.push({ key, ...data });
        } catch (e) {
          console.error('Error parsing history item:', key);
        }
      }
    }
    return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
}

// تصدير الكائن
const examEngine = new ExamEngine();
