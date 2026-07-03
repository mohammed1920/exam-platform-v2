#!/usr/bin/env python3
"""
سكريبت تحويل chapters.json إلى ملفات chapter_X.json منفصلة
تم الإصلاح: حساب أعلى رقم فصل مرة واحدة قبل الحلقة لضمان الترقيم الصحيح.
تم التوحيد: استخدام المفاتيح الموحدة (question, answer, options, explanation).
"""
import json
import os
import re
import glob

DATA_DIR = "data"

def get_max_chapter_num(book_dir):
    """إيجاد أعلى رقم فصل موجود حالياً"""
    existing = glob.glob(os.path.join(book_dir, "chapter_*.json"))
    nums = []
    for f in existing:
        m = re.search(r'chapter_(\d+)\.json$', f)
        if m:
            nums.append(int(m.group(1)))
    return max(nums) if nums else 0

def split_book_chapters(book_id):
    """تحويل chapters.json لكتاب معين إلى ملفات منفصلة"""
    book_dir = os.path.join(DATA_DIR, book_id)
    chapters_file = os.path.join(book_dir, "chapters.json")
    
    if not os.path.exists(chapters_file):
        return 0
    
    try:
        with open(chapters_file, 'r', encoding='utf-8') as f:
            chapters = json.load(f)
    except Exception as e:
        print(f"  ❌ خطأ في قراءة {chapters_file}: {e}")
        return 0
    
    if not chapters:
        return 0
    
    # حساب أعلى رقم متاح مرة واحدة فقط قبل الحلقة
    current_num = get_max_chapter_num(book_dir)
    converted = 0
    
    for ch in chapters:
        current_num += 1
        
        questions = ch.get('questions', [])
        normalized_questions = []
        for q in questions:
            # توحيد التنسيق بناءً على الحقول الموحدة
            normalized_questions.append({
                'id': q.get('id', str(hash(q.get('q', q.get('question', ''))) % 1000000)),
                'question': q.get('question', q.get('q', '')),
                'options': q.get('options', q.get('opts', [])),
                'answer': q.get('answer', q.get('ans', 0)),
                'explanation': q.get('explanation', '')
            })
        
        # إنشاء ملف الفصل المنفصل
        chapter_data = {
            "id": f"chapter_{current_num}",
            "book_id": book_id,
            "chapter": current_num,
            "title": ch.get('title', f'الفصل {current_num}'),
            "description": ch.get('description', ''),
            "questions": normalized_questions
        }
        
        chapter_file = os.path.join(book_dir, f"chapter_{current_num}.json")
        with open(chapter_file, 'w', encoding='utf-8') as f:
            json.dump(chapter_data, f, ensure_ascii=False, indent=2)
        
        print(f"  ✅ تم إنشاء chapter_{current_num}.json: {ch.get('title', '')} ({len(normalized_questions)} سؤال)")
        converted += 1
    
    # حذف chapters.json بعد التحويل الناجح
    try:
        os.remove(chapters_file)
        print(f"  🗑️ تم حذف chapters.json")
    except Exception as e:
        print(f"  ⚠️ فشل حذف {chapters_file}: {e}")
    
    return converted

def main():
    print("🔄 تحويل وتوحيد ملفات chapters.json...\n")
    
    if not os.path.exists(DATA_DIR):
        print(f"❌ المجلد {DATA_DIR} غير موجود")
        return

    total = 0
    for book_dir in sorted(os.listdir(DATA_DIR)):
        full_path = os.path.join(DATA_DIR, book_dir)
        if not os.path.isdir(full_path):
            continue
        
        chapters_file = os.path.join(full_path, "chapters.json")
        if os.path.exists(chapters_file):
            print(f"📚 {book_dir}:")
            count = split_book_chapters(book_dir)
            total += count
    
    if total == 0:
        print("✅ لا توجد ملفات chapters.json جديدة تحتاج تحويل")
    else:
        print(f"\n✅ تم تحويل وتوحيد {total} فصل بنجاح")

if __name__ == "__main__":
    main()
