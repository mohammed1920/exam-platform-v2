#!/usr/bin/env python3
"""
منصة الاختبارات القانونية V2 - أداة تحديث الأسئلة
Exam Platform V2 - Questions Update Tool

هذا السكريبت يساعدك في:
1. إضافة أسئلة جديدة من ملفات JSON
2. تحديث فهرس الكتب تلقائياً
3. التحقق من صحة البيانات
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime

# ألوان للطباعة
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_success(msg):
    print(f"{Colors.GREEN}✓ {msg}{Colors.END}")

def print_error(msg):
    print(f"{Colors.RED}✗ {msg}{Colors.END}")

def print_info(msg):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.END}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.END}")

def validate_question(question):
    """التحقق من صحة السؤال"""
    required_fields = ['id', 'q', 'options', 'correct', 'explanation']
    for field in required_fields:
        if field not in question:
            return False, f"الحقل المفقود: {field}"
    
    if not isinstance(question['options'], list) or len(question['options']) < 2:
        return False, "يجب أن يكون هناك خيارين على الأقل"
    
    if question['correct'] >= len(question['options']):
        return False, "رقم الإجابة الصحيحة غير صحيح"
    
    return True, "صحيح"

def validate_chapter(chapter):
    """التحقق من صحة الفصل"""
    if 'questions' not in chapter:
        return False, "الفصل يجب أن يحتوي على حقل 'questions'"
    
    if not isinstance(chapter['questions'], list):
        return False, "'questions' يجب أن تكون قائمة"
    
    for i, question in enumerate(chapter['questions']):
        valid, msg = validate_question(question)
        if not valid:
            return False, f"السؤال {i+1}: {msg}"
    
    return True, "صحيح"

def get_chapter_count(book_dir):
    """حساب عدد الفصول في الكتاب"""
    if not os.path.exists(book_dir):
        return 0
    
    count = 0
    for file in os.listdir(book_dir):
        if file.startswith('chapter_') and file.endswith('.json'):
            count += 1
    return count

def update_books_index(data_dir='./data'):
    """تحديث فهرس الكتب تلقائياً"""
    print_info("جاري تحديث فهرس الكتب...")
    
    books = []
    books_json_path = os.path.join(data_dir, 'books.json')
    
    # قراءة الكتب الموجودة
    if os.path.exists(books_json_path):
        with open(books_json_path, 'r', encoding='utf-8') as f:
            try:
                books = json.load(f)
            except:
                books = []
    
    # فحص المجلدات الجديدة
    for item in os.listdir(data_dir):
        item_path = os.path.join(data_dir, item)
        if os.path.isdir(item_path) and item.startswith('law_'):
            chapter_count = get_chapter_count(item_path)
            if chapter_count > 0:
                # التحقق من وجود الكتاب
                existing = next((b for b in books if b['id'] == item), None)
                if existing:
                    existing['chapters'] = chapter_count
                    print_info(f"تم تحديث: {existing['title']} ({chapter_count} فصول)")
                else:
                    # إضافة كتاب جديد
                    new_book = {
                        'id': item,
                        'title': item.replace('law_', '').replace('_', ' ').title(),
                        'author': 'منصة الاختبارات القانونية',
                        'description': 'كتاب قانوني متخصص',
                        'chapters': chapter_count
                    }
                    books.append(new_book)
                    print_success(f"تم إضافة كتاب جديد: {new_book['title']}")
    
    # حفظ الفهرس المحدث
    with open(books_json_path, 'w', encoding='utf-8') as f:
        json.dump(books, f, ensure_ascii=False, indent=2)
    
    print_success(f"تم تحديث فهرس الكتب ({len(books)} كتاب)")
    return books

def validate_all_chapters(data_dir='./data'):
    """التحقق من صحة جميع الفصول"""
    print_info("جاري فحص جميع الفصول...")
    
    errors = []
    total_questions = 0
    
    for book_dir in os.listdir(data_dir):
        book_path = os.path.join(data_dir, book_dir)
        if os.path.isdir(book_path) and book_dir.startswith('law_'):
            for file in os.listdir(book_path):
                if file.endswith('.json'):
                    file_path = os.path.join(book_path, file)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            chapter = json.load(f)
                        
                        valid, msg = validate_chapter(chapter)
                        if valid:
                            total_questions += len(chapter['questions'])
                            print_success(f"{book_dir}/{file}: {len(chapter['questions'])} أسئلة")
                        else:
                            errors.append(f"{book_dir}/{file}: {msg}")
                            print_error(f"{book_dir}/{file}: {msg}")
                    except Exception as e:
                        errors.append(f"{book_dir}/{file}: {str(e)}")
                        print_error(f"{book_dir}/{file}: خطأ في القراءة")
    
    print_info(f"إجمالي الأسئلة: {total_questions}")
    
    if errors:
        print_warning(f"عدد الأخطاء: {len(errors)}")
        return False
    else:
        print_success("جميع الفصول صحيحة ✓")
        return True

def main():
    print(f"\n{Colors.BLUE}{'='*50}")
    print("منصة الاختبارات القانونية V2 - أداة التحديث")
    print(f"{'='*50}{Colors.END}\n")
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == 'validate':
            if validate_all_chapters():
                sys.exit(0)
            else:
                sys.exit(1)
        
        elif command == 'update':
            update_books_index()
            if validate_all_chapters():
                print_success("تم التحديث بنجاح!")
                sys.exit(0)
            else:
                print_error("هناك أخطاء في البيانات")
                sys.exit(1)
        
        else:
            print_error(f"أمر غير معروف: {command}")
            print_info("الأوامر المتاحة: validate, update")
            sys.exit(1)
    
    else:
        print_info("الأوامر المتاحة:")
        print("  python3 update_questions.py validate  - التحقق من صحة جميع الأسئلة")
        print("  python3 update_questions.py update    - تحديث فهرس الكتب والتحقق")
        print()

if __name__ == '__main__':
    main()
