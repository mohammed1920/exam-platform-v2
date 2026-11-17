# خريطة اعتماديات JavaScript — منصة ميزان

> هذه الخريطة تطابق ملفات `main` بعد توحيد محرك الثيم واعتماد `admin-loader.js` والتحميل الكسول للأقسام. هي مرجع ساكن، وليست بديلاً عن اختبار المتصفح.

## قواعد لا يجوز كسرها

- لا تغيّر ترتيب السكربتات دون تتبّع الاعتماديات المباشرة وغير المباشرة وواجهات `window.*`.
- لا تحذف ملفاً قبل فحص مراجع HTML والتحميل الديناميكي والواجهات العامة.
- ملفات الأسئلة `data/**/chapter_N.json` تُحمّل عند الحاجة فقط؛ يحافظ محرك الاختبار على ذاكرة LRU محدودة.
- حافظ على معرّفات الأسئلة `uid` و`id` وتوافق النتائج والمسودات.
- لا تعدّل تصميم الكتب ثلاثي الأبعاد في `book-icons.js` وقواعدها في `style.css`.
- لا تنشئ نظام ألوان موازياً؛ مصادر التصميم المعتمدة هي `mizan-colors.css` و`mizan-design-tokens.css` و`mizan-unified-theme.css`.

## ترتيب JavaScript الثابت في `index.html`

1. Firebase App Compat v10.12.5.
2. Firebase Auth Compat v10.12.5.
3. `assets/shared/js/firebase-auth.js` — المصادقة العامة `window.publicAuth`.
4. `engine/examEngine.js` — محرك الاختبارات.
5. `assets/shared/js/book-icons.js` — أيقونات الكتب ثلاثية الأبعاد.
6. `assets/shared/js/contact-info.js` — معلومات التواصل.
7. `assets/features/exams/js/exam-drafts.js` — مسودات الاختبارات.
8. `assets/features/exams/js/question-sharing.js` — مشاركة الأسئلة.
9. `assets/features/forum/js/mizan-pulpit.js` — واجهة منبر ميزان العامة.
10. `assets/shared/js/app.js` — التطبيق والتنقل.
11. `assets/shared/js/global-search.js` — البحث العام.
12. `assets/features/home/js/home.js` — إجراءات الصفحة وتحميل الأقسام عند الحاجة.
13. `assets/shared/js/mizan-card-actions.js` — إجراءات بطاقات الصفحة.
14. `assets/features/judicial-institute/js/judicial-institute.js` — قسم المعهد القضائي.
15. `assets/shared/js/platform-sidebar.js` — التنقل الجانبي.
16. `assets/features/procedures/js/procedures.js` — إجراءات الدعاوى.
17. `assets/features/student-account/js/user-dashboard.js` — لوحة الطالب.
18. `assets/features/student-account/js/student-account-patch.js` — تكييف واجهة الحساب.
19. `assets/features/exams/js/wrong-answers-limit.js` — حدود مراجعة الإجابات الخاطئة.
20. `assets/features/exams/js/wrong-answers-retest.js` — إعادة اختبار الإجابات الخاطئة.
21. `assets/shared/js/platform-header-fix.js` — تركيب شعار الهيدر باستخدام Lottie.
22. `assets/shared/js/theme.js` — محرك الثيم المركزي للوضعين العام والإداري.
23. `assets/features/admin/js/admin-loader.js` — يتحقق من صلاحية المشرف قبل تحميل لوحة الإدارة.
24. `assets/shared/js/platform-bootstrap.js` — تهيئة PWA وسلوك التحديث والتثبيت.
25. `assets/features/notifications/js/notifications.js` — الإشعارات.

## التحميل الديناميكي

- `assets/features/admin/js/firebase-admin-panel.js`: يُحمّل بواسطة `admin-loader.js` بعد تحقق Firebase من صلاحية الحساب. لا تحمّله للزائر أو المستخدم غير المشرف.
- `assets/features/laws/js/laws.js`: يُحمّل عند فتح قسم القوانين عبر `window.loadMizanLaws`.
- `assets/features/lawyers/js/lawyer-directory.js`: يُحمّل عند فتح دليل المحامين عبر `window.loadLawyerDirectory`، وقد يحمّل Firebase Storage Compat كاعتماد منفصل.
- `assets/features/petitions/js/petitions.js`: يُحمّل عند فتح قسم العرائض عبر `window.loadPetitions`.
- ملفات الإدارة الخاصة بالمنبر دُمجت في `firebase-admin-panel.js`؛ لا يوجد اعتماد على `mizan-pulpit-admin.js`.

## الثيم والإدارة

- `assets/shared/js/theme.js` هو محرك تبديل الوضع الليلي/النهاري، ويخدم `#theme-toggle` و`#admin-theme-toggle`.
- يبقى `data-admin-theme` متاحاً لتوافق تنسيقات لوحة الإدارة.
- `assets/features/admin/js/admin.js` و`admin.css` يخصان لوحة إدارة الكتب والفصول والأسئلة في `admin.html)، وهي منفصلة عن لوحة Firebase التنفيذية.
- لا يوجد `assets/features/admin/js/admin-theme.js`؛ لا تعِد إنشاءه أو الإشارة إليه.

## CSS: ترتيب التحميل ونقاط الحذر

- `index.html` يبدأ بملف تنسيقات المنبر، ثم ملفات الألوان ورموز التصميم، ثم `style.css`، ثم تنسيقات الصفحة والأقسام، ثم `mizan-unified-theme.css`، ثم تنسيقات الإشعارات.
- `admin.html` يستخدم ملفات الألوان ورموز التصميم والثيم الموحد المشتركة، ثم `admin.css`.
- `style.css` يحتوي تصميم الكتب ثلاثية الأبعاد؛ لا تنقل أو تحذف قواعد الكتب أثناء توحيد الثيم.
- لا تغيّر ترتيب CSS أو تحذف محددات متداخلة دون مقارنة العرض في الوضعين وعلى أحجام الشاشات.

## البناء والتخزين المؤقت

- `scripts/build-pages-bundle.sh` يبني حزمة النشر الثابتة لـ GitHub Pages وVercel.
- `scripts/build-precache-manifest.mjs` ينشئ قائمة التخزين المسبق من الأصول المشار إليها في `index.html` واعتماديات CSS المحلية فقط؛ لا يضم وحدات الأقسام المحمّلة كسولاً أو أصول الإدارة.
- `service-worker.js` يستخدم `MIZAN_BUILD_ID` لتمييز كاش الأصول بين الإصدارات، ويحتفظ بكاش فهرس الكتب والمكتبة القانونية المستقلين.
- ملفات الأسئلة والبيانات الشخصية وبيانات الإدارة لا تدخل في كاش التخزين المسبق.

## التحقق وحدوده

- `scripts/validate-static-project.mjs` يفحص JSON والمراجع المحلية وملفات HTML/CSS/JavaScript ورموز التصميم.
- `node --check` يفحص صياغة ملفات JavaScript وMJS، لكنه لا يثبت صحة تشغيل المتصفح أو Firebase أو قواعد الصلاحيات.
- يجب توثيق اختبارات المتصفح التي لم تُنفّذ، وعدم الادعاء بنجاحها.
- جميع التعديلات الجديدة تُنفّذ مباشرة على `main` فقط، دون فروع أو Pull Requests.
