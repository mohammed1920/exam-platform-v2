import os
import json
import datetime
import google.generativeai as genai
from groq import Groq

# ----------------------------------------------------
# 1. إعداد المتغيرات والمفاتيح
# ----------------------------------------------------
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")

BOOKS_FILE = "books.json"
DATA_DIR = "data"
STATE_FILE = os.path.join("reports", "scan_state.json")
REPORT_FILE = os.path.join("reports", "spelling_report.json")

BATCH_SIZE = 5

# ----------------------------------------------------
# 2. دالة الذكاء الاصطناعي المشتركة (Gemini -> Groq)
# ----------------------------------------------------
def analyze_with_ai(prompt):
    if GEMINI_KEY:
        try:
            genai.configure(api_key=GEMINI_KEY)
            model = genai.GenerativeModel('gemini-2.0-flash')
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text
        except Exception as e:
            print(f"⚠️ فشل/استنفاد Gemini: {e}. يتم التحويل إلى Groq...", flush=True)

    if GROQ_KEY:
        try:
            client = Groq(api_key=GROQ_KEY)
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1
            )
            return completion.choices[0].message.content
        except Exception as e:
            print(f"❌ فشل Groq أيضاً: {e}", flush=True)

    return None

# ----------------------------------------------------
# 3. إدارة الملفات والدوال المساعدة
# ----------------------------------------------------
def load_json(filepath, default):
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return default
    return default

def save_json(filepath, data):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

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
            for file in sorted(files):
                if file.endswith(".json") and file not in ["books.json", "books_info.json", "contact.json"]:
                    folder_name = os.path.basename(root)
                    if folder_name != DATA_DIR:
                        ch_num = file.replace("chapter_", "").replace(".json", "")
                        chapters_list.append({
                            "book_id": folder_name,
                            "chapter_file": file,
                            "chapter_num": int(ch_num) if ch_num.isdigit() else ch_num,
                            "full_path": os.path.join(root, file)
                        })

    return chapters_list

# ----------------------------------------------------
# 4. المحرك الرئيسي للتدقيق
# ----------------------------------------------------
def run_checker():
    all_chapters = get_all_chapters()
    if not all_chapters:
        print("❌ لم يتم العثور على أي فصول أو أسئلة داخل مجلدات data.")
        return

    state = load_json(STATE_FILE, {"chapter_index": 0, "start_batch": 0})
    ch_index = state.get("chapter_index", 0)
    start_batch = state.get("start_batch", 0)

    if ch_index >= len(all_chapters):
        print("🔄 تم فحص كافة الكتب والفصول بالكامل! إعادة الدورة من الفصل الأول...")
        ch_index = 0
        start_batch = 0

    current_ch = all_chapters[ch_index]
    print(f"📖 جاري فحص: {current_ch['book_id']} / {current_ch['chapter_file']} (الفصل {ch_index + 1} من {len(all_chapters)})", flush=True)

    questions = extract_questions_from_file(current_ch["full_path"])
    if not questions:
        state["chapter_index"] = ch_index + 1
        state["start_batch"] = 0
        save_json(STATE_FILE, state)
        print(f"⚠️ لم يتم العثور على قائمة أسئلة داخل الملف، تم التخطي للفصل التالي.")
        return

    total_q = len(questions)

    if start_batch >= total_q:
        state["chapter_index"] = ch_index + 1
        state["start_batch"] = 0
        save_json(STATE_FILE, state)
        print(f"✅ اكتمل هذا الفصل، سيتم الانتقال للفصل التالي في التشغيل القادم.")
        return

    end_batch = min(start_batch + BATCH_SIZE, total_q)
    batch_questions = questions[start_batch:end_batch]

    # تفكيك النصوص لجعل كل خيار وسؤال عنصراً مستقلاً بدقة
    texts_to_check = []
    for q in batch_questions:
        q_id = q.get("id", "?")
        q_text = q.get("question") or q.get("q", "")
        options = q.get("options") or q.get("opts", [])
        
        if q_text:
            texts_to_check.append({
                "question_id": q_id,
                "field": "question",
                "text": q_text
            })
            
        for idx, opt in enumerate(options):
            if opt:
                texts_to_check.append({
                    "question_id": q_id,
                    "field": f"option_{idx}",
                    "text": opt
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

    raw_result = analyze_with_ai(prompt)

    if raw_result:
        parsed_items = []
        try:
            cleaned_res = raw_result.strip()
            if cleaned_res.startswith("```json"):
                cleaned_res = cleaned_res.split("```json")[1].split("```")[0].strip()
            elif cleaned_res.startswith("```"):
                cleaned_res = cleaned_res.split("```")[1].split("```")[0].strip()
            
            parsed = json.loads(cleaned_res)
            if isinstance(parsed, list):
                for item in parsed:
                    item["book_id"] = current_ch["book_id"]
                    item["chapter"] = current_ch["chapter_num"]
                    parsed_items.append(item)
        except Exception as e:
            print(f"⚠️ تعذر تحليل استجابة الذكاء الاصطناعي كـ JSON: {e}")

        print("\n--- 📝 نتيجة الفحص ---")
        print(json.dumps(parsed_items, ensure_ascii=False, indent=2))
        print("----------------------\n")

        report = load_json(REPORT_FILE, {"generated_at": "", "items": []})
        if not isinstance(report, dict):
            report = {"generated_at": "", "items": []}

        if "items" not in report or not isinstance(report["items"], list):
            report["items"] = []

        report["items"].extend(parsed_items)
        report["generated_at"] = str(datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

        save_json(REPORT_FILE, report)

        if end_batch >= total_q:
            state["chapter_index"] = ch_index + 1
            state["start_batch"] = 0
        else:
            state["start_batch"] = end_batch

        save_json(STATE_FILE, state)
        print("💾 تم حفظ التقرير بنجاح.")
    else:
        print("❌ فشل الاتصال بخدمات الذكاء الاصطناعي.")

if __name__ == "__main__":
    run_checker()
