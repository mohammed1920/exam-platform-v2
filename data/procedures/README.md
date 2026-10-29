# بيانات إجراءات الدعاوى

هذا المجلد مخصص لملفات إجراءات الدعاوى المنظمة حسب نوع الدعوى. كل مجلد فرعي يحتوي ملف `sample.json` تجريبياً لعرض شكل البيانات وتجربة ترتيبها داخل واجهة ميزان.

## الهيكل

- `civil/sample.json` — الدعاوى المدنية.
- `criminal/sample.json` — الدعاوى الجزائية.
- `administrative/sample.json` — الدعاوى الإدارية.
- `personal/sample.json` — دعاوى الأحوال الشخصية.

## بنية ملف الإجراء

كل ملف JSON يحتوي حقولاً موحدة مثل `id` و`title` و`category` و`categoryTitle` و`summary` و`requirements` و`documents` و`steps` و`legalBasis` و`fees` و`duration`.

النماذج الحالية تجريبية بحتة، وموسومة بالحقل `isDemo: true`، ولا تُعد إرشاداً قانونياً أو مرجعاً للمواعيد أو الرسوم. الإجراءات المنشورة الفعلية تبقى في Firebase ضمن `legalProcedures`، ويظل فهرسها في `publicIndexes/procedures`، مع بقاء التحقق من صلاحية الوصول كما هو.
