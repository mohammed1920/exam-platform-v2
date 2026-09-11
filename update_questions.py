#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""صيانة آمنة لفهرس الكتب وهوية الأسئلة.

المبدأ الأساسي:
- books.json هو مصدر الحقيقة لقائمة الكتب؛ لا نحذف كتابًا لأن مجلده أو فصوله ناقصة.
- التحديث الآلي يعدّل عداد chapters فقط، ويضيف معرّفات مفقودة للأسئلة/الفصول بشكل آمن.
- لا نعدّل نص السؤال أو الخيارات أو الإجابة أو الشرح تلقائيًا.
- لا نستخدم أسماء مجلدات ثابتة مثل law_ كشرط لظهور الكتاب.
"""
import hashlib
import json
import os
import re
from pathlib import Path

DATA_DIR = Path("data")
BOOKS_FILE = DATA_DIR / "books.json"
BOOK_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
CHAPTER_RE = re.compile(r"^chapter_(\d+)\.json$")


def stable_uid(book_id: str, chapter_num: int, index: int, legacy_id) -> str:
    """معرّف ثابت وفريد للسؤال، يُنشأ مرة واحدة ولا يتغير عند تعديل النص."""
    seed = f"{book_id}\x00{chapter_num}\x00{legacy_id!s}\x00{index}"
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:20]
    return f"q_{digest}"


def load_json(path: Path, default):
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def dump_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def chapter_numbers(book_id: str):
    book_dir = DATA_DIR / book_id
    if not book_dir.is_dir():
        return []
    nums = []
    for p in book_dir.iterdir():
        m = CHAPTER_RE.match(p.name)
        if m and p.is_file():
            nums.append(int(m.group(1)))
    return sorted(set(nums))


def ensure_question_identity(chapter_data: dict, book_id: str, chapter_num: int) -> bool:
    """إضافة id/uid المفقودين فقط. لا نلمس أي محتوى تحريري."""
    modified = False
    if not chapter_data.get("id"):
        chapter_data["id"] = f"{book_id}_ch{chapter_num}"
        modified = True

    questions = chapter_data.get("questions")
    if not isinstance(questions, list):
        return modified

    used_uids = set()
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            continue

        # id القديم يُحفظ كما هو. إذا كان مفقودًا ننشئه مرة واحدة.
        if q.get("id") in (None, ""):
            q["id"] = f"{book_id}_ch{chapter_num}_q{i + 1}"
            modified = True

        uid = q.get("uid")
        if not uid:
            # uid المفقود فقط هو الذي يُنشأ. لا نغيّر uid موجودًا حتى لو كان مكررًا؛
            # validator سيوقف النشر ليتم حل التعارض يدويًا بدل تغيير هوية سؤال قائم.
            q["uid"] = stable_uid(book_id, chapter_num, i, q.get("id"))
            modified = True
        used_uids.add(q["uid"])

    return modified


def update_books_index():
    """يحافظ على كل الكتب الموجودة ويحدّث chapters فقط من الملفات الفعلية."""
    books = load_json(BOOKS_FILE, [])
    if not isinstance(books, list):
        raise RuntimeError("data/books.json يجب أن يكون مصفوفة JSON.")

    changed = False
    seen = set()
    for book in books:
        if not isinstance(book, dict) or not book.get("id"):
            continue
        book_id = str(book["id"])
        if book_id in seen:
            raise RuntimeError(f"معرف كتاب مكرر في books.json: {book_id}")
        seen.add(book_id)

        nums = chapter_numbers(book_id)
        new_count = max(nums, default=0)
        if book.get("chapters") != new_count:
            book["chapters"] = new_count
            changed = True

    if changed:
        dump_json(BOOKS_FILE, books)
    print(f"📚 books.json محفوظ: {len(books)} كتاب، لا حذف تلقائي للكتب.")
    return changed


def validate_and_repair_question_identity():
    """إصلاح الهوية فقط للأسئلة/الفصول التي ينقصها id أو uid."""
    changed_files = []
    for book_dir in sorted(DATA_DIR.iterdir() if DATA_DIR.exists() else []):
        if not book_dir.is_dir() or book_dir.name.startswith("."):
            continue
        for chapter_path in sorted(book_dir.glob("chapter_*.json")):
            m = CHAPTER_RE.match(chapter_path.name)
            if not m:
                continue
            chapter_num = int(m.group(1))
            data = load_json(chapter_path, None)
            if not isinstance(data, dict):
                print(f"⚠️ ملف غير صالح أو غير مدعوم: {chapter_path}")
                continue
            if ensure_question_identity(data, book_dir.name, chapter_num):
                dump_json(chapter_path, data)
                changed_files.append(str(chapter_path))

    print(f"🆔 تم إصلاح هوية {len(changed_files)} ملف فصل عند الحاجة فقط.")
    return changed_files


def main():
    if not DATA_DIR.exists():
        raise SystemExit("❌ مجلد data غير موجود")
    # ترتيب التنفيذ مهم: نصلح الهوية فقط، ثم نحدّث العداد من الكتب الموجودة.
    validate_and_repair_question_identity()
    update_books_index()


if __name__ == "__main__":
    main()
