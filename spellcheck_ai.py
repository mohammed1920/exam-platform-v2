import argparse
import datetime
import json
import os
import tempfile

from google import genai
from groq import Groq

GEMINI_KEY = os.getenv("GEMINI_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

BOOKS_FILE = "books.json"
DATA_DIR = "data"
STATE_FILE = os.path.join("reports", "scan_state.json")
REPORT_FILE = os.path.join("reports", "spelling_report.json")
BATCH_SIZE = 5


def analyze_with_ai(prompt):
    """Try Gemini first, then Groq. Never report success without a response."""
    failures = []

    if GEMINI_KEY:
        try:
            client = genai.Client(api_key=GEMINI_KEY)
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            if response and response.text and response.text.strip():
                print(f"✅ تمت الاستجابة من Gemini ({GEMINI_MODEL}).", flush=True)
                return response.text
            failures.append(f"Gemini ({GEMINI_MODEL}): استجابة فارغة")
        except Exception as exc:
            failures.append(f"Gemini ({GEMINI_MODEL}): {exc}")
            print(f"⚠️ تعذر استخدام Gemini: {exc}. سيتم التحويل إلى Groq...", flush=True)
    else:
        failures.append("GEMINI_API_KEY غير مضبوط")

    if GROQ_KEY:
        try:
            client = Groq(api_key=GROQ_KEY)
            completion = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
            )
            content = completion.choices[0].message.content
            if content and content.strip():
                print(f"✅ تمت الاستجابة من Groq ({GROQ_MODEL}).", flush=True)
                return content
            failures.append(f"Groq ({GROQ_MODEL}): استجابة فارغة")
        except Exception as exc:
            failures.append(f"Groq ({GROQ_MODEL}): {exc}")
            print(f"❌ تعذر استخدام Groq: {exc}", flush=True)
    else:
        failures.append("GROQ_API_KEY غير مضبوط")

    raise RuntimeError("فشل الاتصال بجميع خدمات الذكاء الاصطناعي: " + " | ".join(failures))


def load_json(filepath, default):
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as file:
                return json.load(file)
        except (OSError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"تعذر قراءة الملف {filepath}: {exc}") from exc
    return default


def save_json(filepath, data):
    directory = os.path.dirname(filepath) or "."
    os.makedirs(directory, exist_ok=True)
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=directory,
            prefix=".tmp-",
            suffix=".json",
            delete=False,
        ) as file:
            temp_path = file.name
            json.dump(data, file, ensure_ascii=False, indent=2)
            file.write("\n")
        os.replace(temp_path, filepath)
    except Exception:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
        raise


def extract_questions_from_file(filepath):
    raw_data = load_json(filepath, None)
    if raw_data is None:
        return []
    if isinstance(raw_data, list):
        return raw_data
    if isinstance(raw_data, dict):
        questions = raw_data.get("questions", [])
        if isinstance(questions, list):
            return questions
    return []


def get_all_chapters():
    chapters_list = []
    if os.path.exists(DATA_DIR):
        for root, dirs, files in os.walk(DATA_DIR):
            dirs.sort()
            for filename in sorted(files):
                if filename.endswith(".json") and filename not in (
                    "books.json", "books_info.json", "contact.json"
                ):
                    folder_name = os.path.basename(root)
                    if folder_name != DATA_DIR:
                        chapter_text = filename.replace("chapter_", "").replace(".json", "")
                        chapters_list.append({
                            "book_id": folder_name,
                            "chapter_file": filename,
                            "chapter_num": int(chapter_text) if chapter_text.isdigit() else chapter_text,
                            "full_path": os.path.join(root, filename),
                        })
    return chapters_list


def parse_ai_response(raw_result):
    cleaned = raw_result.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"استجابة الذكاء الاصطناعي ليست JSON صالحاً: {exc}") from exc

    if not isinstance(parsed, list):
        raise RuntimeError("استجابة الذكاء الاصطناعي غير مطابقة: المطلوب JSON Array.")
    if any(not isinstance(item, dict) for item in parsed):
        raise RuntimeError("استجابة الذكاء الاصطناعي تحتوي عناصر غير صالحة داخل المصفوفة.")
    return parsed


def run_checker():
    all_chapters = get_all_chapters()
    if not all_chapters:
        raise RuntimeError("لم يتم العثور على أي فصول أو أسئلة داخل مجلد data.")

    state = load_json(STATE_FILE, {"chapter_index": 0, "start_batch": 0})
    if not isinstance(state, dict):
        raise RuntimeError("ملف حالة الفحص غير صالح؛ لم يتم تغيير المؤشر.")

    ch_index = state.get("chapter_index", 0)
    start_batch = state.get("start_batch", 0)
    if (
        not isinstance(ch_index, int) or isinstance(ch_index, bool) or ch_index < 0
        or not isinstance(start_batch, int) or isinstance(start_batch, bool) or start_batch < 0
    ):
        raise RuntimeError("قيم مؤشر الفحص غير صالحة؛ لم يتم تغيير الحالة.")

    if ch_index >= len(all_chapters):
        print("🔄 اكتملت دورة الفحص؛ ستبدأ دورة جديدة من الفصل الأول.")
        ch_index = 0
        start_batch = 0

    current_ch = all_chapters[ch_index]
    print(
        f"📖 جاري فحص: {current_ch['book_id']} / {current_ch['chapter_file']} "
        f"(الفصل {ch_index + 1} من {len(all_chapters)})",
        flush=True,
    )

    questions = extract_questions_from_file(current_ch["full_path"])
    if not questions:
        state["chapter_index"] = ch_index + 1
        state["start_batch"] = 0
        save_json(STATE_FILE, state)
        print("⚠️ لا توجد قائمة أسئلة في هذا الملف؛ تم تخطيه.")
        return

    total_q = len(questions)
    if start_batch >= total_q:
        state["chapter_index"] = ch_index + 1
        state["start_batch"] = 0
        save_json(STATE_FILE, state)
        print("✅ اكتمل هذا الفصل؛ سيتم الانتقال للفصل التالي في التشغيل القادم.")
        return

    end_batch = min(start_batch + BATCH_SIZE, total_q)
    batch_questions = questions[start_batch:end_batch]

    texts_to_check = []
    for question in batch_questions:
        question_id = question.get("id", "?")
        question_uid = question.get("uid") or question_id
        question_text = question.get("question") or question.get("q", "")
        options = question.get("options") or question.get("opts", [])

        if question_text:
            texts_to_check.append({
                "question_id": question_id,
                "question_uid": question_uid,
                "field": "question",
                "text": question_text,
            })

        for index, option in enumerate(options):
            if option:
                texts_to_check.append({
                    "question_id": question_id,
                    "question_uid": question_uid,
                    "field": f"option_{index}",
                    "text": option,
                })

    prompt = f"""
أنت مدقق لغوي متخصص في مراجعة الأسئلة والخيارات القانونية.
مهمتك: اكتشاف الأخطاء الإملائية واللغوية الجوهرية فقط.

⚠️ قواعد التجاوز الصارمة (تجاهل هذه الأمور تماماً ولا تعتبرها خطأ):
1. تجاهل همزات القطع والوصل (مثل: الى/إلى، اصلاح/إصلاح، احمد/أحمد، استئناف/إستئناف).
2. تجاهل التفريق بين التاء المربوطة والهاء (مثل: قضية/قضيه).
3. تجاهل الياء والألف المقصورة (مثل: علي/على).

🎯 التركيز فقط على الأخطاء الجوهرية مثل:
- الأحرف المقلوبة أو المفقودة أو الزائدة بداخل الكلمة (مثلاً: "قانونيىة"، "المحمكة"، "عوقبات").
- الكلمات الخاطئة لغوياً أو النحوية الفادحة التي تغير معنى الجملة.
- الكلمات المتداخلة بدون مسافات.

صيغة الرد المطلوبة حصراً هي JSON Array بدون أي مقدمات أو شرح:
[
  {{
    "question_id": 1,
    "field": "question",
    "flagged_word": "الكلمة الخاطئة",
    "original": "النص الكامل كما هو في القائمة بدون تعديل",
    "corrected": "النص الكامل بعد تصحيح الكلمة الخاطئة"
  }}
]

إذا لم تجد أخطاء جوهرية واضحة (غير الهمزات)، أرجع مصفوفة فارغة: []

القائمة للتدقيق:
{json.dumps(texts_to_check, ensure_ascii=False, indent=2)}
"""

    # لا يتم تعديل التقرير أو مؤشر الفحص إلا بعد استلام JSON صالح وتحليله بالكامل.
    raw_result = analyze_with_ai(prompt)
    parsed_items = parse_ai_response(raw_result)

    by_id = {str(question.get("id")): question for question in batch_questions}
    for item in parsed_items:
        item["book_id"] = current_ch["book_id"]
        item["chapter"] = current_ch["chapter_num"]
        source_question = by_id.get(str(item.get("question_id")))
        if source_question and source_question.get("uid"):
            item["question_uid"] = source_question["uid"]

    print("\n--- 📝 نتيجة الفحص ---")
    print(json.dumps(parsed_items, ensure_ascii=False, indent=2))
    print("----------------------\n")

    report = load_json(REPORT_FILE, {"generated_at": "", "items": []})
    if not isinstance(report, dict):
        report = {"generated_at": "", "items": []}
    if not isinstance(report.get("items"), list):
        report["items"] = []

    report["items"].extend(parsed_items)
    report["generated_at"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    save_json(REPORT_FILE, report)

    if end_batch >= total_q:
        state["chapter_index"] = ch_index + 1
        state["start_batch"] = 0
    else:
        state["chapter_index"] = ch_index
        state["start_batch"] = end_batch
    save_json(STATE_FILE, state)
    print("💾 تم حفظ التقرير وتحديث مؤشر الفحص بنجاح.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI Arabic spelling checker")
    parser.add_argument("--repo-root", default=".", help="مسار جذر المستودع")
    args = parser.parse_args()
    os.chdir(os.path.abspath(args.repo_root))

    try:
        run_checker()
    except Exception as exc:
        print(f"❌ توقف المدقق الإملائي دون تحديث مؤشر الفحص: {exc}", flush=True)
        raise SystemExit(1)
