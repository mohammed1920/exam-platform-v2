# خريطة اعتماديات JavaScript — منصة ميزان

> هذه الخريطة توثّق ترتيب التحميل الفعلي في `index.html` بعد مطابقة القائمة مع مراجع `script src` الحالية بتاريخ 2026-10-29. هي أداة مراجعة ساكنة وليست بديلًا عن اختبار السلوك داخل المتصفح.

## قواعد لا يجوز كسرها أثناء التنظيم

- لا تغيّر ترتيب السكربتات دون تتبّع الاعتماديات المباشرة وغير المباشرة.
- لا تحذف ملفًا لمجرد صغر حجمه أو غموض اسمه؛ افحص مستمعي الأحداث والتحميل الديناميكي والمراجع عبر `window.*`.
- عند نقل دالة، حافظ على الواجهة العامة أو حدّث جميع المستهلكين في التغيير نفسه.
- ملفات الأسئلة `data/**/chapter_N.json` تُحمّل عند الحاجة؛ لا تحوّلها إلى تحميل شامل.
- حافظ على معرّفات الأسئلة `uid` و`id` وتوافق النتائج والمسودات القديمة.
- لا تعدّل تصميم الكتب ثلاثي الأبعاد ضمن أعمال تنظيم الواجهة.
- لا تعتبر تكرار المحددات في CSS كودًا ميتًا قبل مقارنة ترتيب التحميل، ونطاقات `@media`، ونتيجة الـ cascade.

## ترتيب تحميل JavaScript في `index.html`

1. مكتبات Firebase App Compat وFirebase Auth Compat الخارجية.
2. `assets/shared/js/firebase-auth.js` — يهيّئ المصادقة العامة `window.publicAuth`.
3. `engine/examEngine.js` — يوفّر محرك الاختبارات `window.examEngine`.
4. `assets/shared/js/book-icons.js` — أيقونات الكتب.
5. `assets/shared/js/contact-info.js` — تحميل بيانات الاتصال ورسم البطاقات عبر `window.MizanContactInfo`.
6. `assets/features/exams/js/exam-drafts.js` — قراءة/كتابة/ترحيل مسودات الاختبارات عبر `window.MizanExamDrafts`.
7. `assets/features/exams/js/question-sharing.js` — الروابط المباشرة وبطاقات المشاركة عبر `window.MizanQuestionSharing`.
8. `assets/features/forum/js/mizan-pulpit.js` — واجهة منبر ميزان العامة؛ يسبق التطبيق الرئيسي في ترتيب التحميل.
9. `assets/shared/js/app.js` — التطبيق الرئيسي `window.app` وواجهات التفويض للوحدات المفصولة.
10. `assets/shared/js/global-search.js` — البحث العام، يعتمد على المصادقة والتطبيق.
11. `assets/features/home/js/home.js` — تحميل الأقسام وإضافات الصفحة الرئيسية.
12. `assets/shared/js/platform-sidebar.js` — التنقل وفتح الأقسام.
13. `assets/features/procedures/js/procedures.js` — واجهة إجراءات الدعاوى.
14. `assets/features/student-account/js/user-dashboard.js` — لوحة الطالب `window.studentDashboard`.
15. `assets/features/student-account/js/student-account-patch.js` — تكييف واجهة الحساب مع أحداث المصادقة.
16. `assets/features/exams/js/wrong-answers-limit.js` ثم `assets/features/exams/js/wrong-answers-retest.js` — سلوك مراجعة الإجابات الخاطئة وإعادة الاختبار.
17. `assets/shared/js/platform-header-fix.js` — تركيب شعار Lottie؛ قواعد CSS موجودة في `platform-header.css`.
18. `assets/shared/js/theme.js` — `window.platformTheme`.
19. `assets/features/admin/js/firebase-admin-panel.js` — واجهات الإدارة المعتمدة على Firebase.
20. `assets/features/forum/js/mizan-pulpit-admin.js` — إدارة منبر ميزان.
21. `assets/shared/js/platform-bootstrap.js` — سلوك التهيئة النهائي.
22. `assets/features/notifications/js/notifications.js` — تهيئة/عرض الإشعارات، محمّل بعد بقية وحدات الصفحة.

## وحدات تم فصلها مع إبقاء واجهات التوافق

| الوحدة | المسؤولية | عقد التوافق |
|---|---|---|
| `assets/shared/js/contact-info.js` | جلب بيانات الاتصال وعرض البطاقات داخليًا | `window.MizanContactInfo.load()`؛ لا تُصدَّر دالة الرسم كواجهة عامة |
| `assets/features/exams/js/exam-drafts.js` | قراءة/كتابة/حفظ/مسح/تلخيص/حذف المسودات وترحيل المفتاح القديم داخليًا | `window.MizanExamDrafts` يصدّر عمليات المسودات المستخدمة فقط؛ دوال المفاتيح داخلية |
| `assets/features/exams/js/question-sharing.js` | إنشاء رابط السؤال وبطاقة المشاركة | `window.MizanQuestionSharing.shareQuestion()`؛ أدوات الرسم والرابط المساعدة داخلية |
| `assets/features/admin/js/admin.js` | منطق لوحة الإدارة المنفصل عن HTML | يُحمّل من `admin.html` |
| `assets/features/admin/js/admin-theme.js` | سلوك ثيم لوحة الإدارة | منفصل عن منطق الإدارة |
| `admin.css` | تنسيقات لوحة الإدارة | يُحمّل من `admin.html` |
| `platform-header.css` | تنسيقات الهيدر | لا تُعاد إلى ملف JavaScript |
| `assets/shared/js/platform-bootstrap.js` | تهيئة الصفحة في نهاية التحميل | يُحمّل أخيرًا في `index.html` |

## CSS: ترتيب التحميل ونقاط الحذر

- `mizan-colors.css`: مصدر ألوان الهوية.
- `mizan-design-tokens.css`: رموز التصميم المشتركة، ومنها الحواف والحركة.
- `style.css`: ملف الواجهة الأساسي ويحتوي أيضًا على تصميم الكتب ثلاثية الأبعاد؛ لا تنظّف قواعد الكتب ضمن توحيد الألوان.
- `student-ui-fixes.css` و`home.css` و`platform-sidebar.css` و`user-dashboard.css` و`student-sidebar.css`: قواعد متخصصة قد تتراكب عمدًا.
- `theme.css` و`mizan-unified-theme.css`: يحمّلان بعد القواعد الأساسية، ولذلك قد تكون بعض المحددات المتكررة overrides مقصودة.
- `platform-header.css`: قواعد الهيدر المنفصلة.
- داخل `index.html` توجد قواعد داخلية خاصة بمكوّنات الاختبار والبحث؛ لا تنقلها أو تحذفها إلا بعد فحص ترتيبها وتأثيرها.
- لا تحذف محددًا مكررًا لمجرد تطابق النص؛ قارن السياق ونطاقات الشاشات وترتيب التحميل أولًا.

## التحقق الحالي وحدوده

- `scripts/validate-static-project.mjs` يفحص سلامة JSON، ومراجع الملفات المحلية في HTML وCSS، وروابط `src`/`href` الثابتة في JavaScript، وتعريفات ومراجع رموز التصميم `--mizan-*`.
- `.github/workflows/validate-project.yml` يشغّل الفحص الساكن و`node --check` لملفات `.js` و`.mjs`.
- نجاح الفحص الساكن لا يثبت صحة Firebase أو تسجيل الدخول أو الاختبارات أو البحث أو الصلاحيات أو التصميم في كل أحجام الشاشات؛ يجب اختبار هذه المسارات فعليًا قبل الدمج والنشر.

## خطة الإكمال

1. تدقيق الاستدعاءات العامة والأحداث قبل نقل أي وحدة أخرى.
2. مقارنة تداخل CSS حسب ترتيب التحميل ونقاط التوقف، مع إبقاء الشكل الحالي.
3. تشغيل الفحوصات على آخر commit، ثم فحص وظائف الموقع على المعاينة.
4. توثيق أي اختبار لم يتسنّ تنفيذه بدل الادعاء باكتماله.
5. جميع التعديلات الجديدة تُنفّذ مباشرة على `main` فقط؛ لا تنشئ فروعًا جديدة ولا تستخدم Pull Requests كمسار بديل. لا تدّعِ نجاح فحص لم يُنفذ.
