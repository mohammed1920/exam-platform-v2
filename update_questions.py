import json
import os
import re

# الإعدادات
DATA_DIR = "data"
BOOKS_FILE = os.path.join(DATA_DIR, "books.json")

# معلومات الكتب الافتراضية (سيتم استخدامها إذا لم يوجد ملف تعريف خاص داخل مجلد الكتاب)
BOOK_METADATA = {
    "law_constitutional": {
        "title": "القانون الدستوري",
        "author": "د. حميد حنون خالد",
        "description": "دراسة النظرية العامة للدولة والدستور والنظم السياسية.",
        "color": "#e74c3c"
    },
    "law_administrative": {
        "title": "القضاء الإداري",
        "author": "د. وسام صبار",
        "description": "دراسة الرقابة القضائية على أعمال الإدارة ودعوى الإلغاء والتعويض.",
        "color": "#8e44ad"
    },
    "law_general_penalties": {
        "title": "قانون العقوبات العام",
        "author": "مستشار قانوني",
        "description": "مجموعة اختبارات شاملة في قانون العقوبات العام والقواعد العامة للجريمة والعقاب.",
        "color": "#c29d5f"
    },
    "law_special_sanctions": {
        "title": "قانون العقوبات الخاص",
        "author": "مستشار قانوني",
        "description": "دراسة تفصيلية للجرائم الواقعة على الأشخاص والأموال والمصلحة العامة.",
        "color": "#e67e22"
    },
    "law_international_humanitarian": {
        "title": "القانون الدولي الإنساني",
        "author": "مستشار قانوني",
        "description": "قواعد حماية ضحايا النزاعات المسلحة والحد من وسائل وأساليب القتال.",
        "color": "#27ae60"
    },
    "law_organizations": {
        "title": "المنظمات الدولية",
        "author": "مستشار قانوني",
        "description": "دراسة التنظيم الدولي المعاصر والأمم المتحدة والوكالات المتخصصة.",
        "color": "#2980b9"
    }
}

def update_books_index():
    """تحديث ملف books.json بناءً على المجلدات الموجودة في data فقط"""
    books = []
    print("🔍 جاري مسح مجلدات البيانات في v2...")
    
    if not os.path.exists(DATA_DIR):
        print(f"❌ المجلد {DATA_DIR} غير موجود")
        return

    # ترتيب المجلدات لضمان ثبات الترتيب في الموقع
    folders = sorted(os.listdir(DATA_DIR))
    
    for folder in folders:
        folder_path = os.path.join(DATA_DIR, folder)
        if os.path.isdir(folder_path) and folder.startswith('law_'):
            # حساب عدد الفصول: نعتمد على "أعلى رقم فصل موجود فعلياً" وليس عدد الملفات،
            # لأن وجود فجوات (فصول محذوفة من الوسط) يجعل عدد الملفات أقل من أعلى رقم،
            # وهذا كان يسبب فصولاً "منشورة" بدون ملف حقيقي وفصولاً أخرى غير قابلة للوصول.
            chapter_files = [f for f in os.listdir(folder_path) if f.startswith('chapter_') and f.endswith('.json')]
            chapter_nums = []
            for f in chapter_files:
                m = re.search(r'chapter_(\d+)\.json$', f)
                if m:
                    chapter_nums.append(int(m.group(1)))
            ch_count = max(chapter_nums) if chapter_nums else 0

            # تحذير إن وُجدت فجوات في الترقيم (فصول مفقودة بين 1 وأعلى رقم)
            missing = [n for n in range(1, ch_count + 1) if n not in chapter_nums]
            if missing:
                print(f"⚠️  {folder}: فصول مفقودة الملف رغم وجود ترقيم أعلى منها: {missing}")

            if ch_count > 0:
                # جلب معلومات الكتاب من الميتا أو استخدام قيم افتراضية
                meta = BOOK_METADATA.get(folder, {
                    "title": folder.replace('law_', '').replace('_', ' ').title(),
                    "author": "مستشار قانوني",
                    "description": f"دراسة شاملة واختبارات في {folder}.",
                    "color": "#c29d5f"
                })
                
                books.append({
                    "id": folder,
                    "title": meta["title"],
                    "author": meta["author"],
                    "description": meta["description"],
                    "chapters": ch_count,
                    "color": meta.get("color", "#c29d5f")
                })
                print(f"✅ تم إضافة: {meta['title']} ({ch_count} فصول)")

    with open(BOOKS_FILE, "w", encoding="utf-8") as f:
        json.dump(books, f, ensure_ascii=False, indent=2)
    print(f"🚀 تم تحديث الفهرس بنجاح! إجمالي الكتب في v2: {len(books)}")

def validate_data():
    """فحص سلامة ملفات JSON وإصلاح المعرفات المفقودة"""
    print("🛠️ جاري فحص وإصلاح ملفات البيانات...")
    total_q = 0
    for root, dirs, files in os.walk(DATA_DIR):
        for file in files:
            if file.startswith("chapter_") and file.endswith(".json"):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    modified = False
                    # التأكد من وجود ID للفصل
                    if 'id' not in data:
                        book_id = os.path.basename(root)
                        ch_num = file.replace('chapter_', '').replace('.json', '')
                        data['id'] = f"{book_id}_ch{ch_num}"
                        modified = True
                        
                    for i, q in enumerate(data.get('questions', [])):
                        total_q += 1
                        if 'id' not in q:
                            q['id'] = f"{data['id']}_q{i+1}"
                            modified = True
                        if 'explanation' not in q or not q['explanation']:
                            q['explanation'] = "لا يوجد شرح متوفر حالياً."
                            modified = True
                            
                    if modified:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            json.dump(data, f, ensure_ascii=False, indent=2)
                except Exception as e:
                    print(f"❌ خطأ في {file_path}: {e}")
    print(f"✓ تم فحص {total_q} سؤال بنجاح.")

if __name__ == "__main__":
    update_books_index()
    validate_data()
