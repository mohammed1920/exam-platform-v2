/* ============================================================
   book-icons.js
   مكتبة أيقونات الكتب + نظام توزيع الألوان التلقائي
   يُستخدم من قبل app.js (عرض الكتب للطالب) و admin.html (لوحة الاختيار)
   ============================================================ */

/* -------------------- 1) الثيمات اللونية -------------------- */
// كل كتاب جديد يأخذ لوناً تلقائياً بالاعتماد على معرفه (id) — لا حاجة
// لتخزين اللون يدوياً في books.json، ونفس المعرف يعطي دائماً نفس اللون.
const BOOK_THEMES = ['blue', 'burgundy', 'emerald', 'brown', 'purple'];

const BOOK_THEME_LABELS = {
  blue: 'الأزرق الملكي',
  burgundy: 'العنابي الملكي',
  emerald: 'الأخضر الزمردي',
  brown: 'البني الجلدي',
  purple: 'البنفسجي الملكي'
};

function getBookTheme(bookId) {
  const id = String(bookId || '');
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return BOOK_THEMES[hash % BOOK_THEMES.length];
}

/* -------------------- 2) مكتبة الأيقونات -------------------- */
// كل أيقونة: مفتاح إنجليزي (يُخزَّن في books.json كـ book.icon) + اسم عربي
// للعرض داخل لوحة الأدمن + محتوى SVG داخلي (viewBox 0 0 24 24, fill:none).
// العناصر الداخلية لا تحدد "stroke" بنفسها كي ترث تدرج الذهب من العنصر الأب (.emblem-icon).
const BOOK_ICONS = {
  scale: { label: 'ميزان العدالة', svg: '<path d="M12 3V7 M4 8H20 M6 8L3 15 M6 8L9 15 M18 8L15 15 M18 8L21 15 M3 15A3 3 0 0 0 9 15 M15 15A3 3 0 0 0 21 15 M12 7V20 M9 21H15"/>' },
  gavel: { label: 'مطرقة القاضي', svg: '<path d="M2 22h6M5 22v-4M2 14l6 6M9 11l4 4M11 5l4 4M13 3l6 6-3 3-6-6z"/>' },
  globe: { label: 'القانون الدولي', svg: '<path d="M12 3a9 9 0 100 18 9 9 0 000-18z M3.6 9h16.8 M3.6 15h16.8 M12 3a15.3 15.3 0 014 9 15.3 15.3 0 01-4 9 15.3 15.3 0 01-4-9 15.3 15.3 0 014-9z"/>' },
  pillar: { label: 'عمود الدستور', svg: '<path d="M5 21h14 M6 21V9 M18 21V9 M4 9l8-5 8 5 M9 9v9 M12 9v9 M15 9v9"/>' },
  shield: { label: 'درع الحماية', svg: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/>' },
  scroll: { label: 'الوثيقة القانونية', svg: '<path d="M6 4h9a3 3 0 013 3v10a3 3 0 01-3 3H8 M6 4a2 2 0 00-2 2v12a2 2 0 002 2 M6 4v16 M9 9h6 M9 13h6"/>' },
  bookOpen: { label: 'كتاب مفتوح', svg: '<path d="M12 6c-2-1.5-5-2-8-1v13c3-1 6-.5 8 1 2-1.5 5-2 8-1V5c-3-1-6-.5-8 1z M12 6v13"/>' },
  document: { label: 'مستند', svg: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/>' },
  stamp: { label: 'الختم الرسمي', svg: '<circle cx="12" cy="9" r="5"/><path d="M9 9l2 2 4-4M6 21h12M8 21v-4a4 4 0 018 0v4"/>' },
  crown: { label: 'التاج / السيادة', svg: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z M5 21h14"/>' },
  key: { label: 'المفتاح', svg: '<circle cx="8" cy="8" r="4"/><path d="M11 11l9 9M17 17l2-2M14 14l2-2"/>' },
  lock: { label: 'القفل / الأمان', svg: '<rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V7a4 4 0 018 0v4"/>' },
  flag: { label: 'العلم / الدولة', svg: '<path d="M5 3v18M5 4h13l-3 4 3 4H5"/>' },
  star: { label: 'نجمة التميز', svg: '<path d="M12 2l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z"/>' },
  compass: { label: 'البوصلة', svg: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-2 6-6 2 2-6z"/>' },
  anchor: { label: 'المرساة', svg: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M5 12H2a10 10 0 0020 0h-3M8 16l4 4 4-4"/>' },
  feather: { label: 'ريشة التوقيع', svg: '<path d="M20 4c-6 0-14 4-16 14 2-1 4-2 6-4M8 18L20 4M14 8l-6 6M11 11l-3 3"/>' },
  handshake: { label: 'الاتفاق / العقد', svg: '<path d="M2 12l5-4 4 3 3-2 4 3 4-3M6 8l6 8 4-3M14 14l3 3"/>' },
  linkChain: { label: 'الالتزام القانوني', svg: '<rect x="2" y="8" width="8" height="8" rx="4"/><rect x="14" y="8" width="8" height="8" rx="4"/><path d="M9 12h6"/>' },
  briefcase: { label: 'الحقيبة المهنية', svg: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/>' },
  awardRibbon: { label: 'شهادة تقدير', svg: '<circle cx="12" cy="8" r="5"/><path d="M9 12l-2 9 5-3 5 3-2-9"/>' },
  courthouse: { label: 'مبنى المحكمة', svg: '<path d="M4 21h16M5 21V10M19 21V10M3 10l9-6 9 6M8 10v11M12 10v11M16 10v11"/>' },
  penSignature: { label: 'التوقيع', svg: '<path d="M4 20c4 0 4-3 8-3s3 3 7 3M17 3l4 4-11 11H6v-4z"/>' },
  family: { label: 'الأحوال الشخصية', svg: '<circle cx="8" cy="7" r="3"/><circle cx="16" cy="7" r="3"/><path d="M2 21v-2a5 5 0 015-5h2a5 5 0 015 5M13 14a5 5 0 015 5v2"/>' },
  percent: { label: 'الضرائب والرسوم', svg: '<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M18 6L6 18"/>' },
  handcuffs: { label: 'القانون الجنائي', svg: '<circle cx="7" cy="12" r="4"/><circle cx="17" cy="12" r="4"/><path d="M11 12h2"/>' },
  magnifier: { label: 'التحقيق', svg: '<circle cx="10" cy="10" r="6"/><path d="M21 21l-5.2-5.2"/>' },
  fingerprint: { label: 'البصمة', svg: '<path d="M12 2a8 8 0 00-8 8c0 4 2 6 2 10M12 2a8 8 0 018 8c0 3-1 5-1 7M8 11a4 4 0 018 0c0 5-2 6-2 9M12 8a2 2 0 00-2 2c0 6-3 8-3 8m9-10a2 2 0 00-2-2"/>' },
  clipboardCheck: { label: 'قائمة تحقق', svg: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1M9 13l2 2 4-4"/>' },
  bank: { label: 'البنك / المال', svg: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5a2.5 2.5 0 012.5-1.5h1a2 2 0 010 4h-3a2 2 0 000 4h1.5a2.5 2.5 0 002.5-1.5"/>' },
  emblem: { label: 'الشعار الوطني', svg: '<path d="M12 3c-2 3-6 4-9 3 2 3 5 4 7 4-3 2-5 5-6 8 3-1 6-3 8-5 2 2 5 4 8 5-1-3-3-6-6-8 2 0 5-1 7-4-3 1-7 0-9-3z"/>' },
  torch: { label: 'شعلة العدالة', svg: '<path d="M9 2h6l-1 5h2l-2 4H10L8 7h2z M11 11v9a1 1 0 001 1 1 1 0 001-1v-9"/>' },
  map: { label: 'الحدود الجغرافية', svg: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z M9 4v14M15 6v14"/>' },
  buildingColumns: { label: 'مبنى حكومي', svg: '<path d="M3 10h18M5 10v10M9 10v10M12 10v10M15 10v10M19 10v10M2 21h20M12 3L3 9h18z"/>' }
};

// أيقونة افتراضية إن لم تُحدَّد للكتاب أيقونة صراحة في books.json
function getBookIconSvg(iconKey) {
  const entry = BOOK_ICONS[iconKey] || BOOK_ICONS.scale;
  return entry.svg;
}

// يُصدِّرها للاستخدام في الملفات الأخرى (app.js, admin.html)
if (typeof window !== 'undefined') {
  window.BOOK_THEMES = BOOK_THEMES;
  window.BOOK_THEME_LABELS = BOOK_THEME_LABELS;
  window.BOOK_ICONS = BOOK_ICONS;
  window.getBookTheme = getBookTheme;
  window.getBookIconSvg = getBookIconSvg;
}
