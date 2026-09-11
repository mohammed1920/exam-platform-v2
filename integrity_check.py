#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""فحص سلامة البيانات بدون تعديل المحتوى.

يولّد تقريرًا بما يحتاج مراجعة بشرية فقط، حتى تبقى الإصلاحات القانونية/التحريرية
يدوية ولا يقوم الذكاء الاصطناعي أو الـworkflow بتغييرها من تلقاء نفسه.
"""
import json
import re
from pathlib import Path
from collections import Counter

DATA = Path('data')
REPORT = Path('reports/data_integrity_report.json')
CH_RE = re.compile(r'^chapter_(\d+)\.json$')


def load(path):
    with path.open(encoding='utf-8') as f:
        return json.load(f)


def main():
    issues = []
    books_path = DATA / 'books.json'
    try:
        books = load(books_path)
    except Exception as e:
        books = []
        issues.append({'type': 'books_json_invalid', 'message': str(e)})

    if not isinstance(books, list):
        books = []
        issues.append({'type': 'books_json_not_array', 'message': 'books.json ليس مصفوفة.'})

    book_ids = [b.get('id') for b in books if isinstance(b, dict)]
    for dup in [k for k, n in Counter(book_ids).items() if n > 1]:
        issues.append({'type': 'duplicate_book_id', 'book_id': dup})

    listed = set(book_ids)
    folders = {p.name for p in DATA.iterdir() if p.is_dir() and not p.name.startswith('.') and p.name != 'images'}
    for orphan in sorted(folders - listed):
        issues.append({'type': 'orphan_book_folder', 'book_id': orphan, 'message': 'مجلد بيانات غير موجود في books.json؛ لا يُحذف تلقائياً.'})

    total_questions = 0
    for book in books:
        if not isinstance(book, dict) or not book.get('id'):
            continue
        book_id = book['id']
        book_dir = DATA / book_id
        nums = []
        if book_dir.is_dir():
            for path in sorted(book_dir.glob('chapter_*.json')):
                m = CH_RE.match(path.name)
                if not m:
                    continue
                num = int(m.group(1)); nums.append(num)
                try:
                    chapter = load(path)
                except Exception as e:
                    issues.append({'type': 'invalid_chapter_json', 'book_id': book_id, 'chapter': num, 'message': str(e)})
                    continue
                questions = chapter.get('questions', []) if isinstance(chapter, dict) else []
                if not isinstance(questions, list):
                    issues.append({'type': 'questions_not_array', 'book_id': book_id, 'chapter': num})
                    continue
                ids = [q.get('id') for q in questions if isinstance(q, dict)]
                uids = [q.get('uid') for q in questions if isinstance(q, dict)]
                for qidx, q in enumerate(questions, 1):
                    total_questions += 1
                    if not isinstance(q, dict):
                        issues.append({'type': 'question_not_object', 'book_id': book_id, 'chapter': num, 'question_index': qidx})
                        continue
                    options = q.get('options', q.get('opts', []))
                    answer = q.get('answer', q.get('ans'))
                    if not q.get('id') or not q.get('uid'):
                        issues.append({'type': 'question_identity_missing', 'book_id': book_id, 'chapter': num, 'question_index': qidx})
                    if not isinstance(options, list) or len(options) < 2:
                        issues.append({'type': 'too_few_options', 'book_id': book_id, 'chapter': num, 'question_index': qidx, 'options_count': len(options) if isinstance(options,list) else None, 'message': 'يحتاج مراجعة بشرية؛ لم يتم تعديل السؤال تلقائياً.'})
                    if not isinstance(answer, int) or not isinstance(options, list) or answer < 0 or answer >= len(options):
                        issues.append({'type': 'invalid_answer_index', 'book_id': book_id, 'chapter': num, 'question_index': qidx, 'answer': answer, 'options_count': len(options) if isinstance(options,list) else None})
                for ident in [x for x,n in Counter(map(str,ids)).items() if n>1 and x!='None']:
                    issues.append({'type':'duplicate_legacy_question_id','book_id':book_id,'chapter':num,'id':ident})
                for ident in [x for x,n in Counter(map(str,uids)).items() if n>1 and x!='None']:
                    issues.append({'type':'duplicate_question_uid','book_id':book_id,'chapter':num,'uid':ident})
        expected = int(book.get('chapters') or 0)
        actual = max(nums, default=0)
        if expected != actual:
            issues.append({'type': 'chapter_count_mismatch', 'book_id': book_id, 'books_json': expected, 'actual_max_chapter': actual})
        if nums:
            missing = sorted(set(range(1, max(nums)+1)) - set(nums))
            if missing:
                issues.append({'type': 'chapter_gap', 'book_id': book_id, 'missing': missing})

    REPORT.parent.mkdir(exist_ok=True)
    payload = {
        'generated_at': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).replace(microsecond=0).isoformat(),
        'summary': {'books': len(books), 'questions': total_questions, 'issues': len(issues)},
        'items': issues,
    }
    REPORT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"🔎 فحص السلامة: {len(issues)} ملاحظة تحتاج مراجعة بشرية.")


if __name__ == '__main__':
    main()
