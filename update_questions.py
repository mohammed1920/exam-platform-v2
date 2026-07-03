import json
import os
import re
import requests

# الإعدادات
USERNAME = "mohammed1920"
DATA_DIR = "data"
BOOKS_FILE = os.path.join(DATA_DIR, "books.json")

def get_law_books_from_github():
    """يجلب الكتب تلقائياً من مستودعات GitHub التي تبدأ بـ law-"""
    books = []
    print(f"🔍 جاري البحث عن مستودعات قانونية لحساب {USERNAME}...")
    
    url = f"https://api.github.com/users/{USERNAME}/repos?sort=updated&per_page=100"
    response = requests.get(url)
    if response.status_code != 200:
        print("❌ فشل في جلب المستودعات من GitHub")
        return []
    
    repos = response.json()
    # جلب المستودعات التي تبدأ بـ law- وتجنب المستودع الحالي والمكتبة
    law_repos = [repo for repo in repos if repo['name'].lower().startswith('law') and repo['name'] != 'exam-platform-v2' and repo['name'] != 'Library']
    
    for repo in law_repos:
        repo_name = repo['name']
        description = repo.get('description') or "كتاب قانوني | مستشار قانوني"
        
        # تحليل العنوان والمؤلف من الوصف
        if "|" in description:
            parts = description.split("|")
            title = parts[0].strip()
            author = parts[1].strip()
        else:
            title = description.strip()
            author = "مستشار قانوني"
            
        # تحديد معرف الكتاب (slug)
        book_id = repo_name.lower().replace('-', '_').replace('___', '_')
        
        # حساب عدد الفصول
        ch_count = 0
        book_path = os.path.join(DATA_DIR, book_id)
        
        if os.path.exists(book_path):
            # إذا كان الكتاب موجوداً محلياً كـ JSON
            ch_count = sum(1 for f in os.listdir(book_path) if f.startswith('chapter_') and f.endswith('.json'))
        else:
            # إذا كان الكتاب لا يزال في مستودع خارجي (HTML)
            contents_url = f"https://api.github.com/repos/{USERNAME}/{repo_name}/contents/"
            contents_resp = requests.get(contents_url)
            if contents_resp.status_code == 200:
                files = contents_resp.json()
                ch_count = sum(1 for f in files if f['name'].lower().startswith('ch') and f['name'].endswith('.html'))

        if ch_count > 0:
            books.append({
                "id": book_id,
                "repo": repo_name,
                "title": title,
                "author": author,
                "description": f"دراسة شاملة واختبارات في {title}.",
                "chapters": ch_count,
                "color": get_color_for_book(book_id)
            })
            print(f"✅ تم اكتشاف كتاب: {title} ({ch_count} فصول)")

    return books

def get_color_for_book(book_id):
    colors = {
        "law_constitutional": "#e74c3c",
        "law_administrative": "#8e44ad",
        "law_general_penalties": "#c29d5f",
        "law_special_sanctions": "#e67e22",
        "law_international_humanitarian": "#27ae60",
        "law_organizations": "#2980b9",
        "law_international": "#34495e"
    }
    return colors.get(book_id, "#c29d5f")

def update_books_index():
    """تحديث ملف books.json بالكامل بناءً على GitHub والملفات المحلية"""
    books = get_law_books_from_github()
    if not books:
        print("⚠️ لم يتم العثور على كتب لتحديثها.")
        return

    # التأكد من وجود المجلد
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    with open(BOOKS_FILE, "w", encoding="utf-8") as f:
        json.dump(books, f, ensure_ascii=False, indent=2)
    print(f"🚀 تم تحديث فهرس الكتب بنجاح! إجمالي الكتب: {len(books)}")

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
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "update":
        update_books_index()
    elif len(sys.argv) > 1 and sys.argv[1] == "validate":
        validate_data()
    else:
        update_books_index()
        validate_data()
