#!/usr/bin/env python3
"""أداة توافق قديمة.

تم إبقاء الملف حتى لا تنكسر أي عملية قديمة تستدعيه، لكن لم يعد يعيد بناء
chapters.json أو يعيد كتابة الأسئلة. الصيانة الفعلية موجودة في update_questions.py.
"""
from update_questions import main

if __name__ == "__main__":
    main()
