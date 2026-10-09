# PROJECT MEMORY — ميزان

> ملف مرجعي سريع للحالة الحالية للمشروع. يُحدَّث عند حدوث تغيير هيكلي أو حذف/إضافة ملفات أو تغيير معماري مهم.
> آخر تحديث: 2026-10-09

## حالة التنظيف المعماري — 2026-10-09

- فرع الإنتاج `main` محفوظ دون تعديل؛ أعمال التنظيم تجري على `refactor/architecture-foundation` ضمن PR رقم 3 (مسودة).
- تم فصل وحدات التواصل ومسودات الاختبارات ومشاركة الأسئلة عن التطبيق الرئيسي، وأزيلت واجهات تمرير داخلية ثبت عدم وجود مستهلكين لها داخل المستودع.
- `DEVELOPMENT.md` هو دليل الصيانة الوحيد؛ أزيل ملف `DEVELOPER_GUIDE.md` المكرر.
- الفحص الساكن يتحقق من JSON والأصول المحلية في HTML/CSS وروابط الأصول الثابتة في JavaScript، ويشمل فحص الصياغة ملفات `.js` و`.mjs`.
- آخر فحص GitHub Actions للمراجعة اجتاز التحقق الساكن وصياغة JavaScript. هذا لا يغني عن اختبار المتصفح للهاتف والحاسوب والوضعين.
- لم يُدمج الفرع ولم يُنفذ نشر إنتاجي. لا تعتبر المعاينة أو سلوك PWA معتمدين حتى يُعاد اختبارهُما عمليًا.

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
- الصفحة الرئيسية تستخدم شعار Lottie الموحد:
  `assets/branding/meezan-assemble.json`
- لا توجد أصول SVG أو PNG قديمة للهوية الرئيسية؛ الشعار المتحرك هو المصدر الوحيد لهيدر المنصة.
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
8. استبدال الهوية القديمة بشعار Lottie المرفق `assets/branding/meezan-assemble.json`.
9. حذف أصول SVG وPNG القديمة ومراجعها من الهيدر وmanifest ووسوم المشاركة الاجتماعية.
10. حذف `auto_sync_data.py` بعد فحص وظيفته ومسار تشغيله؛ كان مجرد wrapper توافق قديم يستدعي `update_questions.py`، ولم يعد هناك workflow أو مسار تشغيل حالي يحتاجه.
11. حذف `split_chapters.py` بعد فحص وظيفته؛ كان أداة ترحيل قديمة لتحويل `chapters.json` إلى `chapter_N.json`، بينما بنية المشروع الحالية تعتمد فقط على ملفات `chapter_N.json` ولا توجد ملفات `chapters.json` في البيانات الحالية.
- commits التنظيف الأخير: `b99ec057db8d7168bd440028ead75b1564548d7e` و`e3a07e43349b8c998600f9367daf9695c3861c55`.

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
- `qa_audit.py` لتدقيق جودة الأسئلة عبر AI دون تعديل الأسئلة.
- `spellcheck_ai.py` للفحص الإملائي الدوري عبر AI دون تعديل الأسئلة.
- `scripts/build-search-index.js` لبناء فهرس البحث.
- `scripts/generate-question-metadata.mjs` لتوليد بيانات أعداد الأسئلة والفصول.
- GitHub Actions موجودة للصيانة، تحديث metadata، بناء فهرس البحث، التدقيق الإملائي/الجودة، والنشر.

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
- تم استعادة `mizan-pulpit-admin.js` بعد التحقق من أنه يوفر وظائف إدارة مساهمي ومشاركات منبر ميزان.
- commits الاستعادة: `c04a1de7f1a1ea809c53d686a60880ffb088b170` و`01c2908f813a8f67484fbf337d5d1177fb5a4a10`.
- لا يُحذف مجدداً إلا بعد نقل وظائفه فعلياً إلى بديل تم التحقق منه.

## Leaderboard lazy loading — 2026-10-02
- تم فحص مسار تشغيل `leaderboard.js` قبل التغيير، ولم يتم حذف الملف أو وظيفته.
- تم نقل تحميل `leaderboard.js` و`leaderboard.css` إلى التحميل عند فتح قسم المتصدرين فقط.
- `user-dashboard.js` يحمل الوحدة عند الحاجة ثم يشغّل `window.studentLeaderboard.render()`.
- الإصلاحات: `026da13dbde7965f8a04bbb771125d690595c050` و`02f985ad063f6b0507fad010fe0837867ddd11a4`.

## Mizan Pulpit lazy loading — 2026-10-02
- تم فحص `mizan-pulpit.js` قبل التغيير: الملف مسؤول عن المقالات المنشورة، المقال، بروفايل المساهم، طلب/تعديل المساهم، وإرسال المقالات.
- تم نقل تحميل `mizan-pulpit.js` و`mizan-pulpit.css` إلى التحميل عند فتح المنبر فقط.
- `home.js` يوفر `loadMizanPulpit()` و`platform-sidebar.js` يستخدم نفس المسار.
- الإصلاحات: `6a1c9bdaee42c519f12f03fa0f4269f7ce719c18`، `571a465719b9e21ad1960582eabe7e1fffd26a5d`، `7e7e5dcd4a967373d289b829124de8e81896cc22`.

## Navigation audit fixes — 2026-10-02
- تم تدقيق أزرار القائمة الجانبية والصفحة الرئيسية والفوتر قبل التعديل، ولم يتم حذف أي ملف.
- تم ربط «عن المنصة» بـ `about` و«المساعدة» بـ `faq`.
- تم توحيد فتح «عرائض وطلبات» و«دليل المحامين» مع الـlazy loaders في `home.js`.
- الأقسام التي لا تملك صفحات فعلية حتى الآن — «اختبارات المعهد القضائي»، «القوانين العراقية»، «إجراءات الدعاوى» — بقيت دون ربط وهمي.
- التعديلات: `52b398e7fcf314081e1679f9f682c5d0d049e885`، `df02924324c38d7dd1eddd240da7c1988cfdfb43`، `401cd9537be1287a7d4d2ee7db6cf5ade0d680ff`.

## Mizan Pulpit modal scoping fix — 2026-10-02
- تم نقل نماذج الانضمام/التعديل والإرسال داخل قسم منبر ميزان حتى لا تظهر خارج القسم.
- commit: `701d98d9abd247d52ec67bf4891652e062a9be5d`.

## Mizan contributor profile over article view — 2026-10-02
- السبب كان أن نافذة بروفايل المساهم أصبحت داخل قسم المنبر المخفي عند فتح المقال.
- تم إبقاء `mizan-contributor-profile-modal` خارج جميع `.view-section` حتى تظهر فوق المقال.
- commit: `13928be18bef9067ed439b4c4eaf4ab14e820fac`.

## Cleanup audit — 2026-10-02
- تم تدقيق أدوات الصيانة القديمة قبل الحذف، وليس اعتماداً على غياب `script src` فقط.
- `auto_sync_data.py` كان wrapper توافقياً قديماً يستدعي `update_questions.py` فقط، ولم يعد مستخدماً في GitHub Actions أو مسار تشغيل المنصة؛ حُذف.
- `split_chapters.py` كان أداة ترحيل لمرة واحدة لتحويل `chapters.json` إلى `chapter_N.json`، ولم تعد هناك ملفات `chapters.json` في شجرة البيانات الحالية؛ حُذف.
- تم الإبقاء على أدوات الصيانة الفعلية المستخدمة حالياً مثل `update_questions.py`, `validate_project.py`, `integrity_check.py`, `qa_audit.py`, و`spellcheck_ai.py`.
- تم الإبقاء على `platform-header-fix.js` و`student-ui-fixes.css` لأنهما مرتبطان بالواجهة الحالية، ولم يتم حذفهما.
- commits الحذف: `b99ec057db8d7168bd440028ead75b1564548d7e` و`e3a07e43349b8c998600f9367daf9695c3861c55`.


## CSS cleanup audit — 2026-10-02
- After runtime inspection of the current petitions renderer, obsolete petition-only selectors were removed from `petitions.css`: legacy lawyer-brand/brand-mark/meta/logo/title/template-logo rules that are no longer generated by `petitions.js`.
- Removed an exact duplicated contributor-profile style block from `mizan-pulpit.css`; active profile/article styles remain intact.
- Commits: `c2280f4b2c6ed7ce92954426ae50234a2677bf20` (petitions CSS), `b10357d24b9866c8e1d23f91381acc514fb42ee1` (Mizan Pulpit CSS).
- No JS files were deleted. `style.css` was not pruned mechanically because its historical book-layout generations and shared selectors require broader runtime tracing before removal.


## CSS audit correction — 2026-10-02
- A proposed `style.css` cleanup was tested against repository-wide runtime references and found unsafe: legacy-looking selectors such as `search-container`, `exam-box`, `exam-stats-bar`, `option-btn`, `results-box`, `review-item`, and `footer-links` are still referenced by the current HTML/JS.
- The cleanup commit `fa2480c5d91aa182cb5732f2421a71160d6b00f6` was therefore reverted by restoring `style.css` exactly from its verified parent state, commit `0b8ac0cda8a7c6248235db1dd40f8cf57cdc3f9b`.
- Restoration commit: `920b70e01eebd5514f0fec03aa52d8f80db11c06`.
- Rule reinforced: CSS cleanup must verify references in HTML/JS before removal; repository search alone is not sufficient when the search backend does not index CSS/runtime-generated references consistently.


## تمييز إلزامي: لوحة التاج vs admin.html — 2026-10-02
- **firebase-admin-panel.js** = لوحة التاج 👑 الخاصة بإدارة المستخدمين داخل المنصة: الطلاب، النتائج، المحامين، المساهمين والوظائف الإدارية المرتبطة بـ Firebase/Firestore. هذه هي اللوحة التي تظهر للمستخدم الإداري عبر أيقونة التاج في واجهة المنصة.
- **admin.html** = لوحة إدارة المحتوى، مخصصة لإدارة الكتب والفصول والأسئلة والبيانات والمحتوى عبر نظام إدارة المحتوى الحالي (ومن ضمنه GitHub API/token عند الحاجة).
- الملفان **نظامان منفصلان تماماً** ولا يجوز اعتبار أحدهما بديلاً عن الآخر.
- عند طلب تعديل **لوحة التاج** يجب العمل على `firebase-admin-panel.js` ومسار التنقل/الملفات المرتبطة بها فقط، وعدم تحويل الطلب إلى `admin.html`.
- عند طلب تعديل **إدارة الكتب/الفصول/الأسئلة/المحتوى** يجب استخدام `admin.html` وملفاته المرتبطة، وعدم نقل الوظائف إلى لوحة التاج.
- **قاعدة تنقل لوحة التاج الحالية:** إذا كان المستخدم في **الصفحة الرئيسية** وضغط التاج، تبقى لوحة التاج ظاهرة داخل الصفحة الرئيسية كما هو حالها الحالي. أما إذا كان المستخدم داخل **أي قسم آخر** وضغط التاج، فيجب فتح لوحة التاج كقسم/صفحة مستقلة عبر نظام التنقل، بحيث لا يُعرض محتواها أسفل القسم المفتوح أو بداخله. لا يعني ذلك إنشاء نظام إدارة ثالث أو صفحة Firebase Admin جديدة.
- **ممنوع الخلط بين النظامين عند أي تعديل مستقبلي.** قبل تنفيذ أي طلب إداري، يجب تحديد هل المقصود `firebase-admin-panel.js` (التاج) أم `admin.html` (إدارة المحتوى).
