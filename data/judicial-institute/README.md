# أرشيف المعهد القضائي — هيكل الملفات

تعتمد المنصة ملفاً مستقلاً لكل مادة داخل مجلد سنة الامتحان.

## المسارات

`questions/{YEAR}/{SUBJECT_ID}.json`

مثال:
- `questions/2005/personal-status.json`
- `questions/2005/civil-law.json`
- `questions/2005/civil-procedure.json`
- `questions/2006/personal-status.json`

لا تنشئ ملفاً لمادة لا توجد لها أسئلة فعلية في تلك السنة.

## صيغة ملف المادة والسنة

```json
{
  "schemaVersion": 1,
  "year": 2005,
  "subjectId": "personal-status",
  "subjectName": "قانون الأحوال الشخصية",
  "questions": [
    {
      "uid": "JI-2005-PERSONAL-STATUS-001",
      "id": 1,
      "questionNumber": "س1",
      "question": "نص السؤال كما ورد في المصدر دون إعادة صياغة",
      "parts": [
        { "label": "أ", "text": "نص الفرع إن وجد" }
      ],
      "options": [],
      "answer": null,
      "legalReferences": [],
      "source": {
        "examId": "JI-2005",
        "examName": "امتحان المعهد القضائي لعام 2005",
        "fileName": "judicial-institute-2005.pdf",
        "pages": [1]
      },
      "verification": {
        "textVerified": false,
        "sourceVerified": false,
        "notes": ""
      }
    }
  ]
}
```

## قواعد المعرفات

- UID ثابت وفريد: `JI-{YEAR}-{SUBJECT-CODE}-{NNN}`.
- رموز المواد: `CRIMINAL-LAW`, `PERSONAL-STATUS`, `CIVIL-LAW`, `JUVENILE-LAW`, `CIVIL-PROCEDURE`, `CRIMINAL-PROCEDURE`, `PUBLIC-PROSECUTION`.
- لا تغيّر UID بعد إضافة الإجابة أو المراجع.
- لا تخترع نص سؤال أو إجابة أو مرجعاً قانونياً.
- احتفظ بالترقيم الأصلي والفروع، وسجّل صفحات المصدر.
- عند عدم وضوح النص، ضع `[غير واضح في المصدر]` وسجّل ذلك في verification.notes.

## تحديث manifest.json

بعد إضافة الملفات، أضف سنة واحدة في `years` بالشكل التالي، ولا تدرج إلا المواد التي لها ملفات فعلية:

```json
{
  "year": 2005,
  "questionCount": 12,
  "subjects": [
    {
      "subjectId": "personal-status",
      "file": "data/judicial-institute/questions/2005/personal-status.json",
      "questionCount": 4
    },
    {
      "subjectId": "civil-procedure",
      "file": "data/judicial-institute/questions/2005/civil-procedure.json",
      "questionCount": 8
    }
  ]
}
```

- `questionCount` في السنة يساوي مجموع أسئلة ملفات المواد المدرجة.
- `questionCount` لكل مادة يساوي عدد عناصر questions في ملفها.
- `file` مسار نسبي من جذر الموقع.
- لا تضف سنة أو مادة بملف فارغ.
