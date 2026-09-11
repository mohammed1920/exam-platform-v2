#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""تحقق آلي سريع يمنع نشر بيانات مكسورة.
لا يحاول إصلاح المحتوى القانوني؛ يوقف النشر فقط عند أخطاء بنيوية قاتلة.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent
DATA = ROOT / 'data'
CH_RE = re.compile(r'^chapter_(\d+)\.json$')
errors = []


def load(p):
    try:
        return json.loads(p.read_text(encoding='utf-8'))
    except Exception as e:
        errors.append(f'{p}: JSON غير صالح: {e}')
        return None

books = load(DATA / 'books.json')
if not isinstance(books, list):
    errors.append('data/books.json يجب أن يكون مصفوفة.')
    books = []

book_ids = [b.get('id') for b in books if isinstance(b, dict)]
if len(book_ids) != len(set(book_ids)):
    errors.append('يوجد معرف كتاب مكرر.')

uids = set()
for b in books:
    if not isinstance(b, dict) or not b.get('id'):
        errors.append('يوجد عنصر كتاب بدون id.')
        continue
    book_id = b['id']
    book_dir = DATA / book_id
    nums = []
    for p in sorted(book_dir.glob('chapter_*.json')) if book_dir.is_dir() else []:
        m = CH_RE.match(p.name)
        if not m:
            continue
        num = int(m.group(1)); nums.append(num)
        d = load(p)
        if not isinstance(d, dict):
            continue
        qs = d.get('questions', [])
        if not isinstance(qs, list):
            errors.append(f'{p}: questions ليست مصفوفة.')
            continue
        for i, q in enumerate(qs, 1):
            if not isinstance(q, dict):
                errors.append(f'{p}: السؤال {i} ليس كائنًا.')
                continue
            if not q.get('id') or not q.get('uid'):
                errors.append(f'{p}: السؤال {i} يفتقد id/uid.')
            uid = q.get('uid')
            if uid in uids:
                errors.append(f'{p}: uid مكرر: {uid}')
            uids.add(uid)
            opts = q.get('options', [])
            ans = q.get('answer')
            if not isinstance(opts, list) or not isinstance(ans, int) or ans < 0 or ans >= len(opts):
                errors.append(f'{p}: السؤال {i} لديه answer/options غير صالحين.')
    actual = max(nums, default=0)
    if int(b.get('chapters') or 0) != actual:
        errors.append(f'{book_id}: chapters={b.get("chapters")} بينما الموجود={actual}.')

if errors:
    print('❌ فشل التحقق البنيوي:')
    for e in errors[:100]: print(' -', e)
    if len(errors) > 100: print(f'... و{len(errors)-100} أخطاء أخرى')
    sys.exit(1)

print(f'✅ التحقق البنيوي ناجح: {len(books)} كتب، {len(uids)} سؤالًا بمعرفات ثابتة.')
