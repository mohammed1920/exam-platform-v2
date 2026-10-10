/* Mizan exam-draft persistence module.
 * Preserves the existing localStorage keys and migration behavior.
 */
(function () {
  'use strict';

  function getExamDraftKey() {
    const user = window.publicAuth && window.publicAuth.user;
    return user ? `lawExam.studentDrafts.v2.${user.uid || user.email || 'user'}` : null;
  }

  function getLegacyExamDraftKey() {
    const user = window.publicAuth && window.publicAuth.user;
    return user ? `lawExam.studentDraft.v1.${user.uid || user.email || 'user'}` : null;
  }

  function readExamDrafts() {
    const key = getExamDraftKey();
    if (!key) return [];
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved)) return saved;
        if (saved && saved.bookId) return [{ ...saved, id: `${saved.bookId}::${saved.chapter}` }];
      }
    } catch (_) {}
    try {
      const legacyKey = getLegacyExamDraftKey();
      const legacy = JSON.parse(localStorage.getItem(legacyKey) || 'null');
      if (legacy && legacy.bookId) {
        const migrated = [{ ...legacy, id: `${legacy.bookId}::${legacy.chapter}` }];
        localStorage.setItem(key, JSON.stringify(migrated));
        localStorage.removeItem(legacyKey);
        return migrated;
      }
    } catch (_) {}
    return [];
  }

  function writeExamDrafts(drafts) {
    const key = getExamDraftKey();
    if (key) localStorage.setItem(key, JSON.stringify(drafts.slice(0, 50)));
  }

  function saveExamDraft(app) {
    if (!app.examActive || app.isCustomExam || !app.currentBook || !app.currentChapter) return;
    if (!examEngine.questions.length) return;
    try {
      const draft = {
        id: `${app.currentBook.id}::${app.currentChapter}`,
        bookId: app.currentBook.id,
        bookTitle: app.currentBook.title,
        chapter: app.currentChapter,
        questionIndex: examEngine.currentQuestionIndex,
        totalQuestions: examEngine.totalQuestions,
        userAnswers: examEngine.userAnswers,
        score: examEngine.score,
        startedAt: examEngine.startTime ? examEngine.startTime.toISOString() : new Date().toISOString(),
        savedAt: new Date().toISOString()
      };
      const drafts = readExamDrafts().filter(item => item.id !== draft.id);
      drafts.unshift(draft);
      writeExamDrafts(drafts);
    } catch (error) { console.warn('تعذر حفظ الاختبار غير المكتمل:', error); }
  }

  function clearExamDraft(app) {
    const draftId = app.currentBook && app.currentChapter ? `${app.currentBook.id}::${app.currentChapter}` : null;
    if (!draftId) return;
    writeExamDrafts(readExamDrafts().filter(item => item.id !== draftId));
  }

  function getExamDraftSummaries(app) {
    return readExamDrafts().filter(draft => draft && draft.bookId && draft.chapter).map(draft => ({
      id: draft.id || `${draft.bookId}::${draft.chapter}`,
      title: `${draft.bookTitle || 'اختبار'} · الفصل ${draft.chapter}`,
      questionNumber: Number(draft.questionIndex || 0) + 1,
      totalQuestions: Number(draft.totalQuestions || 0),
      answered: Array.isArray(draft.userAnswers) ? draft.userAnswers.length : 0
    }));
  }

  function deleteExamDraft(app, draftId) {
    writeExamDrafts(readExamDrafts().filter(draft => draft.id !== draftId));
  }

  window.MizanExamDrafts = Object.freeze({
    read: readExamDrafts,
    save: saveExamDraft,
    clear: clearExamDraft,
    summaries: getExamDraftSummaries,
    delete: deleteExamDraft
  });
})();