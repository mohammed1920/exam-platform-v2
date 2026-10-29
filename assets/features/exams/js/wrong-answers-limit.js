/* Keep the student's locally stored wrong-answer list bounded. */
(function () {
  'use strict';

  const MAX_WRONG_ANSWERS = 100;
  const STORAGE_PREFIX = 'lawExam.studentHistory.v1';

  function getStorageKey() {
    const user = window.publicAuth && window.publicAuth.user;
    if (!user) return null;
    return `${STORAGE_PREFIX}.${user.uid || user.email || 'user'}`;
  }

  function trimWrongAnswers() {
    const key = getStorageKey();
    if (!key) return;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;

      const history = JSON.parse(raw);
      if (!Array.isArray(history) || history.length === 0) return;

      const wrongEntries = [];
      history.forEach((exam, examIndex) => {
        const answers = Array.isArray(exam.answers) ? exam.answers : [];
        answers.forEach((answer, answerIndex) => {
          if (!answer || answer.isCorrect) return;
          wrongEntries.push({
            examIndex,
            answerIndex,
            time: Date.parse(exam.createdAt || '') || 0
          });
        });
      });

      if (wrongEntries.length <= MAX_WRONG_ANSWERS) return;

      wrongEntries.sort((a, b) => {
        if (b.time !== a.time) return b.time - a.time;
        if (a.examIndex !== b.examIndex) return a.examIndex - b.examIndex;
        return a.answerIndex - b.answerIndex;
      });

      const keep = new Set(
        wrongEntries.slice(0, MAX_WRONG_ANSWERS).map(item => `${item.examIndex}:${item.answerIndex}`)
      );

      const trimmedHistory = history.map((exam, examIndex) => {
        const answers = Array.isArray(exam.answers) ? exam.answers : [];
        const nextAnswers = answers.filter((answer, answerIndex) => {
          if (answer && answer.isCorrect) return true;
          return keep.has(`${examIndex}:${answerIndex}`);
        });

        return {
          ...exam,
          answers: nextAnswers,
          wrongCount: nextAnswers.filter(answer => answer && !answer.isCorrect).length
        };
      });

      localStorage.setItem(key, JSON.stringify(trimmedHistory));
      window.dispatchEvent(new CustomEvent('wrong-answers-trimmed', {
        detail: { max: MAX_WRONG_ANSWERS }
      }));
    } catch (error) {
      console.warn('تعذر تقليص قائمة الإجابات الخاطئة:', error);
    }
  }

  function init() {
    trimWrongAnswers();
    window.addEventListener('student-history-updated', trimWrongAnswers);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.wrongAnswersLimit = {
    max: MAX_WRONG_ANSWERS,
    trim: trimWrongAnswers
  };
})();
