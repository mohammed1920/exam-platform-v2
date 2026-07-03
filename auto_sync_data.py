#!/usr/bin/env python3
import json
import os
from pathlib import Path
import re

def clean_question(q):
    """توحيد تنسيق السؤال"""
    new_q = {}
    new_q['q'] = q.get('q') or q.get('question') or ""
    new_q['opts'] = q.get('opts') or q.get('options') or []
    ans = q.get('ans')
    if ans is None: ans = q.get('correct')
    new_q['ans'] = int(ans) if ans is not None else 0
    if 'id' in q: new_q['id'] = q['id']
    if 'explanation' in q: new_q['explanation'] = q['explanation']
    return new_q

def sync_all():
    base_path = Path('data')
    books_file = base_path / 'books.json'
    
    if not books_file.exists(): return

    with open(books_file, 'r', encoding='utf-8') as f:
        books = json.load(f)

    updated_books = []
    for book in books:
        book_id = book['id']
        book_dir = base_path / book_id
        if not book_dir.exists():
            updated_books.append(book)
            continue

        # جلب ملفات chapter_*.json وترتيبها رقمياً بشكل صحيح (1, 2, 10...)
        def get_num(p):
            n = re.findall(r'\d+', p.name)
            return int(n[0]) if n else 999
            
        chapter_files = sorted(list(book_dir.glob('chapter_*.json')), key=get_num)
        
        all_chapters = []
        # إذا وجدت ملفات منفصلة، نعتمدها
        if chapter_files:
            for cf in chapter_files:
                try:
                    with open(cf, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    chapter_obj = {}
                    if isinstance(data, dict):
                        chapter_obj['title'] = data.get('title') or f"الفصل {get_num(cf)}"
                        qs = data.get('questions') or []
                        chapter_obj['questions'] = [clean_question(q) for q in qs]
                    elif isinstance(data, list):
                        chapter_obj['title'] = f"الفصل {get_num(cf)}"
                        chapter_obj['questions'] = [clean_question(q) for q in data]
                    all_chapters.append(chapter_obj)
                except: continue
        else:
            # إذا لم توجد ملفات منفصلة، نقرأ من chapters.json الموحد
            c_file = book_dir / 'chapters.json'
            if c_file.exists():
                try:
                    with open(c_file, 'r', encoding='utf-8') as f:
                        all_chapters = json.load(f)
                except: pass

        # حفظ الملف الموحد
        if all_chapters:
            with open(book_dir / 'chapters.json', 'w', encoding='utf-8') as f:
                json.dump(all_chapters, f, ensure_ascii=False, indent=2)
        
        book['chapters'] = len(all_chapters)
        updated_books.append(book)

    # حفظ قائمة الكتب
    with open(books_file, 'w', encoding='utf-8') as f:
        json.dump(updated_books, f, ensure_ascii=False, indent=2)
    print("✅ Sync Complete!")

if __name__ == "__main__":
    sync_all()
