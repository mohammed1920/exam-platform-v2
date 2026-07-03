#!/usr/bin/env python3
"""
سكريبت ذكي لمزامنة البيانات تلقائياً
يفحص جميع مجلدات الكتب ويجمع البيانات تلقائياً
"""

import json
import os
from pathlib import Path
import sys

def get_all_books():
    """جلب قائمة جميع الكتب من books.json"""
    books_file = Path('data/books.json')
    if not books_file.exists():
        print("❌ ملف books.json غير موجود")
        return []
    
    with open(books_file, 'r', encoding='utf-8') as f:
        return json.load(f)

def sync_book_data(book_id, book_title):
    """مزامنة بيانات كتاب واحد"""
    book_path = Path('data') / book_id
    
    if not book_path.exists():
        print(f"⚠️  مجلد {book_id} غير موجود - تخطي")
        return False
    
    # جمع جميع ملفات الفصول
    chapters = []
    chapter_files = sorted(
        [f for f in book_path.glob('chapter_*.json')],
        key=lambda x: int(x.stem.split('_')[1]) if x.stem.split('_')[1].isdigit() else 0
    )
    
    if not chapter_files:
        # إذا لم توجد ملفات chapter_*.json، تحقق من chapters.json
        chapters_file = book_path / 'chapters.json'
        if chapters_file.exists():
            with open(chapters_file, 'r', encoding='utf-8') as f:
                chapters = json.load(f)
            print(f"✅ {book_id}: قُرئ من chapters.json ({len(chapters)} فصول)")
            return True
        else:
            print(f"⚠️  {book_id}: لا توجد ملفات بيانات")
            return False
    
    # معالجة ملفات الفصول
    for chapter_file in chapter_files:
        try:
            with open(chapter_file, 'r', encoding='utf-8') as f:
                chapter_data = json.load(f)
            
            # التعامل مع تنسيقات مختلفة
            if isinstance(chapter_data, dict):
                # تنسيق: {title, questions}
                chapters.append({
                    'title': chapter_data.get('title', f'الفصل {len(chapters)+1}'),
                    'questions': chapter_data.get('questions', [])
                })
            elif isinstance(chapter_data, list):
                # تنسيق: قائمة أسئلة مباشرة
                chapters.append({
                    'title': f'الفصل {len(chapters)+1}',
                    'questions': chapter_data
                })
        except Exception as e:
            print(f"❌ خطأ في قراءة {chapter_file}: {e}")
            continue
    
    # كتابة chapters.json
    output_file = book_path / 'chapters.json'
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(chapters, f, ensure_ascii=False, indent=2)
        print(f"✅ {book_id}: تم إنشاء chapters.json مع {len(chapters)} فصول")
        return True
    except Exception as e:
        print(f"❌ خطأ في كتابة chapters.json لـ {book_id}: {e}")
        return False

def main():
    """الدالة الرئيسية"""
    print("🔄 جاري مزامنة البيانات تلقائياً...\n")
    
    books = get_all_books()
    if not books:
        print("❌ لا توجد كتب في books.json")
        sys.exit(1)
    
    success_count = 0
    for book in books:
        if sync_book_data(book['id'], book['title']):
            success_count += 1
    
    print(f"\n✨ تمت المزامنة: {success_count}/{len(books)} كتب")
    
    if success_count == len(books):
        print("✅ جميع البيانات محدثة بنجاح!")
        sys.exit(0)
    else:
        print("⚠️  بعض الكتب لم تتم مزامنتها")
        sys.exit(1)

if __name__ == '__main__':
    main()
