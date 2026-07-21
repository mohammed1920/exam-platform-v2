#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argp..///arse
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

BATCH_SIZE = 10

# قائمة بكل النماذج المتاحة والحديثة للتدقيق مرتبة حسب الأفضلية
ALL_AVAILABLE_MODELS = [
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
    "gemini-1.5-flash-8b"
]

SYSTEM_PROMPT = """أنت مدقق لغوي للنصوص والأسئلة القانونية باللغة العربية.
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
    text = text.strip()
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        return match.group(0)
    return text

def check_batch_with_all_models(client, questions_batch):
    """فحص الدفعة والتنقل بين كافة النماذج المتاحة في حال فشل أي منها."""
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

    # المحاولة على جميع النماذج المتاحة بالترتيب
    for current_model in ALL_AVAILABLE_MODELS:
        max_retries = 3
        for attempt in range(max_retries):
            try:
                print(f"🤖 جاري المحاولة باستخدام النموذج: {current_model}")
                response = client.models.generate_content(
                    model=current_model,
                    contents=user_content,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        response_mime_type="application/json"
                    )
                )
                cleaned = clean_json_response(response.text)
                result = json.loads(cleaned)
                return result.get("issues", [])
            
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    wait_time = (attempt + 1) * 30
                    print(f"⏳ تجاوز حد الطلبات على ({current_model})، انتظار {wait_time} ثانية...")
                    time.sleep(wait_time)
                elif "404" in err_str or "NOT_FOUND" in err_str:
                    print(f"⚠️ الموديل ({current_model}) غير متاح (404)، التبديل للنموذج التالي...")
                    break  # الانتقال للنموذج التالي في القائمة
                else:
                    print(f"⚠️ خطأ أثناء استجابة الموديل ({current_model}): {e}")
                    break

    print("❌ تعذر فحص هذه الدفعة بعد تجربة كل النماذج المتاحة.")
    return []

def get_all_chapters(data_dir, books):
    all_chapters = []
    for book in books:
        book_id = book["id"]
        book_dir = data_dir / book_id
        if not book_dir.is_dir():
            continue
        
        chapter_files = sorted(
            book_dir.glob("chapter_*.json"),
            key=lambda f: int(f.stem.split("_")[1]) if "_" in f.stem and f.stem.split("_")[1].isdigit() else 0
        )
        
        for cf in chapter_files:
            try:
                ch_num = int(cf.stem.split("_")[1])
            except (IndexError, ValueError):
                ch_num = 1
            
            all_chapters.append({
                "book_id": book_id,
                "book_title": book.get("title", book_id),
                "chapter_num": ch_num,
                "file_path": cf
            })
    return all_chapters

def main():
    parser = argparse.ArgumentParser(description="فحص إملائي آلي مقسّم للفصول مع تغطية كافة نماذج AI المتاحة")
    parser.add_argument("--repo-root", required=True, help="مسار جذر المشروع")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ GEMINI_API_KEY غير موجود.")
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    repo_root = Path(args.repo_root).resolve()
    data_dir = repo_root / "data"
    reports_dir = repo_root / "reports"
    reports_dir.mkdir(exist_ok=True)

    books_file = data_dir / "books.json"
    state_file = reports_dir / "scan_state.json"
    out_path = reports_dir / "spelling_report.json"

    if not books_file.exists():
        print(f"❌ لم يتم العثور على ملف الكتب: {books_file}")
        sys.exit(1)

    with open(books_file, "r", encoding="utf-8") as f:
        books = json.load(f)

    chapters_list = get_all_chapters(data_dir, books)
    if not chapters_list:
        print("❌ لا توجد فصول للفحص.")
        sys.exit(0)

    current_index = 0
    if state_file.exists():
        try:
            with open(state_file, "r", encoding="utf-8") as f:
                state = json.load(f)
                current_index = state.get("last_index", -1) + 1
        except Exception:
            current_index = 0

    if current_index >= len(chapters_list):
        print("🔄 تم فحص كافة الفصول بالكامل! إعادة الدورة من الفصل الأول...")
        current_index = 0

    target = chapters_list[current_index]
    print(f"🎯 [فحص الدورة المجدولة] ({current_index + 1}/{len(chapters_list)}):")
    print(f"📘 الكتاب: {target['book_title']} ({target['book_id']})")
    print(f"📑 الفصل: {target['chapter_num']}")

    with open(target['file_path'], "r", encoding="utf-8") as f:
        data = json.load(f)

    questions = data.get("questions", [])
    new_items = []

    if questions:
        total_batches = (len(questions) + BATCH_SIZE - 1) // BATCH_SIZE
        for idx, start in enumerate(range(0, len(questions), BATCH_SIZE)):
            batch = questions[start:start + BATCH_SIZE]
            print(f"🔄 جاري تدقيق الدفعة ({idx + 1}/{total_batches})...")
            
            issues = check_batch_with_all_models(client, batch)

            for issue in issues:
                q_idx = issue.get("question_index")
                if q_idx is None or q_idx >= len(batch):
                    continue
                real_q = batch[q_idx]

                new_items.append({
                    "id": f"{target['book_id']}_ch{target['chapter_num']}_q{real_q.get('id', start + q_idx + 1)}",
                    "book_id": target['book_id'],
                    "chapter": target['chapter_num'],
                    "question_id": real_q.get("id"),
                    "field": issue.get("field", "question"),
                    "flagged_word": issue.get("flagged_word", ""),
                    "original": issue.get("original", ""),
                    "corrected": issue.get("corrected", ""),
                    "status": "pending",
                })
            
            # فاصل أمان دقيقة بين كل دفعة لضمان أفضل أداء واستقرار الخطة المجانية
            if idx + 1 < total_batches:
                print("☕ إيقاف مؤقت لمدة 60 ثانية للسلامة وتجنب حدود API...")
                time.sleep(60.0)

    existing_report = {"generated_at": "", "items": []}
    if out_path.exists():
        try:
            with open(out_path, "r", encoding="utf-8") as f:
                existing_report = json.load(f)
        except Exception:
            pass

    items_dict = {item["id"]: item for item in existing_report.get("items", [])}
    for item in new_items:
        items_dict[item["id"]] = item

    final_report = {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "items": list(items_dict.values())
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(final_report, f, ensure_ascii=False, indent=2)

    with open(state_file, "w", encoding="utf-8") as f:
        json.dump({
            "last_index": current_index,
            "last_book": target['book_id'],
            "last_chapter": target['chapter_num'],
            "updated_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }, f, ensure_ascii=False, indent=2)

    print(f"✅ تم فحص الفصل بنجاح واكتشاف {len(new_items)} ملاحظات!")
    print(f"📊 إجمالي الملاحظات المسجلة في المنصة: {len(final_report['items'])}")

if __name__ == "__main__":
    main()

