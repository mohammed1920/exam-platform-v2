#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    import google.generativeai as genai
except ImportError:
    print("❌ مكتبة google-generativeai غير مثبتة.")
    sys.exit(1)

# استخدام النموذج المستقر لـ Flash
MODEL = "gemini-1.5-flash"
BATCH_SIZE = 10 

SYSTEM_PROMPT = """أنت مدقق لغوي متمكن للنصوص والأسئلة القانونية باللغة العربية.
مهمتك: فحص الأسئلة والخيارات واكتشاف الأخطاء الإملائية والطباعية (مثل: حروف ناقصة/زائدة، أخطاء همزات، أو كلمات مشوهة).

تعليمات الإرجاع:
- افحص كلاً من نص السؤال (question) والخيارات (options).
- أعد النتيجة بصيغة JSON فقط بهذا الشكل بالضبط:
{"issues": [{"question_index": 0, "field": "question", "original": "النص الكامل الحالي فيه الخطأ", "corrected": "النص بعد التصحيح", "flagged_word": "الكلمة الخاطئة"}]}

إذا كان الخطأ في أحد الخيارات، اجعل "field" هو اسم الخيار مثل "option_0" أو "option_1".
إذا لم تجد أي أخطاء، أعد: {"issues": []}
"""

def check_batch(model, questions_batch):
    numbered = []
    for i, q in enumerate(questions_batch):
        numbered.append({
            "question_index": i,
            "question": q.get("question", ""),
            "options": q.get("options", []),
        })

    user_content = json.dumps(numbered, ensure_ascii=False, indent=2)

    try:
        response = model.generate_content(
            user_content,
            generation_config={"response_mime_type": "application/json"},
        )
        text = response.text.strip()
        text = text.replace("```json", "").replace("```", "").strip()
        result = json.loads(text)
        return result.get("issues", [])
    except Exception as e:
        print(f"⚠️ خطأ بمعالجة دفعة: {e}")
        return []

def scan_book(model, book_id, book_dir, report):
    chapter_files = sorted(
        book_dir.glob("chapter_*.json"),
        key=lambda f: int(f.stem.split("_")[1]) if "_" in f.stem and f.stem.split("_")[1].isdigit() else 0
    )

    for cf in chapter_files:
        try:
            chapter_num = int(cf.stem.split("_")[1])
        except (IndexError, ValueError):
            chapter_num = 1

        with open(cf, "r", encoding="utf-8") as f:
            data = json.load(f)

        questions = data.get("questions", [])
        if not questions:
            continue

        print(f"  🔍 فحص {book_id} / الفصل {chapter_num} ({len(questions)} سؤال)...")

        for start in range(0, len(questions), BATCH_SIZE):
            batch = questions[start:start + BATCH_SIZE]
            issues = check_batch(model, batch)

            for issue in issues:
                q_idx_in_batch = issue.get("question_index")
                if q_idx_in_batch is None or q_idx_in_batch >= len(batch):
                    continue
                real_q = batch[q_idx_in_batch]

                report["items"].append({
                    "id": f"{book_id}_ch{chapter_num}_q{real_q.get('id', start + q_idx_in_batch + 1)}",
                    "book_id": book_id,
                    "chapter": chapter_num,
                    "question_id": real_q.get("id"),
                    "field": issue.get("field", "question"),
                    "flagged_word": issue.get("flagged_word", ""),
                    "original": issue.get("original", ""),
                    "corrected": issue.get("corrected", ""),
                    "status": "pending",
                })

            time.sleep(0.3)

def main():
    parser = argparse.ArgumentParser(description="فحص إملائي لأسئلة المنصة")
    parser.add_argument("--repo-root", required=True, help="مسار جذر المشروع")
    parser.add_argument("--only", nargs="*", default=None, help="فحص كتب محددة")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ GEMINI_API_KEY غير موجود.")
        sys.exit(1)

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(MODEL, system_instruction=SYSTEM_PROMPT)

    repo_root = Path(args.repo_root).resolve()
    data_dir = repo_root / "data"
    books_file = data_dir / "books.json"

    if not books_file.exists():
        print(f"❌ لم يتم العثور على ملف الكتب في المسار: {books_file}")
        sys.exit(1)

    with open(books_file, "r", encoding="utf-8") as f:
        books = json.load(f)

    report = {"generated_at": time.strftime("%Y-%m-%d %H:%M:%S"), "items": []}

    for book in books:
        book_id = book["id"]
        if args.only and book_id not in args.only:
            continue
        book_dir = data_dir / book_id
        if not book_dir.is_dir():
            continue
        print(f"📘 فحص كتاب: {book.get('title', book_id)}")
        scan_book(model, book_id, book_dir, report)

    reports_dir = repo_root / "reports"
    reports_dir.mkdir(exist_ok=True)
    out_path = reports_dir / "spelling_report.json"
    
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\nتم التحديث بنجاح! إجمالي الأخطاء المكتشفة: {len(report['items'])}")

if __name__ == "__main__":
    main()
