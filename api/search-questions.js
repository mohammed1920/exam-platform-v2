const fs = require('fs');
const path = require('path');

let questionIndex = null;

function normalize(value) {
  return String(value ?? '')
    .toLocaleLowerCase('ar')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '')
    .replace(/[\u064B-\u065F]/g, '')
    .trim();
}

function loadQuestionIndex() {
  if (questionIndex) return questionIndex;

  const dataRoot = path.join(process.cwd(), 'data');
  const books = JSON.parse(fs.readFileSync(path.join(dataRoot, 'books.json'), 'utf8'));
  const index = [];

  for (const book of books) {
    const bookId = String(book.id);
    const bookTitle = String(book.title || book.name || book.id);
    const chapterCount = Number(book.chapters) || 0;

    for (let chapter = 1; chapter <= chapterCount; chapter++) {
      const filePath = path.join(dataRoot, bookId, `chapter_${chapter}.json`);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const questions = Array.isArray(data?.questions)
          ? data.questions
          : Array.isArray(data) ? data : [];

        for (const q of questions) {
          const question = String(q?.question || q?.q || q?.text || '').trim();
          if (!question) continue;

          index.push({
            id: q?.id != null ? String(q.id) : null,
            uid: q?.uid != null ? String(q.uid) : (q?.id != null ? String(q.id) : null),
            question,
            bookId,
            bookTitle,
            chapter
          });
        }
      } catch (_) {}
    }
  }

  questionIndex = index;
  return index;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const query = normalize(req.query?.q || '');
  if (query.length < 2) {
    res.status(400).json({ error: 'اكتب كلمتين على الأقل' });
    return;
  }

  const limit = Math.min(25, Math.max(1, Number(req.query?.limit) || 25));

  try {
    const index = loadQuestionIndex();
    const matches = [];

    for (const item of index) {
      if (normalize(item.question).includes(query)) {
        matches.push(item);
        if (matches.length >= limit) break;
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ query, total: matches.length, questions: matches });
  } catch (error) {
    console.error('Question search failed:', error);
    res.status(500).json({ error: 'تعذر البحث في الأسئلة حالياً' });
  }
};
