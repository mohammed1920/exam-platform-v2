#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
spellcheck_ai.py
=================
يفحص كل أسئلة منصة الاختبارات باستخدام Claude API، ويكتشف الأخطاء الإملائية/الطباعية
الحقيقية فقط (يتجاهل المصطلحات القانونية النادرة وأسماء الأعلام لأنه يفهم السياق).

⚠️ هذا السكريبت لا يعدّل أي ملف سؤال إطلاقًا — فقط ينتج تقرير مراجعة بصيغة JSON
   بمسار reports/spelling_report.json، تراجعه لاحقًا من لوحة الأدمن وتقرر أنت
   أي اقتراح تقبله أو ترفضه.

الاستخدام:
    export GEMINI_API_KEY="AIza..."
    python3 spellcheck_ai.py --repo-root .

يتطلب:
    pip install google-generativeai --break-system-packages
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    import google.generativeai as genai
except ImportError:
    print("❌ مكتبة google-generativeai غير مثبتة. شغّل: pip install google-generativeai --break-system-packages")
    sys.exit(1)

MODEL = "gemini-2.0-flash"
BATCH_SIZE = 15  # عدد الأسئلة المرسلة دفعة وحدة لكل طلب (لتقليل عدد الطلبات والتكلفة)

SYSTEM_PROMPT = """أنت مدقق لغوي متخصص بالنصوص القانونية العربية الفصحى.
مهمتك: فحص أسئلة اختبارات قانونية واكتشاف الأخطاء الإملائية والطباعية الحقيقية فقط.

قواعد صارمة:
- لا تُبلّغ عن مصطلحات قانونية متخصصة حتى لو كانت نادرة (مثل: التقادم، الإبراء، البطلان النسبي).
- لا تُبلّغ عن أسماء أعلام أو أسماء مؤلفين.
- لا تُبلّغ عن اختلافات أسلوبية أو صياغة بديلة صحيحة نحويًا.
- بلّغ فقط عن: أخطاء إملائية واضحة (حروف مقلوبة/محذوفة/زائدة)، أخطاء طباعية، أو كلمات مشوّهة
  واضح أنها ناتجة عن خطأ نسخ (مثل قلب حرفي "لا" الشائع بالنصوص المنسوخة من PDF).
- إذا لم تجد أي خطأ حقيقي بالسؤال، لا تُدرجه بالنتيجة إطلاقًا.

أعد النتيجة بصيغة JSON فقط، بدون أي نص إضافي قبلها أو بعدها، بهذا الشكل بالضبط:
{"issues": [{"question_index": 0, "field": "question", "original": "النص الكامل الحالي فيه الخطأ", "corrected": "النص كاملاً بعد التصحيح", "flagged_word": "الكلمة المحددة الخاطئة"}]}

إذا الخطأ بأحد الخيارات (options) بدل نص السؤال، اجعل "field" يساوي "option_0" أو "option_1" حسب رقم الخيار (بداية من صفر).
إذا ما فيه أي أخطاء بكل الدفعة، أعد {"issues": []}
"""


def check_batch(model, questions_batch):
    """يرسل دفعة أسئلة لـ Gemini ويرجع قائمة الأخطاء المكتشفة."""
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
        print(f"⚠️  خطأ بمعالجة دفعة: {e}")
        return []


def scan_book(model, book_id, book_dir, report):
    chapter_files = sorted(
        book_dir.glob("chapter_*.json"),
        key=lambda f: int(f.stem.split("_")[1])
    )

    for cf in chapter_files:
        chapter_num = int(cf.stem.split("_")[1])
        with open(cf, "r", encoding="utf-8") as f:
            data = json.load(f)

        questions = data.get("questions", [])
        if not questions:
            continue

        print(f"  🔍 {book_id} / الفصل {chapter_num} ({len(questions)} سؤال)...")

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
                    "status": "pending",  # pending / accepted / rejected (تُحدَّث من لوحة الأدمن)
                })

            time.sleep(0.5)  # تهدئة بسيطة بين الطلبات


def main():
    parser = argparse.ArgumentParser(description="فحص إملائي بالذكاء الاصطناعي لأسئلة المنصة")
    parser.add_argument("--repo-root", required=True, help="مسار جذر مشروع exam-platform-v2")
    parser.add_argument("--only", nargs="*", default=None, help="فحص كتب محددة فقط بمعرّفاتها")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ متغير البيئة GEMINI_API_KEY غير موجود.")
        sys.exit(1)

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(MODEL, system_instruction=SYSTEM_PROMPT)

    repo_root = Path(args.repo_root).resolve()
    data_dir = repo_root / "data"
    books_file = data_dir / "books.json"

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
        print(f"📘 {book.get('title', book_id)} ({book_id})")
        scan_book(model, book_id, book_dir, report)

    reports_dir = repo_root / "reports"
    reports_dir.mkdir(exist_ok=True)
    out_path = reports_dir / "spelling_report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n📋 التقرير جاهز: {out_path}")
    print(f"   إجمالي الملاحظات المكتشفة: {len(report['items'])}")


if __name__ == "__main__":
    main()
