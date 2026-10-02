# PROJECT MEMORY — ميزان

> ملف مرجعي سريع للحالة الحالية للمشروع. يُحدَّث عند حدوث تغيير هيكلي أو حذف/إضافة ملفات أو تغيير معماري مهم.
> آخر تحديث: 2026-10-02

## الهوية
- اسم المنصة: **ميزان**
- العبارة: **«ميزان.. حيث يُقاس الفهم القانوني بدقة.»**
- المستودع: `mohammed1920/exam-platform-v2`
- الفرع الأساسي: `main`
- التصميم: كحلي داكن + ذهبي معدني، مع وضعي الليل والنهار.
- المنصة موجهة للتعلم والاختبارات القانونية، مع واجهة mobile-first.

## بنية البيانات الحالية
- قائمة الكتب الرئيسية: `data/books.json`
- أسئلة الكتب: `data/<book>/chapter_N.json`
- ملفات `chapters.json` القديمة حُذفت.
- هوية السؤال: `uid` أساسية و`id` كبديل/هوية موجودة تاريخياً.
- يجب عدم تغيير `uid` أو `id` الموجود عند تعديل السؤال.
- تحميل البيانات يتم عند الحاجة، وليس تحميل كامل بنك الأسئلة دفعة واحدة.
- البحث يستخدم فهرساً مولداً: `data/search-index.json`.

## المصادقة والإدارة
- Firebase Auth/Firestore مستخدمان لحسابات الطلاب وصلاحيات الإدارة.
- صلاحية الإدارة تعتمد على سجل admin مع `role == admin` و`enabled != false`.
- لوحة الإدارة منفصلة عن واجهة الطالب.
- إدارة دليل المحامين تشمل المراجعة والموافقة والرفض والتعديل والحذف والتعطيل وإعادة التفعيل.
- رفع وثائق الهوية للمحامين غير مستخدم حالياً بسبب قيود Firebase Storage في الخطة الحالية.

## الواجهة الحالية
- الصفحة الرئيسية تستخدم صورة الهوية الموحدة:
  `assets/branding/mizan-header.svg`
- تم التخلي عن Lottie للهوية الرئيسية.
- شريط الهيدر وأيقونة تبديل الثيم وأقسام المنصة مرتبطة بالتصميم الحالي في `index.html` و`style.css` و`platform-header-fix.js`.
- قسم العرائض في `petitions.js` و`petitions.css`.
- منبر ميزان في `mizan-pulpit.js` و`mizan-pulpit.css`.
- التنقل الرئيسي في `platform-sidebar.js`.
- البحث في `global-search.js`.
- محرك الاختبارات في `engine/examEngine.js`.

## سلوك الاختبارات
- حفظ إجابات الطالب يعتمد على `questionUid` ثم `questionId`، وليس نص السؤال.
- الاختبار المؤقت للأسئلة الخاطئة يستخدم `wrong-answers-retest.js` ولا يُفترض أن يحفظ نتيجة إعادة الاختبار المؤقتة في Firestore.
- `wrong-answers-limit.js` يحد القائمة المحلية للأسئلة الخاطئة إلى 100.
- الحسابات وتسجيل الخروج والعودة للرئيسية مرتبطة بـ `student-account-patch.js`.

## الأداء
- الأولوية لتحميل المحتوى المطلوب فقط.
- لا يُستخدم GitHub API في كل عملية بحث عن سؤال.
- الاختبار العشوائي يطلب من الطالب اختيار الكتاب/الكتب وعدد الأسئلة ثم يجلب المطلوب.

## آخر تنظيف منفذ
1. حذف `student-ui-fixes.js` لأنه كان يكرر منطق الحساب الموجود في `student-account-patch.js`.
2. حذف مرجع `student-ui-fixes.js` من `index.html`.
3. الإبقاء على `student-ui-fixes.css` حالياً لأنه يحتوي أنماطاً مستخدمة في الحساب والإدارة والنوافذ.
4. حذف `mizan-brand.js` لأنه لم يعد مستخدماً.
5. حذف تحميل مكتبة Lottie من `index.html`.
6. حذف أنماط الهوية القديمة الخاصة بـ `.mizan-logo-animation` و`.mizan-brand-copy`.
7. حذف ملف Lottie القديم `assets/branding/mizan-logo.json`.
8. الهوية الحالية تعتمد على SVG الثابت، وليس Lottie.

## قاعدة إلزامية قبل حذف أي ملف — 2026-10-02
**ممنوع حذف أي ملف اعتماداً على عدم وجود مرجع مباشر فقط.**
قبل حذف أي ملف يجب فحص:
1. وظيفته الفعلية وماذا يضيف للمشروع.
2. جميع مراجع التشغيل المباشرة وغير المباشرة.
3. مسار تشغيله: من يستدعيه، ومتى، وتحت أي صفحة/حدث/شرط.
4. هل يتم تحميله أو استدعاؤه ديناميكياً حتى لو لم يظهر كـ `script src` أو `import`.
5. اعتمادات الملفات الأخرى عليه، بما فيها globals والأحداث وFirebase وHTML/CSS.
6. هل يوفر وظائف إدارية أو وظائف تظهر فقط بعد تفاعل/صلاحية معينة.
7. بعد الفحص، يجب التأكد أن وظيفته غير مطلوبة أو أنها انتقلت فعلياً إلى بديل تم التحقق منه.
8. عند الشك، **لا يُحذف الملف**؛ يبقى حتى يتم التحقق.

**حالة تحذيرية مهمة:** `mizan-pulpit-admin.js` تم حذفه سابقاً بالخطأ لأنه بدا غير مستخدم، ثم اتضح أنه يوفر كامل وظائف إدارة مساهمي ومشاركات منبر ميزان وتمت استعادته. هذه الحالة تؤكد أن المرجع المباشر وحده لا يكفي للحكم على الملف.

## ملفات يجب عدم حذفها أثناء التنظيف إلا بعد التحقق
- `platform-header-fix.js`
- `student-account-patch.js`
- `wrong-answers-limit.js`
- `wrong-answers-retest.js`
- `firebase-auth.js`
- `firebase-admin-panel.js`
- `mizan-pulpit-admin.js`
- `petitions.js`
- `mizan-pulpit.js`

هذه الملفات ما زالت مرتبطة بسلوك حالي أو بوظائف حديثة، ويجب فحص استخدامها قبل دمجها أو حذفها.

## الأتمتة
- `update_questions.py` لإصلاح هويات الأسئلة وتحديث بيانات الكتب.
- `validate_project.py` للفحص البنيوي.
- `integrity_check.py` لتقرير سلامة البيانات.
- `scripts/build-search-index.js` لبناء فهرس البحث.
- GitHub Actions موجودة للصيانة، تحديث metadata، بناء فهرس البحث، والنشر.

## ملاحظة صيانة
عند كل تغيير هيكلي كبير، يجب تحديث هذا الملف وإضافة ما تغيّر، خصوصاً:
- الملفات المحذوفة أو المضافة.
- مصدر البيانات أو طريقة التحميل.
- منطق المصادقة والصلاحيات.
- طريقة البحث أو الاختبارات.
- أي تغيير في الهيدر/الهوية/التنقل.

## آخر تحسين أداء — 2026-10-02
- `home.js` لم يعد يحمّل Firebase Storage وملفات دليل المحامين عند فتح الصفحة الرئيسية؛ يتم تحميل الدليل عند طلب المستخدم للقسم فقط.
- `app.js` لم يعد يحاول حذف Cache Storage أو إلغاء Service Workers عند كل تشغيل؛ أزيل منطق تنظيف الـOffline القديم لأنه كان تنظيفاً قسرياً وليس استراتيجية تحديث صحيحة.
- `index.html` لم يعد يسجّل Service Worker جديداً؛ بدلاً من ذلك يلغي تسجيل النسخ القديمة الموجودة على أجهزة المستخدمين لأن المنصة الحالية لا تعتمد على Offline Cache.
- تمت مزامنة أرقام version لملفات الواجهة التي تغيرت مؤخراً: `app.js`, `home.js`, `petitions.js`, `mizan-pulpit.js`, و`mizan-pulpit-admin.js`، لتقليل احتمال تقديم نسخة قديمة من المتصفح بعد النشر.
- `loadContactInfo()` في `app.js` أصبح تحميله غير حاجب لبدء المنصة، حتى لا تتأخر تهيئة الواجهة بسبب `contact.json`.
- أضيف version query إلى `engine/examEngine.js` في `index.html` لتقليل احتمال بقاء نسخة قديمة من ملف المحرك بعد النشر.
- `service-worker.js` حُذف نهائياً؛ لم تعد المنصة تعتمد على Service Worker أو Offline Cache، وتم تحديث workflow النشر حتى لا يحاول نسخه.

## Mizan Pulpit admin restoration — 2026-10-02
- Investigated disappearance of the Mizan Pulpit admin options.
- Root cause: `mizan-pulpit-admin.js` had been incorrectly classified as unused and deleted in commit `ee44eb8c9501b8fef95809fd20b8844d163168f3`.
- The deleted module is operational: it creates the `منبر ميزان` admin card and management view, including contributor approval requests, approved/blocked contributors, pending/published/rejected/hidden articles, direct publishing, editing, rejection reasons, hide/republish/delete, and contributor public-profile sync.
- Restored the exact working module from its parent commit and re-added it to `index.html` after `firebase-admin-panel.js`.
- Restore commits: `c04a1de7f1a1ea809c53d686a60880ffb088b170` and `01c2908f813a8f67484fbf337d5d1177fb5a4a10`.
- Do not delete `mizan-pulpit-admin.js` again unless its functionality is first migrated into another verified module.

## Leaderboard lazy loading — 2026-10-02
- تم فحص مسار تشغيل `leaderboard.js` قبل التغيير: يعتمد على `window.app.books` و`publicAuth` وFirestore، ويُستدعى من مسار لوحة الطالب/الشريط الجانبي، كما يستمع إلى `firestore-exam-result-saved` لمزامنة نتائج الطالب.
- لم يتم حذف الملف أو وظيفته.
- تم نقل تحميل `leaderboard.js` و`leaderboard.css` من التحميل الأولي في `index.html` إلى تحميل كسول عند فتح قسم المتصدرين فقط.
- `user-dashboard.js` أصبح مسؤولاً عن تحميل الوحدة عند الحاجة ثم تشغيل `window.studentLeaderboard.render()`، مع معالجة فشل التحميل.
- الإصلاحات: `026da13dbde7965f8a04bbb771125d690595c050` و`02f985ad063f6b0507fad010fe0837867ddd11a4`.

## Mizan Pulpit lazy loading — 2026-10-02
- تم فحص `mizan-pulpit.js` قبل التغيير: الملف مسؤول عن تحميل المقالات المنشورة، فتح المقال، بروفايل المساهم، طلب/تعديل بيانات المساهم، وإرسال المقالات، ويرتبط مباشرة بعناصر HTML في قسم المنبر.
- لم يتم حذف الملف أو وظائفه.
- تم نقل تحميل `mizan-pulpit.js` و`mizan-pulpit.css` من التحميل الأولي إلى التحميل عند فتح «منبر ميزان» فقط.
- `home.js` يوفر `loadMizanPulpit()` ويستخدمه فتح القسم، و`platform-sidebar.js` يستخدم نفس المسار عند فتح المنبر من الشريط الجانبي.
- الإصلاحات: `6a1c9bdaee42c519f12f03fa0f4269f7ce719c18`، `571a465719b9e21ad1960582eabe7e1fffd26a5d`، `7e7e5dcd4a967373d289b829124de8e81896cc22`.

## Navigation audit fixes — 2026-10-02
- تم تدقيق أزرار القائمة الجانبية والصفحة الرئيسية والفوتر قبل التعديل، ولم يتم حذف أي ملف.
- تبين أن «عن المنصة» و«المساعدة» في القائمة الجانبية لم يكونا مربوطين فعلياً؛ تم ربطهما مباشرة بـ about وfaq.
- تبين أيضاً أن «عرائض وطلبات» و«دليل المحامين» من القائمة الجانبية كانا يحاولان الفتح قبل تشغيل محمل الوحدة الكسول؛ تم توحيد المسار مع محمل home.js حتى يتم تحميل الوحدة أولاً ثم فتحها.
- أضيفت window.loadPetitions وwindow.loadLawyerDirectory كواجهات تحميل مشتركة، مع Promises لمعالجة التحميل المتزامن وفشل الشبكة.
- تم رفع إصدارات الأصول في index.html: home.js?v=1.3 وplatform-sidebar.js?v=1.1.
- التعديلات البرمجية: 52b398e7fcf314081e1679f9f682c5d0d049e885، df02924324c38d7dd1eddd240da7c1988cfdfb43، 401cd9537be1287a7d4d2ee7db6cf5ade0d680ff.
- الأقسام التي لا تملك صفحات فعلية حتى الآن — «اختبارات المعهد القضائي»، «القوانين العراقية»، «إجراءات الدعاوى» — بقيت دون ربط وهمي، وتحتاج بناء صفحاتها قبل تحويلها إلى تنقل فعلي.


## Mizan Pulpit modal scoping fix — 2026-10-02
- Verified `mizan-pulpit.js` before changing anything: contributor registration/edit uses `mizan-contributor-modal`; article submission uses `mizan-submit-modal`; contributor profile uses `mizan-contributor-profile-modal`.
- Root cause of the contributor/join and submission forms appearing outside the Mizan Pulpit screen: the three Mizan modal elements were siblings of `mizan-pulpit-section`, so they were not scoped to the section controlled by `.view-section.active`.
- Moved all three modal containers inside `#mizan-pulpit-section`. No functions or files were deleted.
- This preserves the existing flow: unauthenticated users are sent to login; unapproved contributors are shown the join form/status message; approved contributors get the submission form; contributor editing continues to use the same modal.
- Commit: `701d98d9abd247d52ec67bf4891652e062a9be5d` — `fix: scope Mizan Pulpit modals to their section`.


## Mizan contributor profile over article view — 2026-10-02
- Inspected the article/profile flow in `mizan-pulpit.js` before changing it.
- Root cause: `mizan-contributor-profile-modal` had been moved inside `#mizan-pulpit-section` during modal scoping. When an article is opened, `app.navigateTo('mizan-article')` hides the Pulpit section, so the profile modal was rendered inside a hidden parent and appeared only after leaving the article.
- Fix: keep the contributor profile modal outside all `.view-section` containers while retaining `.mizan-modal` closed-by-default behavior. This allows it to open above both the Pulpit list and the standalone article view without reintroducing the previous form visibility issue.
- No functions or files were deleted.
- Commit: `13928be18bef9067ed439b4c4eaf4ab14e820fac` — `fix: keep Mizan contributor profile above article view`.
