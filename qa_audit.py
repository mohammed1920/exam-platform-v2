#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
qa_audit.py
فحص جودة شامل لأسئلة المنصة القانونية، على مرحلتين لتفادي انحياز النموذج:

  المسار أ) فحص هيكلي (خيارات متشابهة / صياغة غير واضحة):
     يُرسل السؤال + الخيارات كاملة (لا حساسية انحياز هنا لأن الفحص شكلي).

  المسار ب) فحص صحة الإجابة (بدون انحياز):
     1) "الإجابة العمياء": يُرسل نص السؤال فقط (بدون خيارات ولا الإجابة المحددة)
        ويُطلب من النموذج يجاوب بصياغته الحرة وفق القانون العراقي، أو يصرّح
        أنه غير متأكد / أن السؤال يحتاج الخيارات أصلاً (نوع "أي مما يلي").
     2) "المطابقة": يُرسل نص الإجابة الحرة + الخيارات الأربعة (بدون الإشارة
        لأيها المحددة حاليًا) ويُطلب من النموذج يحدد رقم الخيار الأقرب لمعناها.
     3) المقارنة الفعلية بين الخيار المطابق والإجابة المحددة فعليًا تصير
        بكود بايثون محليًا (مو بالذكاء الاصطناعي) — هذا يمنع انحياز "التبرير".

يعتمد نفس نمط spellcheck_ai.py: Gemini كمزود أساسي، Groq كبديل تلقائي،
بلا أي حلقة إعادة محاولة لا نهائية. يفحص دفعة واحدة بكل تشغيلة ويحفظ تقدمه
بـ reports/qa_scan_state.json ليكمل من نفس النقطة بالمرة الجاية.
لا يعدّل أي ملف chapter_N.json مباشرة — الاكتشاف فقط، التصحيح يدوي عبر admin.html
"""

import os
import json
import glob
import sys

# ============ الإعدادات ============
DATA_DIR = "data"
REPORTS_DIR = "reports"
STATE_FILE = os.path.join(REPORTS_DIR, "qa_scan_state.json")
REPORT_FILE = os.path.join(REPORTS_DIR, "qa_report.json")

BATCH_SIZE = 10

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

GEMINI_MODEL = "gemini-3.6-flash"
GROQ_MODEL = "llama-3.3-70b-versatile"

VALID_ISSUE_TYPES = {
    "اجابة_غير_صحيحة",
    "خيارات_متشابهة",
    "صياغة_غير_واضحة",
    "لا_يوجد_اجابة_واحدة_صحيحة",
}

# ---------- المرحلة أ: فحص هيكلي (وضوح الصياغة + تمايز الخيارات) ----------
STRUCTURE_PROMPT = """أنت مراجع لغوي وتربوي لأسئلة اختبارات قانونية عراقية.
لكل سؤال مُعطى (بنصه وخياراته الأربعة)، تحقق من نقطتين فقط:
1. هل صياغة السؤال واضحة ومفهومة (غير ناقصة أو ملتبسة)؟
2. هل يوجد خياران أو أكثر متشابهان بالمعنى لدرجة تسبب التباسًا حقيقيًا للطالب؟

لا تحكم على صحة الإجابة المحددة إطلاقًا — هذا خارج مهمتك هنا.

أجب حصرًا بصيغة JSON فقط (مصفوفة)، بدون أي نص إضافي أو Markdown:
[
  {
    "question_id": "...",
    "has_issue": true,
    "issue_type": "صياغة_غير_واضحة" أو "خيارات_متشابهة",
    "reason": "شرح مختصر بالعربي"
  }
]
إذا لم يوجد إشكال بسؤال، لا تُدرجه بالمخرجات إطلاقًا."""

# ---------- المرحلة ب-1: الإجابة العمياء (بدون خيارات) ----------
BLIND_ANSWER_PROMPT = """أنت خبير قانوني عراقي. لكل سؤال أدناه (بدون أي خيارات مرفقة)،
أجب بصياغتك الحرة وفق القانون العراقي النافذ.

مهم جدًا:
- إذا كان السؤال من النوع الذي لا يمكن الإجابة عليه إلا برؤية خيارات (مثل "أي مما يلي..."
  أو "كل ما يلي صحيح ما عدا")، اجعل confident=false ولا تخمّن.
- إذا لم تكن متأكدًا تمامًا من الإجابة القانونية الدقيقة، اجعل confident=false بدل التخمين.
- أجب بجملة قصيرة ومباشرة تحمل جوهر الإجابة الصحيحة فقط، بدون شرح مطوّل.

أجب حصرًا بصيغة JSON فقط (مصفوفة)، بدون أي نص إضافي أو Markdown:
[
  {
    "question_id": "...",
    "confident": true,
    "model_answer": "نص الإجابة الصحيحة بصياغتك الحرة"
  }
]
لغير المتأكد: اجعل confident=false و model_answer=null."""

# ---------- المرحلة ب-2: المطابقة مع الخيارات ----------
MATCH_PROMPT = """لكل عنصر أدناه، معك إجابة صحيحة (model_answer) وقائمة خيارات (options)
مرقّمة من 0. حدد رقم الخيار الذي يطابق معنى الإجابة الصحيحة بشكل واضح.

إذا لم يطابق أي خيار معنى الإجابة الصحيحة بوضوح، استخدم -1.

أجب حصرًا بصيغة JSON فقط (مصفوفة)، بدون أي نص إضافي أو Markdown:
[
  {
    "question_id": "...",
    "matched_option_index": 2
  }
]"""


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


def normalize_questions(raw_questions, book_id, chapter_num):
    """يطبّع كل سؤال: يولّد id مؤقت لو مفقود، ويدعم أسماء الحقول القديمة
    (q/opts/ans/correct) تحسبًا لبيانات لم تُرحّل بالكامل بعد."""
    normalized = []
    for i, q in enumerate(raw_questions):
        qid = q.get("id")
        if not qid:
            qid = f"{book_id}_ch{chapter_num}_{i}"

        question_text = q.get("question", q.get("q", ""))
        options = q.get("options", q.get("opts", []))
        answer = q.get("answer", q.get("ans", q.get("correct")))

        if not question_text or not options or answer is None:
            # سؤال ناقص البيانات الأساسية — يتخطّى بدل ما يفشل السكريبت كامل
            continue

        normalized.append({
            "id": qid,
            "question": question_text,
            "options": options,
            "answer": answer,
        })
    return normalized


def get_all_chapter_files():
    """يرجع كل ملفات الفصول مرتبة حسب book_id ثم رقم الفصل، بشكل حتمي (deterministic)."""
    files = glob.glob(os.path.join(DATA_DIR, "*", "chapter_*.json"))

    def sort_key(path):
        book_id = os.path.basename(os.path.dirname(path))
        chapter_num = int(os.path.basename(path).replace("chapter_", "").replace(".json", ""))
        return (book_id, chapter_num)

    return sorted(files, key=sort_key)


def call_gemini(system_prompt, user_content):
    import google.generativeai as genai

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL, system_instruction=system_prompt)
    response = model.generate_content(
        user_content,
        generation_config={"temperature": 0.1},
    )
    return response.text


def call_groq(system_prompt, user_content):
    from groq import Groq

    client = Groq(api_key=GROQ_API_KEY)
    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        temperature=0.1,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
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


def analyze_with_ai(system_prompt, user_content, step_label):
    """Gemini أولاً، Groq عند الفشل. بدون أي حلقة إعادة محاولة لا نهائية."""
    last_error = None

    if GEMINI_API_KEY:
        try:
            raw = call_gemini(system_prompt, user_content)
            return json.loads(clean_json_text(raw))
        except Exception as e:
            last_error = e
            print(f"⚠️ [{step_label}] Gemini فشل: {e} — التحويل إلى Groq")

    if GROQ_API_KEY:
        try:
            raw = call_groq(system_prompt, user_content)
            return json.loads(clean_json_text(raw))
        except Exception as e:
            last_error = e
            print(f"⚠️ [{step_label}] Groq فشل أيضًا: {e}")

    print(f"❌ [{step_label}] فشل التحليل لهذه الدفعة، تخطّي. آخر خطأ: {last_error}")
    return []


def run_structure_check(questions_batch):
    payload = [
        {"question_id": q["id"], "question": q["question"], "options": q["options"]}
        for q in questions_batch
    ]
    return analyze_with_ai(STRUCTURE_PROMPT, json.dumps(payload, ensure_ascii=False), "فحص هيكلي")


def run_blind_answer_check(questions_batch):
    payload = [{"question_id": q["id"], "question": q["question"]} for q in questions_batch]
    return analyze_with_ai(BLIND_ANSWER_PROMPT, json.dumps(payload, ensure_ascii=False), "إجابة عمياء")


def run_match_check(blind_results, questions_by_id):
    """يبني دفعة المطابقة فقط للعناصر اللي النموذج كان متأكد منها بمرحلة الإجابة العمياء."""
    match_payload = []
    for item in blind_results:
        if not item.get("confident"):
            continue
        qid = item.get("question_id")
        q = questions_by_id.get(qid)
        if not q or not item.get("model_answer"):
            continue
        match_payload.append({
            "question_id": qid,
            "model_answer": item["model_answer"],
            "options": q["options"],
        })

    if not match_payload:
        return []

    return analyze_with_ai(MATCH_PROMPT, json.dumps(match_payload, ensure_ascii=False), "مطابقة")


def build_answer_issues(blind_results, match_results, questions_by_id):
    """يقارن محليًا (بدون AI) رقم الخيار المطابق مع الإجابة المحددة فعليًا."""
    blind_by_id = {b["question_id"]: b for b in blind_results if b.get("confident")}
    match_by_id = {m["question_id"]: m for m in match_results}

    issues = []
    for qid, blind in blind_by_id.items():
        match = match_by_id.get(qid)
        if not match:
            continue
        q = questions_by_id.get(qid)
        if not q:
            continue

        matched_idx = match.get("matched_option_index")
        current_idx = q.get("answer")
        model_answer_text = blind.get("model_answer", "")

        if matched_idx is None:
            continue

        if matched_idx == -1:
            issues.append({
                "question_id": qid,
                "issue_type": "لا_يوجد_اجابة_واحدة_صحيحة",
                "current_answer_index": current_idx,
                "suggested_answer_index": None,
                "reason": f"الإجابة الصحيحة وفق الفحص: «{model_answer_text}» — لا يوجد خيار مطابق واضح لها بين الخيارات المتاحة.",
            })
        elif matched_idx != current_idx:
            issues.append({
                "question_id": qid,
                "issue_type": "اجابة_غير_صحيحة",
                "current_answer_index": current_idx,
                "suggested_answer_index": matched_idx,
                "reason": f"الإجابة الصحيحة وفق الفحص: «{model_answer_text}» — وهذا يطابق الخيار رقم {matched_idx + 1} وليس الخيار المحدد حاليًا رقم {current_idx + 1 if current_idx is not None else '?'}.",
            })

    return issues


def enrich_and_merge(new_issues, questions_by_id, book_id, chapter_num, existing_report):
    """يضيف بيانات العرض ويدمج مع التقرير المتراكم بدون تكرار."""
    existing_ids = {(item["question_id"], item["book_id"], item["chapter"]) for item in existing_report}

    added = 0
    for item in new_issues:
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
        save_state({"chapter_index": 0, "start_batch": 0})
        return

    chapter_path = chapter_files[chapter_index]
    book_id = os.path.basename(os.path.dirname(chapter_path))

    with open(chapter_path, "r", encoding="utf-8") as f:
        chapter_data = json.load(f)

    questions = normalize_questions(chapter_data.get("questions", []), book_id, chapter_data.get("chapter"))
    chapter_num = chapter_data.get("chapter")
    questions_by_id = {q["id"]: q for q in questions}

    batch = questions[start_batch:start_batch + BATCH_SIZE]

    if not batch:
        print(f"✅ اكتمل فحص {book_id} / chapter_{chapter_num}")
        save_state({"chapter_index": chapter_index + 1, "start_batch": 0})
        save_report(report)
        return

    print(f"🔍 فحص {book_id} / chapter_{chapter_num} — الأسئلة {start_batch} إلى {start_batch + len(batch)}")

    # المسار أ: فحص هيكلي
    structure_results = run_structure_check(batch)
    structure_issues = [
        {
            "question_id": r.get("question_id"),
            "issue_type": r.get("issue_type"),
            "current_answer_index": questions_by_id.get(r.get("question_id"), {}).get("answer"),
            "suggested_answer_index": None,
            "reason": r.get("reason", ""),
        }
        for r in structure_results if r.get("has_issue")
    ]

    # المسار ب: فحص صحة الإجابة (عمياء ثم مطابقة)
    blind_results = run_blind_answer_check(batch)
    match_results = run_match_check(blind_results, questions_by_id)
    answer_issues = build_answer_issues(blind_results, match_results, questions_by_id)

    all_issues = structure_issues + answer_issues
    added = enrich_and_merge(all_issues, questions_by_id, book_id, chapter_num, report)
    print(f"📝 أُضيف {added} إشكال جديد للتقرير (هيكلي: {len(structure_issues)}، إجابة: {len(answer_issues)})")

    save_report(report)
    save_state({"chapter_index": chapter_index, "start_batch": start_batch + BATCH_SIZE})

    print("✅ انتهت هذه الدفعة.")


if __name__ == "__main__":
    main()
