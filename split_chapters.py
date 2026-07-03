#!/usr/bin/env python3
"""
سكريبت تحويل chapters.json إلى ملفات chapter_X.json منفصلة
"""
import json
import os
import re
import glob

DATA_DIR = "data"

def get_next_chapter_num(book_dir):
    """إيجاد أعلى رقم فصل موجود وإضافة 1"""
    existing = glob.glob(os.path.join(book_dir, "chapter_*.json"))
    nums = []
    for f in existing:
        m = re.search(r'chapter_(\d+)\.json$', f)
        if m:
            nums.append(int(m.group(1)))
    return max(nums) + 1 if nums else 1

def split_book_chapters(book_id):
    """تحويل chapters.json لكتاب معين إلى ملفات منفصلة"""
    book_dir = os.path.join(DATA_DIR, book_id)
    chapters_file = os.path.join(book_dir, "chapters.json")
    
    if not os.path.exists(chapters_file):
        return 0
    
    with open(chapters_file, 'r', encoding='utf-8') as f:
        chapters = json.load(f)
    
    if not chapters:
        return 0
    
    converted = 0
    for ch in chapters:
        # إيجاد الرقم التالي المتاح
        next_num = get_next_chapter_num(book_dir)
        
        # تحديد تنسيق الأسئلة
        questions = ch.get('questions', [])
        normalized_questions = []
        for q in questions:
            # توحيد تنسيق الأسئلة
            if 'q' in q:
                normalized_questions.append({
                    'question': q.get('q', ''),
                    'options': q.get('opts', []),
                    'answer': q.get('ans', 0)
                })
            elif 'question' in q:
                normalized_questions.append({
                    'question': q.get('question', ''),
                    'options': q.get('options', []),
                    'answer': q.get('answer', 0)
                })
        
        # إنشاء ملف الفصل المنفصل
        chapter_data = {
            "id": f"chapter_{next_num}",
            "book_id": book_id,
            "chapter": next_num,
            "title": ch.get('title', f'الفصل {next_num}'),
            "description": ch.get('description', ''),
            "questions": normalized_questions
        }
        
        chapter_file = os.path.join(book_dir, f"chapter_{next_num}.json")
        with open(chapter_file, 'w', encoding='utf-8') as f:
            json.dump(chapter_data, f, ensure_ascii=False, indent=2)
        
        print(f"  ✅ تم إنشاء chapter_{next_num}.json: {ch.get('title', '')} ({len(normalized_questions)} سؤال)")
        converted += 1
    
    # حذف chapters.json بعد التحويل
    os.remove(chapters_file)
    print(f"  🗑️ تم حذف chapters.json")
    
    return converted

def main():
    print("🔄 تحويل chapters.json إلى ملفات منفصلة...\n")
    
    total = 0
    for book_dir in sorted(os.listdir(DATA_DIR)):
        full_path = os.path.join(DATA_DIR, book_dir)
        if not os.path.isdir(full_path):
            continue
        
        chapters_file = os.path.join(full_path, "chapters.json")
        if not os.path.exists(chapters_file):
            continue
        
        print(f"📚 {book_dir}:")
        count = split_book_chapters(book_dir)
        total += count
    
    if total == 0:
        print("✅ لا توجد ملفات chapters.json تحتاج تحويل")
    else:
        print(f"\n✅ تم تحويل {total} فصل بنجاح")

if __name__ == "__main__":
    main()
