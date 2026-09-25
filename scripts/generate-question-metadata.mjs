#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const booksPath = path.join(root, 'data', 'books.json');
const outputPath = path.join(root, 'data', 'question-metadata.json');
const searchIndexPath = path.join(root, 'data', 'question-search-index.json');

const books = JSON.parse(fs.readFileSync(booksPath, 'utf8'));
const metadata = { version: 1, books: {} };
const searchIndex = { version: 1, questions: [] };

for (const book of books) {
  const totalChapters = Number(book.chapters) || 0;
  const chapters = [];
  let questionCount = 0;

  for (let chapterNum = 1; chapterNum <= totalChapters; chapterNum++) {
    const chapterPath = path.join(root, 'data', book.id, `chapter_${chapterNum}.json`);
    let data = null;

    try {
      data = JSON.parse(fs.readFileSync(chapterPath, 'utf8'));
    } catch (error) {
      console.warn(`تعذر قراءة: ${chapterPath}`);
      continue;
    }

    const questions = data && Array.isArray(data.questions)
      ? data.questions
      : Array.isArray(data) ? data : [];

    const count = questions.length;
    questionCount += count;

    // فهرس بحث خفيف: يحتوي فقط على نص السؤال ومصدره ومعرّفه.
    // لا يحتوي على الخيارات أو الإجابة أو الشرح، لذلك البحث لا يحتاج لتحميل ملفات الفصول كاملة.
    questions.forEach((q) => {
      const id = q && q.id != null ? String(q.id) : null;
      const uid = q && q.uid != null ? String(q.uid) : null;
      const question = String((q && (q.question || q.q || q.text)) || '').trim();
      if (!question) return;

      searchIndex.questions.push({
        id,
        uid,
        question,
        bookId: book.id,
        bookTitle: String(book.title || book.name || book.id),
        chapter: chapterNum
      });
    });

    const title = String((data && (data.title || data.topic)) || '').trim();

    chapters.push({
      number: chapterNum,
      title: title || `أسئلة مخصصة لـ الفصل ${chapterNum}`,
      questionCount: count
    });
  }

  metadata.books[book.id] = {
    questionCount,
    chapters
  };
}

fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2) + '\\n', 'utf8');
fs.writeFileSync(searchIndexPath, JSON.stringify(searchIndex) + '\\n', 'utf8');
console.log(`تم تحديث بيانات أعداد الأسئلة: ${outputPath}`);
console.log(`تم تحديث فهرس البحث الخفيف: ${searchIndexPath}`);

