#!/usr/bin/env python3
"""
خادم إدارة لوحة التحكم - معالج عمليات CRUD على ملفات JSON
يعمل على المنفذ 8000 ويدعم الطلبات من الواجهة الأمامية
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json
import os
from pathlib import Path
import shutil
from datetime import datetime
import subprocess

app = FastAPI(title="Admin API - Exam Platform")

# إضافة CORS للسماح بالطلبات من الموقع المحلي
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# المسارات الأساسية
DATA_DIR = Path(__file__).parent / "data"
BOOKS_FILE = DATA_DIR / "books.json"

# نماذج البيانات
class Question(BaseModel):
    question: str
    options: List[str]
    answer: int
    explanation: Optional[str] = None
    # حقول إضافية لدعم التوافق المؤقت أثناء الاستلام
    q: Optional[str] = None
    opts: Optional[List[str]] = None
    ans: Optional[int] = None

class Chapter(BaseModel):
    id: str
    book_id: str
    chapter: int
    title: str
    questions: List[Question] = []

class Book(BaseModel):
    id: str
    title: str
    author: Optional[str] = None
    chapters: int

# ============ عمليات الكتب ============

@app.post("/api/books/add")
async def add_book(book: Book):
    """إضافة كتاب جديد"""
    try:
        # قراءة الفهرس الحالي
        books = load_books()
        
        # التحقق من عدم وجود كتاب بنفس المعرف
        if any(b["id"] == book.id for b in books):
            raise HTTPException(status_code=400, detail="الكتاب موجود بالفعل")
        
        # إنشاء مجلد الكتاب
        book_dir = DATA_DIR / book.id
        book_dir.mkdir(exist_ok=True)
        
        # إضافة الكتاب للفهرس
        books.append({
            "id": book.id,
            "title": book.title,
            "author": book.author or "",
            "chapters": book.chapters
        })
        
        # حفظ الفهرس
        save_books(books)
        
        # إنشاء ملف chapters.json فارغ
        chapters_file = book_dir / "chapters.json"
        with open(chapters_file, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False, indent=2)
        
        return {"success": True, "message": f"تم إضافة الكتاب '{book.title}' بنجاح"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/books")
async def get_books():
    """الحصول على قائمة الكتب"""
    try:
        books = load_books()
        return {"success": True, "books": books}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/books/{book_id}")
async def delete_book(book_id: str):
    """حذف كتاب"""
    try:
        books = load_books()
        books = [b for b in books if b["id"] != book_id]
        save_books(books)
        
        # حذف مجلد الكتاب
        book_dir = DATA_DIR / book_id
        if book_dir.exists():
            shutil.rmtree(book_dir)
        
        return {"success": True, "message": "تم حذف الكتاب بنجاح"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ عمليات الفصول ============

@app.post("/api/chapters/add")
async def add_chapter(book_id: str, title: str):
    """إضافة فصل جديد"""
    try:
        book_dir = DATA_DIR / book_id
        if not book_dir.exists():
            raise HTTPException(status_code=404, detail="الكتاب غير موجود")
        
        # قراءة الفصول الحالية
        chapters_file = book_dir / "chapters.json"
        chapters = []
        if chapters_file.exists():
            with open(chapters_file, "r", encoding="utf-8") as f:
                chapters = json.load(f)
        
        # إضافة الفصل الجديد
        chapter_num = len(chapters) + 1
        new_chapter = {
            "id": f"{book_id}_ch{chapter_num}",
            "book_id": book_id,
            "chapter": chapter_num,
            "title": title,
            "questions": []
        }
        chapters.append(new_chapter)
        
        # حفظ الفصول
        with open(chapters_file, "w", encoding="utf-8") as f:
            json.dump(chapters, f, ensure_ascii=False, indent=2)
        
        # إنشاء ملف الفصل الفردي
        chapter_file = book_dir / f"chapter_{chapter_num}.json"
        with open(chapter_file, "w", encoding="utf-8") as f:
            json.dump(new_chapter, f, ensure_ascii=False, indent=2)
        
        # تحديث الفهرس الرئيسي
        books = load_books()
        for book in books:
            if book["id"] == book_id:
                book["chapters"] = chapter_num
        save_books(books)
        
        return {"success": True, "message": f"تم إضافة الفصل '{title}' بنجاح"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chapters/{book_id}")
async def get_chapters(book_id: str):
    """الحصول على فصول كتاب"""
    try:
        book_dir = DATA_DIR / book_id
        chapters_file = book_dir / "chapters.json"
        
        if not chapters_file.exists():
            return {"success": True, "chapters": []}
        
        with open(chapters_file, "r", encoding="utf-8") as f:
            chapters = json.load(f)
        
        return {"success": True, "chapters": chapters}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/chapters/{book_id}/{chapter_id}")
async def update_chapter(book_id: str, chapter_id: int, title: str):
    """تعديل اسم الفصل"""
    try:
        book_dir = DATA_DIR / book_id
        chapters_file = book_dir / "chapters.json"
        
        with open(chapters_file, "r", encoding="utf-8") as f:
            chapters = json.load(f)
        
        if chapter_id < 0 or chapter_id >= len(chapters):
            raise HTTPException(status_code=404, detail="الفصل غير موجود")
        
        chapters[chapter_id]["title"] = title
        
        with open(chapters_file, "w", encoding="utf-8") as f:
            json.dump(chapters, f, ensure_ascii=False, indent=2)
        
        # تحديث ملف الفصل الفردي
        chapter_file = book_dir / f"chapter_{chapter_id + 1}.json"
        if chapter_file.exists():
            with open(chapter_file, "r", encoding="utf-8") as f:
                chapter_data = json.load(f)
            chapter_data["title"] = title
            with open(chapter_file, "w", encoding="utf-8") as f:
                json.dump(chapter_data, f, ensure_ascii=False, indent=2)
        
        return {"success": True, "message": "تم تحديث الفصل بنجاح"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/chapters/{book_id}/{chapter_id}")
async def delete_chapter(book_id: str, chapter_id: int):
    """حذف فصل"""
    try:
        book_dir = DATA_DIR / book_id
        chapters_file = book_dir / "chapters.json"
        
        with open(chapters_file, "r", encoding="utf-8") as f:
            chapters = json.load(f)
        
        if chapter_id < 0 or chapter_id >= len(chapters):
            raise HTTPException(status_code=404, detail="الفصل غير موجود")
        
        chapters.pop(chapter_id)
        
        with open(chapters_file, "w", encoding="utf-8") as f:
            json.dump(chapters, f, ensure_ascii=False, indent=2)
        
        # حذف ملف الفصل الفردي
        chapter_file = book_dir / f"chapter_{chapter_id + 1}.json"
        if chapter_file.exists():
            chapter_file.unlink()
        
        return {"success": True, "message": "تم حذف الفصل بنجاح"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ عمليات الأسئلة ============

@app.post("/api/questions/add")
async def add_question(book_id: str, chapter_id: int, question: Question):
    """إضافة سؤال جديد"""
    try:
        book_dir = DATA_DIR / book_id
        chapter_file = book_dir / f"chapter_{chapter_id + 1}.json"
        
        if not chapter_file.exists():
            raise HTTPException(status_code=404, detail="الفصل غير موجود")
        
        with open(chapter_file, "r", encoding="utf-8") as f:
            chapter_data = json.load(f)
        
        # إضافة السؤال
        question_dict = {
            "question": question.question or question.q,
            "options": question.options or question.opts,
            "answer": question.answer if question.answer is not None else question.ans,
            "explanation": question.explanation or ""
        }
        chapter_data["questions"].append(question_dict)
        
        # حفظ الفصل
        with open(chapter_file, "w", encoding="utf-8") as f:
            json.dump(chapter_data, f, ensure_ascii=False, indent=2)
        
        return {"success": True, "message": "تم إضافة السؤال بنجاح"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/questions/{book_id}/{chapter_id}/{question_id}")
async def update_question(book_id: str, chapter_id: int, question_id: int, question: Question):
    """تعديل سؤال"""
    try:
        book_dir = DATA_DIR / book_id
        chapter_file = book_dir / f"chapter_{chapter_id + 1}.json"
        
        if not chapter_file.exists():
            raise HTTPException(status_code=404, detail="الفصل غير موجود")
        
        with open(chapter_file, "r", encoding="utf-8") as f:
            chapter_data = json.load(f)
        
        if question_id < 0 or question_id >= len(chapter_data["questions"]):
            raise HTTPException(status_code=404, detail="السؤال غير موجود")
        
        # دعم الحقول المختلفة لضمان التوافق مع استخدام الحقل المعتمد فقط
        q_text = question.question or question.q
        opts = question.options or question.opts
        ans = question.answer if question.answer is not None else question.ans
        
        chapter_data["questions"][question_id] = {
            "question": q_text,
            "options": opts,
            "answer": ans,
            "explanation": question.explanation or ""
        }
        
        with open(chapter_file, "w", encoding="utf-8") as f:
            json.dump(chapter_data, f, ensure_ascii=False, indent=2)
        
        return {"success": True, "message": "تم تحديث السؤال بنجاح"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/chapters/update_full/{book_id}/{chapter_num}")
async def update_chapter_full(book_id: str, chapter_num: int, chapter_data: Chapter):
    """تحديث الفصل كاملاً (يستخدم للحفظ الجماعي)"""
    try:
        book_dir = DATA_DIR / book_id
        chapter_file = book_dir / f"chapter_{chapter_num}.json"
        
        # تحويل البيانات إلى قاموس مع التأكد من صيغة الأسئلة (استخدام الحقل answer حصراً)
        final_questions = []
        for q in chapter_data.questions:
            final_questions.append({
                "question": q.question or q.q,
                "options": q.options or q.opts,
                "answer": q.answer if q.answer is not None else q.ans,
                "explanation": q.explanation or ""
            })
        
        full_data = {
            "id": chapter_data.id,
            "book_id": chapter_data.book_id,
            "chapter": chapter_data.chapter,
            "title": chapter_data.title,
            "questions": final_questions
        }
        
        with open(chapter_file, "w", encoding="utf-8") as f:
            json.dump(full_data, f, ensure_ascii=False, indent=2)
            
        return {"success": True, "message": "تم تحديث الفصل كاملاً بنجاح"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/questions/{book_id}/{chapter_id}/{question_id}")
async def delete_question(book_id: str, chapter_id: int, question_id: int):
    """حذف سؤال"""
    try:
        book_dir = DATA_DIR / book_id
        chapter_file = book_dir / f"chapter_{chapter_id + 1}.json"
        
        if not chapter_file.exists():
            raise HTTPException(status_code=404, detail="الفصل غير موجود")
        
        with open(chapter_file, "r", encoding="utf-8") as f:
            chapter_data = json.load(f)
        
        if question_id < 0 or question_id >= len(chapter_data["questions"]):
            raise HTTPException(status_code=404, detail="السؤال غير موجود")
        
        chapter_data["questions"].pop(question_id)
        
        with open(chapter_file, "w", encoding="utf-8") as f:
            json.dump(chapter_data, f, ensure_ascii=False, indent=2)
        
        return {"success": True, "message": "تم حذف السؤال بنجاح"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============ دوال مساعدة ============

def load_books():
    """قراءة ملف الفهرس الرئيسي"""
    if BOOKS_FILE.exists():
        with open(BOOKS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_books(books):
    """حفظ ملف الفهرس الرئيسي"""
    with open(BOOKS_FILE, "w", encoding="utf-8") as f:
        json.dump(books, f, ensure_ascii=False, indent=2)

@app.post("/api/sync-github")
async def sync_github():
    """مزامنة التغييرات مع GitHub"""
    try:
        # 1. إضافة جميع التغييرات
        subprocess.run(["git", "add", "."], check=True, cwd=Path(__file__).parent)
        
        # 2. عمل commit
        commit_message = f"تحديث تلقائي من لوحة التحكم: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}"
        subprocess.run(["git", "commit", "-m", commit_message], check=True, cwd=Path(__file__).parent)
        
        # 3. سحب التغييرات من GitHub (rebase) قبل الدفع
        subprocess.run(["git", "pull", "--rebase", "origin", "main"], check=True, cwd=Path(__file__).parent)
        
        # 4. دفع التغييرات إلى GitHub
        subprocess.run(["git", "push", "origin", "main"], check=True, cwd=Path(__file__).parent)
        
        return {"success": True, "message": "تمت المزامنة مع GitHub بنجاح!"}
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"خطأ في أمر Git: {e.stderr.decode()}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    """فحص صحة الخادم"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
