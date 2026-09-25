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

  const indexPath = path.join(process.cwd(), 'data', 'search-index.json');
  questionIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  return questionIndex;
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
