#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
qa_audit.py
فحص جودة شامل لأسئلة المنصة القانونية:
  1) هل الإجابة المحددة (answer) صحيحة فعلاً وفق القانون العراقي؟
  2) هل الخيارات متمايزة بشكل واضح (مو خيارين متشابهين لدرجة الالتباس)؟
  3) هل صياغة السؤال واضحة وغير ملتبسة (يوجد إجابة صحيحة وحيدة واضحة)؟

يعتمد نفس نمط spellcheck_ai.py:
  - Gemini كمزود أساسي، Groq (llama-3.3-70b-versatile) كبديل تلقائي عند الفشل/الاستنفاد
  - بلا أي حلقة إعادة محاولة لا نهائية
  - يفحص دفعة واحدة (BATCH_SIZE) بكل تشغيلة
  - يحفظ تقدمه بـ reports/scan_state.json (ملف منفصل عن الإملائي: qa_scan_state.json)
  - يراكم النتائج بـ reports/qa_report.json
  - لا يعدّل أي ملف chapter_N.json مباشرة — الاكتشاف فقط، التصحيح يدوي عبر admin.html
"""

import os
import json
import glob
import time
import sys

# ============ الإعدادات ============
DATA_DIR = "data"
REPORTS_DIR = "reports"
STATE_FILE = os.path.join(REPORTS_DIR, "qa_scan_state.json")
REPORT_FILE = os.path.join(REPORTS_DIR, "qa_report.json")

BATCH_SIZE = 10  # أصغر من الإملائي لأن فحص الصحة القانونية أثقل بالتفكير لكل سؤال

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

GEMINI_MODEL = "gemini-2.0-flash"
GROQ_MODEL = "llama-3.3-70b-versatile"

VALID_ISSUE_TYPES = {
    "اجابة_غير_صحيحة",      # الإجابة المحددة answer خاطئة وفق القانون العراقي
    "خيارات_متشابهة",       # خياران أو أكثر متطابقان بالمعنى لدرجة الالتباس
    "صياغة_غير_واضحة",      # السؤال نفسه ملتبس / ناقص / غير مفهوم
    "لا_يوجد_اجابة_واحدة_صحيحة",  # أكثر من خيار يمكن اعتباره صحيحًا، أو ولا خيار صحيح
}

SYSTEM_PROMPT = """أنت خبير قانوني عراقي متخصص بمراجعة أسئلة الاختبارات القانونية.
لكل سؤال، تحقق من:
1. هل رقم الإجابة المحددة (answer، مفهرس من 0) هو فعلاً الإجابة الصحيحة وفق القانون العراقي النافذ؟
2. هل يوجد خياران أو أكثر متشابهان بالمعنى لدرجة تسبب التباس؟
3. هل صياغة السؤال واضحة، ويوجد لها إجابة صحيحة واحدة فقط بين الخيارات؟

أجب حصرًا بصيغة JSON فقط، بدون أي نص أو Markdown أو تعليق إضافي، بهذا الشكل (مصفوفة):
[
  {
    "question_id": "...",
    "has_issue": true,
    "issue_type": "اجابة_غير_صحيحة" أو "خيارات_متشابهة" أو "صياغة_غير_واضحة" أو "لا_يوجد_اجابة_واحدة_صحيحة",
    "current_answer_index": 1,
    "suggested_answer_index": 3,
    "reason": "شرح مختصر بالعربي لسبب الاشتباه، مع الأساس القانوني إن وجد (اسم القانون/رقم المادة إن كنت متأكدًا)"
  }
]

قواعد صارمة:
- إذا لم يوجد أي إشكال بالسؤال، لا تُدرجه بالمخرجات إطلاقًا (فقط الأسئلة المشكوك فيها).
- suggested_answer_index اختياري: أدرجه فقط عند issue_type = "اجابة_غير_صحيحة" وأنت متأكد نسبيًا من الإجابة الصحيحة، وإلا اتركه null.
- لا تخترع مواد قانونية غير متأكد منها؛ إن لم تكن متأكدًا من الأساس القانوني الدقيق، اذكر ذلك ضمن reason بدل اختلاقه.
- current_answer_index يجب أن يطابق قيمة answer كما وردت بالسؤال بالضبط.
"""


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"chapter_index": 0, "start_batch": 0}


def save_state(state):
    os.makedirs(REPORTS_DIR, exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def load_report():
    if os.path.exists(REPORT_FILE):
        with open(REPORT_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_report(report):
    os.makedirs(REPORTS_DIR, exist_ok=True)
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)


def get_all_chapter_files():
    """يرجع كل ملفات الفصول مرتبة حسب book_id ثم رقم الفصل، بشكل حتمي (deterministic)."""
    files = glob.glob(os.path.join(DATA_DIR, "*", "chapter_*.json"))

    def sort_key(path):
        book_id = os.path.basename(os.path.dirname(path))
        chapter_num = int(os.path.basename(path).replace("chapter_", "").replace(".json", ""))
        return (book_id, chapter_num)

    return sorted(files, key=sort_key)


def build_batch_payload(questions_batch):
    """يجهز نسخة مبسطة من الأسئلة (بدون explanation) للإرسال للـAI."""
    payload = []
    for q in questions_batch:
        payload.append({
            "question_id": q["id"],
            "question": q["question"],
            "options": q["options"],
            "answer": q["answer"],
        })
    return payload


def call_gemini(batch_payload):
    import google.generativeai as genai

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)
    prompt = SYSTEM_PROMPT + "\n\nالأسئلة:\n" + json.dumps(batch_payload, ensure_ascii=False)
    response = model.generate_content(
        prompt,
        generation_config={"temperature": 0.1},
    )
    return response.text


def call_groq(batch_payload):
    from groq import Groq

    client = Groq(api_key=GROQ_API_KEY)
    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        temperature=0.1,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "الأسئلة:\n" + json.dumps(batch_payload, ensure_ascii=False)},
        ],
    )
    return completion.choices[0].message.content


def clean_json_text(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return text.strip()


def analyze_with_ai(batch_payload):
    """Gemini أولاً، Groq عند الفشل. بدون أي حلقة إعادة محاولة لا نهائية."""
    last_error = None

    if GEMINI_API_KEY:
        try:
            raw = call_gemini(batch_payload)
            return json.loads(clean_json_text(raw))
        except Exception as e:
            last_error = e
            print(f"⚠️ Gemini فشل: {e} — التحويل إلى Groq")

    if GROQ_API_KEY:
        try:
            raw = call_groq(batch_payload)
            return json.loads(clean_json_text(raw))
        except Exception as e:
            last_error = e
            print(f"⚠️ Groq فشل أيضًا: {e}")

    print(f"❌ فشل التحليل لهذه الدفعة، تخطّي. آخر خطأ: {last_error}")
    return []


def enrich_and_merge(ai_results, questions_by_id, book_id, chapter_num, existing_report):
    """يضيف بيانات العرض (نص السؤال/الخيارات/الفصل) ويدمج مع التقرير المتراكم بدون تكرار."""
    existing_ids = {(item["question_id"], item["book_id"], item["chapter"]) for item in existing_report}

    added = 0
    for item in ai_results:
        if not item.get("has_issue"):
            continue
        if item.get("issue_type") not in VALID_ISSUE_TYPES:
            continue

        qid = item.get("question_id")
        q = questions_by_id.get(qid)
        if not q:
            continue

        key = (qid, book_id, chapter_num)
        if key in existing_ids:
            continue

        existing_report.append({
            "question_id": qid,
            "book_id": book_id,
            "chapter": chapter_num,
            "issue_type": item.get("issue_type"),
            "question": q["question"],
            "options": q["options"],
            "current_answer_index": item.get("current_answer_index", q.get("answer")),
            "suggested_answer_index": item.get("suggested_answer_index"),
            "reason": item.get("reason", ""),
            "status": "pending",
        })
        added += 1

    return added


def main():
    if not GEMINI_API_KEY and not GROQ_API_KEY:
        print("❌ لا يوجد GEMINI_API_KEY ولا GROQ_API_KEY. أوقف التشغيل.")
        sys.exit(1)

    chapter_files = get_all_chapter_files()
    if not chapter_files:
        print("لا توجد ملفات فصول بمجلد data/.")
        return

    state = load_state()
    report = load_report()

    chapter_index = state["chapter_index"]
    start_batch = state["start_batch"]

    if chapter_index >= len(chapter_files):
        print("✅ اكتمل فحص كل الفصول بدورة كاملة. إعادة التشغيل تبدأ دورة جديدة من الأول.")
        state = {"chapter_index": 0, "start_batch": 0}
        save_state(state)
        return

    chapter_path = chapter_files[chapter_index]
    book_id = os.path.basename(os.path.dirname(chapter_path))

    with open(chapter_path, "r", encoding="utf-8") as f:
        chapter_data = json.load(f)

    questions = chapter_data.get("questions", [])
    chapter_num = chapter_data.get("chapter")
    questions_by_id = {q["id"]: q for q in questions}

    batch = questions[start_batch:start_batch + BATCH_SIZE]

    if not batch:
        # انتهت أسئلة هذا الفصل، انتقل للفصل التالي
        print(f"✅ اكتمل فحص {book_id} / chapter_{chapter_num}")
        state = {"chapter_index": chapter_index + 1, "start_batch": 0}
        save_state(state)
        save_report(report)
        return

    print(f"🔍 فحص {book_id} / chapter_{chapter_num} — الأسئلة {start_batch} إلى {start_batch + len(batch)}")

    payload = build_batch_payload(batch)
    ai_results = analyze_with_ai(payload)

    added = enrich_and_merge(ai_results, questions_by_id, book_id, chapter_num, report)
    print(f"📝 أُضيف {added} إشكال جديد للتقرير")

    save_report(report)

    state = {"chapter_index": chapter_index, "start_batch": start_batch + BATCH_SIZE}
    save_state(state)

    print("✅ انتهت هذه الدفعة.")


if __name__ == "__main__":
    main()
