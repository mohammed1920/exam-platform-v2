/*
 * Wrong Answers Retest
 * اختبار مؤقت للأسئلة الخاطئة من آخر اختبار فقط.
 * لا يستخدم localStorage أو ملفات أو Firestore لحفظ الأسئلة.
 */
(function () {
  'use strict';

  const BUTTON_ID = 'wrong-answers-retest-btn';
  const STATE_KEY = '__wrongRetestState';

  function getApp() {
    return window.app || null;
  }

  function getResultsSection() {
    return document.getElementById('results-section');
  }

  function isResultsVisible() {
    const section = getResultsSection();
    if (!section) return false;
    return section.classList.contains('active') || getComputedStyle(section).display !== 'none';
  }

  function removeButton() {
    const button = document.getElementById(BUTTON_ID);
    if (button) button.remove();
  }

  function clearTemporaryState() {
    const state = window[STATE_KEY];
    if (state) {
      state.questions = [];
      state.wrongAnswers = [];
      state.sourceQuestions = [];
    }
    window[STATE_KEY] = null;
  }

  function collectWrongQuestions() {
    const engine = window.examEngine;
    const app = getApp();
    if (!engine || !Array.isArray(engine.questions) || !Array.isArray(engine.userAnswers)) return [];

    const wrongAnswers = engine.getWrongAnswers ? engine.getWrongAnswers() : engine.userAnswers.filter(a => !a.isCorrect);
    if (!wrongAnswers.length) return [];

    const byUid = new Map();
    const byId = new Map();
    engine.questions.forEach(q => {
      if (q && q.uid != null) byUid.set(String(q.uid), q);
      if (q && q.id != null) byId.set(String(q.id), q);
    });

    const fallbackBookId = app && app.currentBook && app.currentBook.id ? app.currentBook.id : null;
    const fallbackChapter = app && app.currentChapter != null ? app.currentChapter : null;

    return wrongAnswers.map(answer => {
      let q = answer.questionUid != null ? byUid.get(String(answer.questionUid)) : null;
      if (!q && answer.questionId != null) q = byId.get(String(answer.questionId));
      if (!q) return null;

      return {
        ...JSON.parse(JSON.stringify(q)),
        sourceBook: q.sourceBook || fallbackBookId,
        sourceChapter: q.sourceChapter || fallbackChapter
      };
    }).filter(Boolean);
  }

  function prepareQuestions(questions) {
    const app = getApp();
    if (app && typeof app.prepareChapterQuestions === 'function') {
      return app.prepareChapterQuestions(questions);
    }

    return questions.map(q => {
      const copy = { ...q, options: Array.isArray(q.options) ? q.options.slice() : [] };
      if (!copy.options.length) return copy;
      const correctText = copy.options[copy.answer];
      for (let i = copy.options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy.options[i], copy.options[j]] = [copy.options[j], copy.options[i]];
      }
      copy.answer = copy.options.indexOf(correctText);
      return copy;
    });
  }

  function startWrongRetest() {
    const engine = window.examEngine;
    const app = getApp();
    if (!engine || !app) return;

    const wrongQuestions = collectWrongQuestions();
    if (!wrongQuestions.length) {
      removeButton();
      return;
    }

    const prepared = prepareQuestions(wrongQuestions);
    if (!prepared.length) return;

    // نخزنها بالذاكرة فقط أثناء الانتقال للاختبار، ولا نستخدم localStorage.
    window[STATE_KEY] = {
      questions: prepared.slice(),
      wrongAnswers: wrongQuestions.slice(),
      sourceQuestions: engine.questions.slice(),
      originalBook: app.currentBook,
      originalChapter: app.currentChapter,
      wasCustomExam: Boolean(app.isCustomExam)
    };

    engine.loadCustomQuestions(prepared);
    app.isCustomExam = true;
    app.examActive = true;
    app.currentChapter = null;
    document.body.classList.add('exam-mode');

    if (typeof app.navigateTo === 'function') {
      app.navigateTo('exam', { wrongRetest: true });
    }
    if (typeof app.startTimer === 'function') app.startTimer();
    if (typeof app.renderQuestion === 'function') app.renderQuestion();

    removeButton();
  }

  function addButtonIfNeeded() {
    const results = getResultsSection();
    const engine = window.examEngine;
    if (!results || !engine || !isResultsVisible()) return;

    const wrongAnswers = engine.getWrongAnswers ? engine.getWrongAnswers() : [];
    if (!wrongAnswers.length || document.getElementById(BUTTON_ID)) return;

    const reviewButton = document.getElementById('review-exam-btn');
    if (!reviewButton || !reviewButton.parentNode) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.className = 'back-btn';
    button.style.cssText = 'margin-top:10px;width:100%;border-color:var(--primary,#c29d5f);color:var(--primary,#c29d5f);';
    button.textContent = `🔄 اختبرني بالأخطاء (${wrongAnswers.length})`;
    button.addEventListener('click', startWrongRetest);
    reviewButton.parentNode.insertBefore(button, reviewButton);
  }

  function install() {
    const results = getResultsSection();
    if (!results) return false;

    const observer = new MutationObserver(() => {
      window.setTimeout(addButtonIfNeeded, 0);
    });
    observer.observe(results, { attributes: true, attributeFilter: ['class', 'style'] });

    document.addEventListener('click', event => {
      const target = event.target.closest('#back-books-btn, #restart-exam-btn, #back-from-review, #exam-home-btn');
      if (target) clearTemporaryState();
    }, true);

    // فحص أولي، ثم إعادة الفحص عند تغير واجهة النتائج.
    window.setTimeout(addButtonIfNeeded, 300);
    window.setInterval(addButtonIfNeeded, 700);
    return true;
  }

  const timer = window.setInterval(() => {
    if (install()) window.clearInterval(timer);
  }, 250);
})();
