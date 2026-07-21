#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import json
import os
import sys
import time
import re
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("❌ مكتبة google-genai غير مثبتة.")
    sys.exit(1)

# استخدام اسم الموديل السريع والحديث
MODEL = "gemini-2.5-flash"
BATCH_SIZE = 10 

SYSTEM_PROMPT = """أنت مدقق لغوي متمكن للنصوص والأسئلة القانونية باللغة العربية.
مهمتك: فحص الأسئلة والخيارات واكتشاف الأخطاء الإملائية والطباعية الحقيقية فقط.

يجب أن ترجع النتيجة بصيغة JSON حصرية بالهيكل التالي:
{
  "issues": [
    {
      "question_index": 0,
      "field": "question",
      "original": "النص الكلي أو الكلمة الخطأ",
      "corrected": "التصحيح المقترح",
      "flagged_word": "الكلمة الخاطئة"
    }
  ]
}

إذا لم تجد أي أخطاء، أرجع: {"issues": []}
"""

def clean_json_response(text):
    """استخراج كود JSON من رد النموذج بدقة."""
    text = text.strip()
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        return match.group(0)
    return text

def check_batch(client, questions_batch):
    numbered = []
    for i, q in enumerate(questions_batch):
        q_text = q.get("question") or q.get("text") or ""
        q_opts = q.get("options") or q.get("choices") or []
        numbered.append({
            "question_index": i,
            "question": q_text,
            "options": q_opts,
        })

    user_content = json.dumps(numbered, ensure_ascii=False, indent=2)

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=user_content,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json"
            )
        )
        raw_text = response.text
        cleaned = clean_json_response(raw_text)
        result = json.loads(cleaned)
        
        issues = result.get("issues", [])
        if issues:
            print(f"    ✨ تم اكتشاف {len(issues)} ملاحظات في هذه الدفعة!")
        return issues
    except Exception as e:
        print(f"⚠️ خطأ أثناء تحليل استجابة Gemini: {e}")
        return []

def scan_book(client, book_id, book_dir, report):
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
            issues = check_batch(client, batch)

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

    client = genai.Client(api_key=api_key)

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
            print(f"⚠️ مجلد الكتاب غير موجود: {book_dir}")
            continue
        print(f"📘 فحص كتاب: {book.get('title', book_id)}")
        scan_book(client, book_id, book_dir, report)

    reports_dir = repo_root / "reports"
    reports_dir.mkdir(exist_ok=True)
    out_path = reports_dir / "spelling_report.json"
    
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n✅ تم اكتمال الفحص! إجمالي الملاحظات المكتشفة: {len(report['items'])}")

if __name__ == "__main__":
    main()

