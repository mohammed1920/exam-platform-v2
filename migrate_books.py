#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
migrate_books.py
=================
سكريبت ترحيل نظيف من المستودعات القديمة (صيغة q/options/correct بملفات HTML)
إلى الصيغة الموحدة الحالية بمنصة exam-platform-v2 (question/options/answer/explanation).

طريقة الاستخدام:
    python3 migrate_books.py --repo-root /path/to/exam-platform-v2

اشتراطات:
    - Python 3.8+ (لا يحتاج أي مكتبات خارجية غير مكتبة requests)
    - إذا لم تكن مثبتة: pip install requests --break-system-packages
    - اتصال إنترنت (يقرأ مباشرة من GitHub)

ماذا يفعل:
    1. يجيب قائمة ملفات كل مستودع قديم عبر GitHub API.
    2. يفلتر ملفات الفصول (chN.html بأي حالة أحرف).
    3. يرتبها برقمها الأصلي تصاعديًا، ثم يعيد ترقيمها تسلسليًا 1..N (بلا فجوات).
    4. يحوّل كل سؤال من {q, options, correct} إلى {id, question, options, answer, explanation}.
    5. يكتب ملفات data/{book_id}/chapter_N.json الجديدة (يستبدل القديمة المكررة).
    6. يحدّث data/books.json بعدد الفصول الصحيح لكل كتاب.
    7. يطبع تقرير شامل في النهاية.

⚠️ ملاحظة: هذا السكريبت "يستبدل" كل الكتب السبعة المدرجة بـ REPO_TO_BOOK بمستودع exam-platform-v2،
   ولا يلمس المستودعات القديمة نفسها إطلاقًا (قراءة فقط منها).
"""

import argparse
import json
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path

# ---------------------------------------------------------------------------
# الربط بين كل مستودع قديم والكتاب المقابل له بموقعك الحالي
# ---------------------------------------------------------------------------
REPO_TO_BOOK = {
    "law-test": "law_constitutional",
    "law-administrative": "law_administrative",
    "Law---International": "law_international",
    "Law-General-penalties": "law_general_penalties",
    "Law---Special---sanctions": "law_special_sanctions",
    "Law-International-Humanitarian": "law_international_humanitarian",
    "Law-Organizations": "law_organizations",
}

GITHUB_USER = "mohammed1920"
CHAPTER_FILE_RE = re.compile(r'^[Cc]h0*(\d+)\.html$')
DEFAULT_EXPLANATION = "لا يوجد شرح متوفر حالياً."


def list_repo_files(repo):
    """يجيب قائمة أسماء الملفات بجذر المستودع عبر GitHub API."""
    url = f"https://api.github.com/repos/{GITHUB_USER}/{repo}/contents/"
    req = urllib.request.Request(url, headers={"User-Agent": "exam-platform-migration-script"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return [item["name"] for item in data if item["type"] == "file"]


def fetch_raw(repo, filename):
    """يجيب المحتوى الخام لملف من المستودع (عبر raw.githubusercontent.com)."""
    for branch in ("main", "master"):
        url = f"https://raw.githubusercontent.com/{GITHUB_USER}/{repo}/{branch}/{filename}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "exam-platform-migration-script"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                continue
            raise
    raise RuntimeError(f"تعذّر جلب {filename} من {repo} (main أو master)")


def parse_questions_from_html(html_text):
    """
    يستخرج مصفوفة الأسئلة من نص HTML القديم (const questions/allQuestions = [...];)
    ويحوّلها من صيغة JS (مفاتيح بلا علامات اقتباس) إلى JSON صالح.

    ملاحظة: المستودعات القديمة تستخدم عدة اختلافات حسب متى أُنشئ الملف:
      - اسم المتغير: questions أو allQuestions (أو أي اسم ينتهي بـ Questions)
      - المفاتيح: {q, options, correct}  أو  {q, opts, ans}
      - تعليقات JS داخل المصفوفة: سطرية (// ...) أو كتلة (/* ... */)
    الدالة تتعرف تلقائيًا على كل هذي الاختلافات وتوحّدها.
    """
    match = re.search(r'const\s+\w*[Qq]uestions\s*=\s*(\[.*?\])\s*;', html_text, re.DOTALL)
    if not match:
        raise ValueError("لم يتم العثور على مصفوفة الأسئلة (const ...questions = [...]) بالملف")

    raw_array = match.group(1)

    # 0) إزالة تعليقات JS: كتلة (/* ... */)، ثم أي تعليق // (سواء بسطر مستقل أو بنهاية سطر كود)
    raw_array = re.sub(r'/\*.*?\*/', '', raw_array, flags=re.DOTALL)
    raw_array = re.sub(r'//[^\n]*', '', raw_array)

    # 1) وضع علامات اقتباس حول أي من المفاتيح المحتملة بالصيغتين
    json_text = re.sub(r'\b(q|options|opts|correct|ans)\s*:', r'"\1":', raw_array)

    # 2) إزالة أي فاصلة زائدة قبل إغلاق قوس أو قائمة (شائع بملفات JS القديمة)
    json_text = re.sub(r',(\s*[\]}])', r'\1', json_text)

    raw_questions = json.loads(json_text)

    # 3) توحيد الصيغتين إلى شكل واحد: {q, options, correct}
    normalized = []
    for item in raw_questions:
        options = item.get("options", item.get("opts", []))
        correct = item.get("correct", item.get("ans", 0))
        normalized.append({
            "q": item.get("q", ""),
            "options": options,
            "correct": correct,
        })
    return normalized


def natural_chapter_files(files):
    """يفلتر ملفات الفصول ويرجعها كقائمة (رقم_أصلي, اسم_الملف) مرتبة تصاعديًا."""
    chapters = []
    for f in files:
        m = CHAPTER_FILE_RE.match(f)
        if m:
            chapters.append((int(m.group(1)), f))
    chapters.sort(key=lambda x: x[0])
    return chapters


def migrate_book(repo, book_id, book_title, data_dir, report):
    print(f"\n📘 {book_title} ({book_id}) ← {repo}")
    try:
        files = list_repo_files(repo)
    except Exception as e:
        report["errors"].append(f"{book_id}: فشل جلب قائمة الملفات ({e})")
        print(f"   ❌ فشل جلب قائمة الملفات: {e}")
        return

    chapters = natural_chapter_files(files)
    if not chapters:
        report["errors"].append(f"{book_id}: لم يتم العثور على أي ملف فصول بالمستودع")
        print("   ❌ لم يتم العثور على أي ملف فصول (chN.html)")
        return

    print(f"   وجدت {len(chapters)} ملف فصل بالمصدر: "
          + ", ".join(f"{name}" for _, name in chapters))

    book_dir = data_dir / book_id
    book_dir.mkdir(parents=True, exist_ok=True)

    # حذف ملفات الفصول القديمة (المكررة/الفاسدة) قبل كتابة الجديدة
    removed = 0
    for old_file in book_dir.glob("chapter_*.json"):
        old_file.unlink()
        removed += 1
    if removed:
        print(f"   🗑️  حُذف {removed} ملف فصل قديم بهذا الكتاب")

    total_questions = 0
    new_chapter_num = 0
    skipped = []

    for original_num, filename in chapters:
        new_chapter_num += 1
        try:
            html_text = fetch_raw(repo, filename)
            questions_raw = parse_questions_from_html(html_text)
        except Exception as e:
            skipped.append((filename, str(e)))
            new_chapter_num -= 1  # لا نستهلك رقم فصل لملف فشل
            continue

        questions = []
        for i, q in enumerate(questions_raw, start=1):
            questions.append({
                "id": i,
                "question": q.get("q", ""),
                "options": q.get("options", []),
                "answer": q.get("correct", 0),
                "explanation": DEFAULT_EXPLANATION,
            })

        chapter_obj = {
            "id": f"{book_id}_ch{new_chapter_num}",
            "book_id": book_id,
            "chapter": new_chapter_num,
            "title": f"الفصل {new_chapter_num}",
            "description": f"أسئلة الفصل {new_chapter_num} من {book_title}",
            "questions": questions,
        }

        out_path = book_dir / f"chapter_{new_chapter_num}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(chapter_obj, f, ensure_ascii=False, indent=2)

        total_questions += len(questions)
        print(f"   ✅ {filename} (رقم أصلي {original_num}) → chapter_{new_chapter_num}.json "
              f"({len(questions)} سؤال)")

    if skipped:
        print(f"   ⚠️  تم تجاوز {len(skipped)} ملف بسبب خطأ بالتحويل:")
        for fname, err in skipped:
            print(f"      - {fname}: {err}")
        report["errors"].extend([f"{book_id}/{fname}: {err}" for fname, err in skipped])

    report["books"][book_id] = {
        "chapters": new_chapter_num,
        "questions": total_questions,
        "skipped_files": len(skipped),
    }
    print(f"   📊 الإجمالي: {new_chapter_num} فصل، {total_questions} سؤال")


def update_books_json(data_dir, report):
    books_file = data_dir / "books.json"
    if not books_file.exists():
        print(f"\n⚠️  لم يتم العثور على {books_file}، تخطي تحديث books.json")
        return

    with open(books_file, "r", encoding="utf-8") as f:
        books = json.load(f)

    for book in books:
        bid = book.get("id")
        if bid in report["books"]:
            book["chapters"] = report["books"][bid]["chapters"]

    with open(books_file, "w", encoding="utf-8") as f:
        json.dump(books, f, ensure_ascii=False, indent=2)

    print(f"\n✅ تم تحديث {books_file}")


def main():
    parser = argparse.ArgumentParser(description="ترحيل نظيف لبيانات الأسئلة من المستودعات القديمة")
    parser.add_argument("--repo-root", required=True,
                         help="المسار المحلي لمجلد مشروع exam-platform-v2 (يحتوي على مجلد data/)")
    parser.add_argument("--only", nargs="*", default=None,
                         help="ترحيل كتب محددة فقط (بمعرّفات book_id)، مثال: --only law_general_penalties")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    data_dir = repo_root / "data"
    if not data_dir.is_dir():
        print(f"❌ لم يتم العثور على مجلد data/ داخل {repo_root}")
        sys.exit(1)

    books_file = data_dir / "books.json"
    book_titles = {}
    if books_file.exists():
        with open(books_file, "r", encoding="utf-8") as f:
            for b in json.load(f):
                book_titles[b["id"]] = b.get("title", b["id"])

    report = {"books": {}, "errors": []}

    targets = args.only if args.only else list(REPO_TO_BOOK.values())

    for repo, book_id in REPO_TO_BOOK.items():
        if book_id not in targets:
            continue
        book_title = book_titles.get(book_id, book_id)
        migrate_book(repo, book_id, book_title, data_dir, report)

    update_books_json(data_dir, report)

    # ---------------- التقرير النهائي ----------------
    print("\n" + "=" * 60)
    print("📋 التقرير النهائي")
    print("=" * 60)
    for book_id, info in report["books"].items():
        print(f"  {book_id}: {info['chapters']} فصل، {info['questions']} سؤال"
              + (f"  (⚠️ {info['skipped_files']} ملف متجاوَز)" if info["skipped_files"] else ""))

    if report["errors"]:
        print("\n⚠️  أخطاء صودفت أثناء الترحيل:")
        for err in report["errors"]:
            print(f"  - {err}")
    else:
        print("\n✅ لا أخطاء — الترحيل تم بنجاح لكل الكتب المستهدفة.")

    print("\nالخطوة التالية: راجع الملفات بمجلد data/ محليًا، ثم ارفعها (git push أو رفع يدوي) لمستودع exam-platform-v2.")


if __name__ == "__main__":
    main()
