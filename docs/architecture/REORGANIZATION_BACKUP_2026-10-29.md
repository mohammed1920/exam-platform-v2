# النسخة الاحتياطية والاستعادة — إعادة تنظيم 2026-10-29

> وثيقة تشغيلية تشرح نقطة الاستعادة الخاصة بإعادة التنظيم حسب الأقسام الوظيفية، وكيفية الرجوع إليها. نقطة الاستعادة المؤكدة هي Commit `043b6705558d9d00b772b07e440acd2a471c2d23`؛ لم يتم إنشاء أو رفع وسم Git ضمن هذه العملية.

## 1. نقطة الاستعادة

| البند | القيمة |
|---|---|
| الوسم | غير منشور؛ الاسم المقترح `backup/pre-reorganization-20261029` |
| الـCommit المشار إليه | `043b6705558d9d00b772b07e440acd2a471c2d23` |
| الفرع | `main` |
| تاريخ الإنشاء | 2026-10-29 |
| الرسالة | Backup before professional reorganization (pre-change state of main) |

يشير الـCommit `043b6705558d9d00b772b07e440acd2a471c2d23` إلى حالة `main` **قبل** أي نقل للملفات.

## 2. ماذا تتضمن النسخة

- كامل شجرة Git عند `043b670`: كل ملفات HTML وCSS وJS والبيانات `data/` وقواعد Firebase وإعدادات Vercel وسير عمل GitHub Actions والتوثيق.
- حالة ما قبل التنظيم: ملفات JS في `assets/js/` وCSS في `assets/css/` بشكل مسطّح.

لا تتضمن النسخة:

- بيانات Firestore الحيّة.
- إعدادات مشروع Vercel أو متغيّرات بيئته.
- أي أسرار أو مفاتيح خارج المستودع (لا توجد أسرار داخل المستودع أصلًا).
- نطاق `mizan-iraq.com` وسجلات DNS.
- إعدادات GitHub Pages/Secrets الخاصة بالمستودع.

## 3. سجل تغييرات التنظيم

| الـCommit | الوصف |
|---|---|
| `043b670` | الحالة الأصلية المحفوظة في الوسم الاحتياطي |
| `8fc9f21` | نقل الملفات إلى `assets/shared/` و`assets/features/<section>/` وتحديث المراجع |

## 4. حالة الرفع

- لم يتم إنشاء أو رفع الوسم إلى المستودع البعيد ضمن هذه العملية.
- يمكن إنشاء الوسم لاحقًا محليًا على نقطة الاستعادة المؤكدة ثم رفعه: `git tag -a backup/pre-reorganization-20261029 043b6705558d9d00b772b07e440acd2a471c2d23 -m "Backup before professional reorganization"` ثم `git push origin backup/pre-reorganization-20261029`.

## 5. استعادة الملفات البرمجية

### استعادة كاملة إلى ما قبل التنظيم

```bash
git fetch origin
git checkout main
git reset --hard 043b6705558d9d00b772b07e440acd2a471c2d23
```

### فحص ما تغيّر دون تعديل

```bash
git diff --stat backup/pre-reorganization-20261029..main
git diff backup/pre-reorganization-20261029..main -- index.html admin.html
```

### استعادة ملف واحد فقط

```bash
git checkout 043b6705558d9d00b772b07e440acd2a471c2d23 -- assets/css/mizan-colors.css
```

### تراجع جزئي عن آخر commit تنظيمي فقط

```bash
git revert 8fc9f2115d244186835208b78a21d2af5ce0b7ba
```

هذا الخيار مفضّل إذا كانت هناك تغييرات سليمة لاحقة يجب الحفاظ عليها.

### تحذيرات

- لا تستخدم `git reset --hard` إذا كانت هناك تغييرات غير محفوظة؛ ستفقدها.
- لا تحذف الوسم ولا تحرّكه.
- لا تستخدم استرجاعًا أعمى يمحو تغييرات سليمة أُجريت بعد النسخة.

## 6. الفرق بين استعادة Git واستعادة البيانات الخارجية

| النوع | يشملها Git | طريقة الاستعادة |
|---|---|---|
| ملفات HTML/CSS/JS | نعم | `git checkout` / `git revert` |
| بيانات JSON داخل `data/` | نعم | نفس أعلاه |
| قواعد `firestore.rules` و`storage.rules` | نعم (الملفات) | إعادة النشر عبر Firebase CLI بعد الاستعادة |
| محتوى Firestore الفعلي | لا | من نسخ Firebase الاحتياطية أو التصدير |
| إعدادات Vercel | لا | من لوحة Vercel |
| Secrets ومفاتيح GitHub | لا | من إعدادات المستودع |
| نطاق DNS وGitHub Pages | لا | من إعدادات المستودع والمزوّد |

استعادة Git لا تعيد تلقائيًا بيانات Firestore ولا إعدادات Vercel ولا أي سر خارج المستودع.

## 7. التحقق بعد الاستعادة

```bash
node scripts/validate-static-project.mjs
python3 validate_project.py
bash scripts/build-pages-bundle.sh /tmp/mizan-pages-bundle-restore
```

ثم تحقّق من حالة النشر في GitHub Actions وVercel، واختبر الصفحة الرئيسية والأقسام الأساسية. نجاح الفحوص الساكنة لا يثبت صحة الواجهة بصريًا.
