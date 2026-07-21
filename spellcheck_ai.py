import os
import json
import google.generativeai as genai
from groq import Groq

# ----------------------------------------------------
# 1. إعداد المتغيرات والمفاتيح
# ----------------------------------------------------
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")

BOOKS_FILE = "books.json"  # يقع في الجذر مباشرة
DATA_DIR = "data"
STATE_FILE = os.path.join("reports", "scan_state.json")
REPORT_FILE = os.path.join("reports", "spelling_report.json")

BATCH_SIZE = 5  # عدد الأسئلة المقروءة في الطلب الواحد

# ----------------------------------------------------
# 2. دالة الذكاء الاصطناعي المشتركة (Gemini -> Groq)
# ----------------------------------------------------
def analyze_with_ai(prompt):
    # المحاولة الأولى: Gemini
    if GEMINI_KEY:
        try:
            genai.configure(api_key=GEMINI_KEY)
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text
        except Exception as e:
            print(f"⚠️ فشل/استنفاد Gemini: {e}. يتم التحويل إلى Groq...", flush=True)

    # المحاولة الثانية: Groq (إذا فشل Gemini)
    if GROQ_KEY:
        try:
            client = Groq(api_key=GROQ_KEY)
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2
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

def get_all_chapters():
    """البحث المباشر عن كل ملفات الفصول داخل مجلدات data الفرعية"""
    chapters_list = []
    
    # 1. القراءة اعتماداً على ملف books.json إذا كان موجوداً
    books_data = load_json(BOOKS_FILE, load_json(os.path.join(DATA_DIR, "books.json"), []))
    
    if isinstance(books_data, list) and len(books_data) > 0:
        for book in books_data:
            if isinstance(book, dict):
                book_id = book.get("id", "")
                chapters = book.get("chapters", [])
                
                # إذا كانت الفصول مصفوفة أسماء ملفات أو كائنات
                if isinstance(chapters, list):
                    for ch in chapters:
                        ch_file = ch.get("file") if isinstance(ch, dict) else str(ch)
                        # البحث في جذر data وفي المجلد الفرعي الخاص بالقانون
                        possible_paths = [
                            os.path.join(DATA_DIR, book_id, ch_file),
                            os.path.join(DATA_DIR, ch_file)
                        ]
                        for path in possible_paths:
                            if os.path.exists(path):
                                chapters_list.append({
                                    "book_id": book_id,
                                    "chapter_file": ch_file,
                                    "full_path": path
                                })
                                break

    # 2. خطة احتياطية: المسح المباشر لمجلد data إذا لم تظهر نتائج من books.json
    if not chapters_list and os.path.exists(DATA_DIR):
        for root, dirs, files in os.walk(DATA_DIR):
            for file in sorted(files):
                if file.endswith(".json") and file not in ["books.json", "books_info.json", "contact.json"]:
                    chapters_list.append({
                        "book_id": os.path.basename(root),
                        "chapter_file": file,
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

    # جلب حالة التقدم القائمة
    state = load_json(STATE_FILE, {"chapter_index": 0, "start_batch": 0})
    ch_index = state.get("chapter_index", 0)
    start_batch = state.get("start_batch", 0)

    # إعادة الدورة من البداية عند اكتمال كافة الفصول
    if ch_index >= len(all_chapters):
        print("🔄 تم فحص كافة الكتب والفصول بالكامل! إعادة الدورة من الفصل الأول...")
        ch_index = 0
        start_batch = 0

    current_ch = all_chapters[ch_index]
    print(f"📖 جاري فحص: {current_ch['book_id']} / {current_ch['chapter_file']} (الفصل {ch_index + 1} من {len(all_chapters)})", flush=True)

    questions = load_json(current_ch["full_path"], [])
    if not isinstance(questions, list) or len(questions) == 0:
        # إذا كان الملف فارغاً الانتقال للفصل التالي
        state["chapter_index"] = ch_index + 1
        state["start_batch"] = 0
        save_json(STATE_FILE, state)
        print(f"⚠️ الملف فارغ، تم التخطي إلى الفصل التالي.")
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

    prompt = f"""
أنت مدقق لغوي متمكن في النصوص والأسئلة الأكاديمية القانونية.
قم بتدقيق الأسئلة التالية إملائياً ولغوياً فقط.
إذا وجدت أخطاء، اذكر رقم السؤال والخطأ مع التصحيح.
إذا لم تكن هناك أخطاء، اكتب: "لا توجد أخطاء".

الأسئلة:
{json.dumps(batch_questions, ensure_ascii=False, indent=2)}
"""

    result = analyze_with_ai(prompt)

    if result:
        print("\n--- 📝 نتيجة الفحص ---")
        print(result)
        print("----------------------\n")

        report = load_json(REPORT_FILE, [])
        report.append({
            "book": current_ch["book_id"],
            "chapter": current_ch["chapter_file"],
            "batch": f"{start_batch + 1}-{end_batch}",
            "result": result
        })
        save_json(REPORT_FILE, report)

        if end_batch >= total_q:
            state["chapter_index"] = ch_index + 1
            state["start_batch"] = 0
        else:
            state["start_batch"] = end_batch

        save_json(STATE_FILE, state)
        print("💾 تم حفظ التقرير وحالة التقدم بنجاح.")
    else:
        print("❌ فشل الاتصال بخدمات الذكاء الاصطناعي، سيعاد التجرِبة في التشغيل القادم.")

if __name__ == "__main__":
    run_checker()
