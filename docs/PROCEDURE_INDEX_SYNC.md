# مزامنة فهرس إجراءات الدعاوى

يحتوي `procedures-index.json` على معرّفات الإجراءات المنشورة وعناوينها فقط. أما التفاصيل القانونية فتبقى في مجموعة Firestore `legalProcedures`.

## إعداد مرة واحدة

1. في GitHub افتح **Settings → Secrets and variables → Actions**.
2. أضف Repository Secret باسم `FIREBASE_SERVICE_ACCOUNT_JSON`، واجعل قيمته JSON لحساب خدمة مخصص بصلاحية قراءة مجموعة `legalProcedures` فقط قدر الإمكان. لا تضع هذا المفتاح في ملفات JavaScript أو في المستودع.
3. معرّف المشروع الافتراضي هو `iraq-law-test`. يمكن تغييره بإضافة Repository Variable باسم `FIREBASE_PROJECT_ID` عند الحاجة.
4. افتح **Actions → Sync Published Procedure Titles → Run workflow** لتجربة أول مزامنة.

## سير العمل

تستعلم المهمة عن المستندات التي تحتوي `published == true`، ثم تكتب `id` و`title` فقط إلى `procedures-index.json`، وتدفع التغيير إلى `main` ثم تشغّل نشر الموقع. لا تُنسخ التفاصيل أو بيانات المستخدمين إلى GitHub.

بعد إضافة إجراء أو تعديل عنوانه أو تغيير حالة نشره أو حذفه، شغّل سير العمل يدوياً. الربط التلقائي الفوري من Firebase غير مفعّل حتى يُربط حدث موثوق من جهة الخادم مع `repository_dispatch`; لا تستخدم Personal Access Token داخل المتصفح لتجاوز هذا الشرط.

## قواعد Firestore

بعد تعديل `firestore.rules` في المستودع، انشر النسخة المعدّلة أيضاً من **Firebase Console → Firestore Database → Rules**. لا تعتبر قواعد GitHub منشورة في Firebase بمجرد حفظها في المستودع.
