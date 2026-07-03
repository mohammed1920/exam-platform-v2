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
        
        book['chapters'] = len(all_chapters)
        updated_books.append(book)

    # 1. حفظ books.json
    with open(books_file, 'w', encoding='utf-8') as f:
        json.dump(updated_books, f, ensure_ascii=False, indent=2)

    # 2. حقن البيانات في index.html
    inject_data('index.html', 'const BOOKS =', updated_books)
    
    print("✅ Sync & Injection Complete with Unified Structure!")

def inject_data(filename, marker, data):
    path = Path(filename)
    if not path.exists(): return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # البحث عن المصفوفة واستبدالها
    pattern = rf"{marker}\s*\[[\s\S]*?\];"
    new_data = f"{marker} {json.dumps(data, ensure_ascii=False, indent=4)};"
    new_content = re.sub(pattern, new_data, content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)

if __name__ == "__main__":
    sync_all()
