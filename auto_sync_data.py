#!/usr/bin/env python3
import json
import os
from pathlib import Path
import re

def clean_question(q):
    """توحيد بنية السؤال لتطابق المعايير المطلوبة"""
    return {
        'id': q.get('id', str(hash(str(q.get('question', q.get('q', '')))) % 1000000)),
        'question': q.get('question', q.get('q', '')),
        'options': q.get('options', q.get('opts', [])),
        'answer': int(q.get('answer', q.get('ans', 0))),
        'explanation': q.get('explanation', '')
    }

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

        def get_num(p):
            n = re.findall(r'\d+', p.name)
            return int(n[0]) if n else 999
            
        chapter_files = sorted(list(book_dir.glob('chapter_*.json')), key=get_num)
        max_chapter_num = max((get_num(cf) for cf in chapter_files), default=0)

        all_chapters = []
        if chapter_files:
            for cf in chapter_files:
                try:
                    with open(cf, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    # إذا كان الملف يحتوي على أسئلة، نقوم بتنظيفها وتوحيدها
                    if isinstance(data, dict):
                        questions = data.get('questions', [])
                        chapter_title = data.get('title') or f"الفصل {get_num(cf)}"
                    else:
                        questions = data
                        chapter_title = f"الفصل {get_num(cf)}"
                        
                    chapter_obj = {
                        'title': chapter_title,
                        'questions': [clean_question(q) for q in questions]
                    }
                    all_chapters.append(chapter_obj)
                    
                    # تحديث ملف الفصل نفسه بالبنية الموحدة
                    if isinstance(data, dict):
                        data['questions'] = chapter_obj['questions']
                        with open(cf, 'w', encoding='utf-8') as f:
                            json.dump(data, f, ensure_ascii=False, indent=2)
                            
                except Exception as e:
                    print(f"Error processing {cf}: {e}")
                    continue
        else:
            c_file = book_dir / 'chapters.json'
            if c_file.exists():
                try:
                    with open(c_file, 'r', encoding='utf-8') as f:
                        all_chapters = json.load(f)
                    # توحيد الأسئلة داخل chapters.json أيضاً
                    for ch in all_chapters:
                        ch['questions'] = [clean_question(q) for q in ch.get('questions', [])]
                except: pass

        if all_chapters:
            with open(book_dir / 'chapters.json', 'w', encoding='utf-8') as f:
                json.dump(all_chapters, f, ensure_ascii=False, indent=2)

        # نستخدم أعلى رقم فصل فعلي، لا عدد الملفات، لتفادي الفجوات
        # (كانت هذه هي مشكلة الفصول 7-14 المفقودة في law_general_penalties)
        book['chapters'] = max_chapter_num if chapter_files else len(all_chapters)
        expected = set(range(1, book['chapters'] + 1))
        actual = {get_num(cf) for cf in chapter_files}
        missing = sorted(expected - actual)
        if missing:
            print(f"⚠️  {book_id}: فصول معلنة بدون ملف فعلي: {missing}")

        updated_books.append(book)

    # حفظ books.json
    with open(books_file, 'w', encoding='utf-8') as f:
        json.dump(updated_books, f, ensure_ascii=False, indent=2)

    print("✅ Sync Complete with Unified Structure!")

if __name__ == "__main__":
    sync_all()
