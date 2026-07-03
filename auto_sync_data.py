#!/usr/bin/env python3
import json
import os
from pathlib import Path
import re

def clean_question(q):
    new_q = {}
    new_q['q'] = q.get('q') or q.get('question') or ""
    new_q['opts'] = q.get('opts') or q.get('options') or []
    ans = q.get('ans')
    if ans is None: ans = q.get('correct')
    new_q['ans'] = int(ans) if ans is not None else 0
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
                    chapter_obj = {
                        'title': (data.get('title') if isinstance(data, dict) else None) or f"الفصل {get_num(cf)}",
                        'questions': [clean_question(q) for q in (data.get('questions') if isinstance(data, dict) else data)]
                    }
                    all_chapters.append(chapter_obj)
                except: continue
        else:
            c_file = book_dir / 'chapters.json'
            if c_file.exists():
                try:
                    with open(c_file, 'r', encoding='utf-8') as f:
                        all_chapters = json.load(f)
                except: pass

        if all_chapters:
            with open(book_dir / 'chapters.json', 'w', encoding='utf-8') as f:
                json.dump(all_chapters, f, ensure_ascii=False, indent=2)
        
        book['chapters'] = len(all_chapters)
        updated_books.append(book)

    # 1. حفظ books.json
    with open(books_file, 'w', encoding='utf-8') as f:
        json.dump(updated_books, f, ensure_ascii=False, indent=2)

    # 2. حقن البيانات في index.html (مثل نظام Library)
    inject_data('index.html', 'const BOOKS =', updated_books)
    
    print("✅ Sync & Injection Complete!")

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
