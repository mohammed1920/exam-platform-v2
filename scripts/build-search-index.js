const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dataRoot = path.join(root, 'data');
const outputPath = path.join(dataRoot, 'search-index.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeQuestion(q) {
  return String(q?.question || q?.q || q?.text || '').trim();
}

const booksPath = path.join(dataRoot, 'books.json');
const books = readJson(booksPath);
const index = [];

for (const book of books) {
  const bookId = String(book.id);
  const bookTitle = String(book.title || book.name || book.id);
  const bookDir = path.join(dataRoot, bookId);

  if (!fs.existsSync(bookDir)) continue;

  const files = fs.readdirSync(bookDir)
    .filter(name => /^chapter_\d+\.json$/i.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/\d+/)?.[0] || 0);
      const nb = Number(b.match(/\d+/)?.[0] || 0);
      return na - nb;
    });

  for (const file of files) {
    const chapter = Number(file.match(/\d+/)?.[0] || 0);
    try {
      const data = readJson(path.join(bookDir, file));
      const questions = Array.isArray(data?.questions)
        ? data.questions
        : Array.isArray(data) ? data : [];

      for (const q of questions) {
        const question = normalizeQuestion(q);
        if (!question) continue;

        const id = q?.id != null ? String(q.id) : null;
        const uid = q?.uid != null ? String(q.uid) : id;

        index.push({
          id,
          uid,
          question,
          bookId,
          bookTitle,
          chapter
        });
      }
    } catch (error) {
      console.warn(`Skipping invalid chapter file: ${path.join(bookId, file)}`);
    }
  }
}

fs.writeFileSync(
  outputPath,
  JSON.stringify(index),
  'utf8'
);

console.log(`Search index generated: ${index.length} questions`);
